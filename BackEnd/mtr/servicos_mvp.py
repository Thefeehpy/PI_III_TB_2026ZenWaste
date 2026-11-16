"""Casos de uso do MVP persistente. Emissão real incondicionalmente bloqueada."""
from dataclasses import asdict
from decimal import Decimal
from hashlib import sha256
from uuid import UUID, uuid4
import json

from django.contrib.auth import authenticate
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from empresas.models import Empresa
from fretes.models import Frete
from mtr.consultas import consultar_pre_preenchimento
from mtr.contratos import IntencaoSimulada
from mtr.integracoes import criar_integracao_mtr, CenarioSimulado, ErroIntegracaoMTR
from mtr.models import OperadorMTR, RascunhoMTR, RevisaoMTR, IntencaoMTR, EventoMTR, ReciboMTR
from mtr.catalogos_mvp import catalogos_mvp
from mtr.sigor_contrato import construir_payload, validar_dados, json_wire, ErroContratoMTR

SALT='zenwaste.mtr.operador.v1'


class ErroMTR(APIException):
    def __init__(self,codigo,mensagem,status=409,**extra):
        self.status_code=status
        super().__init__({'codigo':codigo,'message':mensagem,**extra})


def primitivo(v): return json.loads(json.dumps(v,default=lambda x: format(x,'f') if isinstance(x,Decimal) else x.isoformat() if hasattr(x,'isoformat') else str(x),ensure_ascii=False))
def hash_dados(v): return sha256(json_wire(v).encode('utf-8')).hexdigest()
def checar_campos(dados,permitidos):
    if not isinstance(dados,dict) or set(dados)-set(permitidos): raise ErroMTR('CAMPO_NAO_PERMITIDO','Confira os campos enviados.',400)


def sessao_operador(empresa,usuario,senha):
    if not isinstance(usuario,str) or not isinstance(senha,str) or len(usuario)>150 or len(senha)>1024:
        raise ErroMTR('IDENTIDADE_INVALIDA','Identificação individual inválida.',401)
    pessoa=authenticate(username=usuario,password=senha)
    op=OperadorMTR.objects.select_related('usuario').filter(usuario=pessoa,empresa=empresa,ativo=True).first() if pessoa else None
    if not op or not pessoa.is_active or not pessoa.get_full_name().strip():
        raise ErroMTR('IDENTIDADE_INVALIDA','Pessoa ou representação não autorizada nesta empresa.',401)
    token=signing.dumps({'op':op.pk,'empresa':empresa.pk,'usuario':pessoa.pk,'credencial':pessoa.get_session_auth_hash()},salt=SALT)
    return {'token_operador':token,'operador':{'id':op.pk,'nome':pessoa.get_full_name(),'verificado_homologacao':op.verificado_homologacao},'validade_segundos':900,'emissao_real_habilitada':False}


def exigir_operador(empresa,token,capacidade):
    try:
        data=signing.loads(token,salt=SALT,max_age=900)
        op=OperadorMTR.objects.select_related('usuario').get(pk=data['op'],empresa=empresa,ativo=True,usuario_id=data['usuario'],usuario__is_active=True)
        if data['empresa']!=empresa.pk or data['credencial']!=op.usuario.get_session_auth_hash() or not getattr(op,capacidade) or not op.usuario.get_full_name().strip(): raise ValueError()
        return op
    except (signing.BadSignature,KeyError,ValueError,TypeError,OperadorMTR.DoesNotExist):
        raise ErroMTR('OPERADOR_NECESSARIO','Identifique uma pessoa autorizada da empresa para esta ação.',403) from None


def frete_gestor(empresa,frete_id):
    f=Frete.objects.select_related('empresa_vendedora','empresa_compradora','transportadora','pedido').filter(pk=frete_id,empresa_vendedora=empresa).first()
    if not f: raise ErroMTR('NAO_ENCONTRADO','Operação não encontrada neste contexto.',404)
    return f


def operador_transacional(op,empresa,capacidade):
    atual=OperadorMTR.objects.select_for_update().select_related('usuario').filter(pk=op.pk,empresa=empresa,ativo=True,usuario__is_active=True).first()
    if not atual or not getattr(atual,capacidade) or atual.usuario.get_session_auth_hash()!=op.usuario.get_session_auth_hash():
        raise ErroMTR('OPERADOR_NECESSARIO','Autorização individual mudou; identifique novamente a pessoa responsável.',403)
    return atual


def fonte_comercial(empresa,frete):
    return primitivo(asdict(consultar_pre_preenchimento(empresa.pk,frete.pk)))


def fingerprint(f):
    return hash_dados({'id':str(f.pk),'empresa_vendedora':f.empresa_vendedora_id,'empresa_compradora':f.empresa_compradora_id,
        'cnpj_vendedora':f.empresa_vendedora.cnpj,'cnpj_transportadora':f.transportadora.cnpj if f.transportadora else None,
        'transportadora':f.transportadora_id,'quantidade':str(f.quantidade),'unidade':f.unidade,'material':f.material,
        'origem':f.origem,'destino':f.destino,'situacao':f.situacao,'pedido':str(f.pedido_id) if f.pedido_id else None})


def rascunho_da_empresa(empresa,id,bloquear=False):
    q=RascunhoMTR.objects.select_for_update() if bloquear else RascunhoMTR.objects
    r=q.filter(pk=id,empresa=empresa).first()
    if not r: raise ErroMTR('NAO_ENCONTRADO','Rascunho não encontrado neste contexto.',404)
    if r.frete_id: frete_gestor(empresa,r.frete_id)
    return r


def intencao_dto(i):
    return {'id':str(i.pk),'rascunho_id':str(i.revisao.rascunho_id),'revisao_id':str(i.revisao_id),
        'estado':i.estado,'referencia':i.referencia,'cenario':i.cenario,'quantidade_envios':i.quantidade_envios,
        'resultado':i.resultado,'simulado':True,'emissao_oficial':False,'ambiente':'MOCK'}


def rascunho_dto(r):
    if r.frete_id is None:
        from mtr.operacional import detalhe
        return detalhe(r)
    rev=r.revisoes.order_by('-versao').first()
    i=IntencaoMTR.objects.filter(revisao__rascunho=r).select_related('revisao').first()
    return {'id':str(r.pk),'frete_id':str(r.frete_id),'versao':r.versao,'estado':r.estado,'ambiente':r.ambiente,'dados':r.dados,
        'revisao':{'id':str(rev.pk),'versao':rev.versao,'resumo':rev.resumo,'operador':rev.snapshot['responsavel'],'simulado':True} if rev else None,
        'intencao':intencao_dto(i) if i else None,'emissao_real_habilitada':False,
        'eventos':[{'id':str(e.pk),'acao':e.acao,'criado_em':e.criado_em.isoformat(),'detalhes':e.detalhes} for e in r.eventos.order_by('criado_em','id')]}


def evento(r,acao,op=None,**dados): EventoMTR.objects.create(rascunho=r,acao=acao,operador=op,detalhes=primitivo(dados))
def versao(r,esperada):
    if type(esperada) is not int: raise ErroMTR('PRECONDICAO_OBRIGATORIA','Informe a versão do rascunho.',428)
    if r.versao!=esperada: raise ErroMTR('ESTADO_DESATUALIZADO','O rascunho mudou. Recarregue os dados antes de confirmar.',412)


def executar_comando(empresa,operacao,chave,dados,fn):
    try: chave=UUID(str(chave))
    except (ValueError,TypeError,AttributeError): raise ErroMTR('CHAVE_OBRIGATORIA','Envie Idempotency-Key UUID para preservar este comando.',400) from None
    resumo=hash_dados(dados)
    with transaction.atomic():
        ativa=Empresa.objects.select_for_update().filter(pk=empresa.pk,ativo=True).exists()
        if not ativa: raise ErroMTR('EMPRESA_INATIVA','Empresa não autorizada.',403)
        anterior=ReciboMTR.objects.filter(empresa=empresa,chave=chave).first()
        if anterior:
            if anterior.operacao!=operacao or anterior.resumo!=resumo: raise ErroMTR('CHAVE_REUTILIZADA','A chave já identifica outro conteúdo. Consulte o comando original.')
            return anterior.resposta,anterior.status_http
        body,status=fn()
        body=primitivo(body)
        ReciboMTR.objects.create(empresa=empresa,chave=chave,operacao=operacao,resumo=resumo,resposta=body,status_http=status)
        return body,status


def criar_rascunho(empresa,dados):
    if dados.get('tipo')=='HOMOLOGACAO_INDEPENDENTE':
        if dados.get('cenario')=='MTR05B_HOMOLOGACAO':
            from mtr.sigor.preparacao import criar_candidato
            return criar_candidato(empresa,dados)
        from mtr.operacional import criar
        return criar(empresa,dados)
    checar_campos(dados,{'frete_id'})
    f=frete_gestor(empresa,dados.get('frete_id'))
    if f.situacao=='cancelado': raise ErroMTR('FRETE_CANCELADO','Não preparar nova emissão para frete cancelado.')
    existente=RascunhoMTR.objects.filter(frete=f).first()
    if existente: raise ErroMTR('RASCUNHO_EXISTENTE','Retome o rascunho já criado para esta operação.',rascunho_id=str(existente.pk))
    fonte_comercial(empresa,f)
    r=RascunhoMTR.objects.create(empresa=empresa,frete=f,dados={'gerador_cnpj':f.empresa_vendedora.cnpj,'marQuantidade':str(f.quantidade),
        'transportador_cnpj':f.transportadora.cnpj if f.transportadora else '', 'destinador_cnpj':''})
    evento(r,'rascunho_criado',origem='pre_preenchimento',simulado=True)
    return rascunho_dto(r),201


def salvar_rascunho(empresa,id,entrada):
    checar_campos(entrada,{'versao','dados'})
    r=rascunho_da_empresa(empresa,id,True); versao(r,entrada.get('versao'))
    if IntencaoMTR.objects.filter(revisao__rascunho=r).exists(): raise ErroMTR('INTENCAO_EXISTENTE','Há intenção registrada; preserve o snapshot e consulte o resultado.')
    if not isinstance(entrada.get('dados'),dict) or len(json.dumps(entrada['dados']))>18000: raise ErroMTR('DADOS_INVALIDOS','Informe os campos do rascunho dentro do limite.',400)
    dados={**r.dados,**entrada['dados']}
    erros=validar_dados(dados,r.frete.empresa_vendedora.cnpj)
    # Pendências são permitidas; campos desconhecidos e tipos aninhados arbitrários não são.
    if 'dados' in erros or any(not isinstance(v,(str,int,type(None))) or isinstance(v,bool) for v in dados.values()):
        raise ErroMTR('DADOS_INVALIDOS','Campos ou tipos não permitidos no rascunho.',400)
    r.dados=dados; r.versao+=1; r.estado='RASCUNHO'; r.save()
    evento(r,'rascunho_atualizado',versao=r.versao,simulado=True)
    return rascunho_dto(r),200


def validar_rascunho(r):
    f=frete_gestor(r.empresa,r.frete_id)
    erros=validar_dados(r.dados,f.empresa_vendedora.cnpj)
    if f.situacao=='cancelado': erros['frete']='Frete cancelado.'
    return {'valido_para_mock':not erros,'pendencias':erros,'aprovado_ambientalmente':False,'emissao_real_habilitada':False,'ambiente':'MOCK'}


def revisar(empresa,id,dados,op):
    checar_campos(dados,{'versao','confirmacoes'})
    op=operador_transacional(op,empresa,'pode_revisar')
    r=rascunho_da_empresa(empresa,id,True); versao(r,dados.get('versao'))
    if IntencaoMTR.objects.filter(revisao__rascunho=r).exists(): raise ErroMTR('INTENCAO_EXISTENTE','Revisão já possui intenção; consulte o resultado.')
    validacao=validar_rascunho(r)
    if not validacao['valido_para_mock']: raise ErroMTR('PENDENCIAS_AMBIENTAIS','Confira os campos pendentes antes de revisar.',422,pendencias=validacao['pendencias'])
    confirms=dados.get('confirmacoes')
    if not isinstance(confirms,dict) or set(confirms)!={'participantes','quantidade','classificacao','ciencia_mock'} or any(v is not True for v in confirms.values()):
        raise ErroMTR('CONFIRMACAO_NECESSARIA','Confirme participantes, quantidade, classificação e o caráter simulado.',422)
    catalogo=catalogos_mvp()
    referencias=[c for c in catalogo['residuos'] if c['codigo']==r.dados['resCodigoIbama'] and (not r.dados.get('origem_codigo') or c['origem']==r.dados['origem_codigo'])]
    snapshot={'dados':r.dados,'procedencia':fonte_comercial(empresa,r.frete),'fingerprint_frete':fingerprint(r.frete),
        'catalogo':{'residuo':referencias[0],'versao_fixture':catalogo['versao'],'referencia_operador':catalogo['referencia_operador'],
            'tipos_mock':{k:catalogo[k] for k in ['unidades','tratamentos','estados','acondicionamentos','classes']}},
        'responsavel':{'operador_id':op.pk,'usuario_id':op.usuario_id,'nome':op.usuario.get_full_name()},
        'confirmacoes':confirms,'ambiente':'MOCK','aprovado_ambientalmente':False,'versao_schema':'mtr-mvp-mock-v1'}
    rev=RevisaoMTR.objects.create(rascunho=r,versao=r.versao,operador=op,snapshot=snapshot,resumo=hash_dados(snapshot))
    r.estado='APROVADO'; r.versao+=1; r.save()
    evento(r,'revisao_mock_aprovada',op,revisao_id=str(rev.pk),simulado=True)
    return rascunho_dto(r),201


def preparar(empresa,id,dados,op):
    checar_campos(dados,{'versao','cenario','confirmar_mock'})
    op=operador_transacional(op,empresa,'pode_autorizar')
    r=rascunho_da_empresa(empresa,id,True); versao(r,dados.get('versao'))
    if dados.get('confirmar_mock') is not True: raise ErroMTR('CONFIRMACAO_NECESSARIA','Autorize explicitamente somente a simulação.',422)
    if r.estado!='APROVADO': raise ErroMTR('REVISAO_NECESSARIA','Revise o rascunho antes de preparar a intenção.')
    if IntencaoMTR.objects.filter(revisao__rascunho=r).exists(): raise ErroMTR('INTENCAO_EXISTENTE','Já existe intenção para este cenário. Não criar outra referência.')
    rev=r.revisoes.order_by('-versao').first()
    if not rev or rev.snapshot['fingerprint_frete']!=fingerprint(r.frete): raise ErroMTR('REVISAO_SUPERADA','Os dados comerciais mudaram. Faça uma nova revisão.')
    if rev.resumo!=hash_dados(rev.snapshot): raise ErroMTR('REVISAO_INCONSISTENTE','Integridade da revisão inválida; preparação bloqueada.')
    cenario=dados.get('cenario','sucesso')
    if cenario not in {'sucesso','rejeicao','timeout'}: raise ErroMTR('CENARIO_INVALIDO','Selecione um cenário MOCK disponível.',400)
    id=uuid4(); referencia='MOCK'+id.hex[:26]
    payload=construir_payload(rev.snapshot['dados'],rev.snapshot['responsavel']['nome'],referencia,r.frete.empresa_vendedora.cnpj)
    wire=json_wire(payload)
    # JSONField guarda representação textual decimal; os bytes exatos para transporte ficam no envelope privado.
    i=IntencaoMTR.objects.create(id=id,revisao=rev,operador=op,referencia=referencia,
        payload={'json_wire':wire,'simulado':True},resumo=sha256(wire.encode()).hexdigest(),cenario=cenario)
    r.estado='PREPARADA'; r.versao+=1; r.save()
    evento(r,'intencao_mock_autorizada',op,intencao_id=str(i.pk),referencia=i.referencia,simulado=True)
    return rascunho_dto(r),201


def obter_intencao(empresa,id,bloquear=False):
    q=IntencaoMTR.objects.select_for_update() if bloquear else IntencaoMTR.objects
    i=q.filter(pk=id,revisao__rascunho__empresa=empresa).first()
    if not i: raise ErroMTR('NAO_ENCONTRADO','Intenção não encontrada neste contexto.',404)
    frete_gestor(empresa,i.revisao.rascunho.frete_id)
    return i


def enviar_mock(empresa,id,dados,op):
    checar_campos(dados,set())
    op=operador_transacional(op,empresa,'pode_autorizar')
    i=obter_intencao(empresa,id,True); r=i.revisao.rascunho
    if i.quantidade_envios or i.estado!='PREPARADA': return intencao_dto(i),200
    if i.revisao.resumo!=hash_dados(i.revisao.snapshot): raise ErroMTR('REVISAO_INCONSISTENTE','Integridade da revisão inválida; envio bloqueado.')
    if i.revisao.snapshot['fingerprint_frete']!=fingerprint(r.frete): raise ErroMTR('REVISAO_SUPERADA','Os dados comerciais mudaram; envio bloqueado.')
    if i.resumo!=sha256(i.payload['json_wire'].encode()).hexdigest(): raise ErroMTR('PAYLOAD_INCONSISTENTE','Integridade da intenção inválida; envio bloqueado.')
    i.quantidade_envios=1; i.estado='EM_ENVIO'; i.enviada_em=timezone.now(); i.save()
    evento(r,'envio_mock_iniciado',op,intencao_id=str(i.pk),simulado=True)
    if i.cenario=='rejeicao':
        i.estado='REJEITADA_SIMULADA'; codigo='REJEICAO_SIGOR_SIMULADA'
    else:
        adapter=criar_integracao_mtr('MOCK',cenario=CenarioSimulado.TIMEOUT if i.cenario=='timeout' else CenarioSimulado.SUCESSO)
        try:
            adapter.autenticar(); adapter.solicitar_emissao(IntencaoSimulada(str(i.pk),str(i.pk),i.resumo))
            i.estado='CONFIRMADA_SIMULADA'; codigo='SUCESSO_MOCK'
        except Exception:
            i.estado='INDETERMINADA'; codigo='RESULTADO_INDETERMINADO_MOCK'
    i.resultado={'codigo':codigo,'simulado':True,'emissao_oficial':False,'numero_oficial':None,
        'message':'Resultado exclusivamente MOCK, sem chamada governamental.'}
    i.save(); r.estado=i.estado; r.versao+=1; r.save()
    evento(r,'resultado_mock_registrado',op,intencao_id=str(i.pk),estado=i.estado,simulado=True)
    return intencao_dto(i),200


def reconciliar_mock(empresa,id,dados,op):
    checar_campos(dados,set())
    op=operador_transacional(op,empresa,'pode_autorizar')
    i=obter_intencao(empresa,id,True)
    # Sem governo e sem memória volátil como prova. Nenhum resultado é promovido otimisticamente.
    evento(i.revisao.rascunho,'consulta_intencao_mock',op,intencao_id=str(i.pk),estado=i.estado,simulado=True)
    return {**intencao_dto(i),'reconciliacao':{'consultou_governo':False,'novo_envio_permitido':False,
        'message':'Consulta ao registro persistente. Resultado indeterminado permanece bloqueado; nenhuma nova emissão.'}},200
