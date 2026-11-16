"""Vinculos declarados, capturas versionadas e revisao; nao confunde login com habilitacao."""
from dataclasses import asdict
from base64 import b32encode
from hashlib import sha256
import json
import re
from uuid import UUID,uuid4
from django.utils import timezone
from mtr.models import VinculoAmbientalSIGOR,RevogacaoVinculoSIGOR,CapturaCatalogoSIGOR,RevisaoAmbientalSIGOR,DespachoSIGOR,EventoDespachoSIGOR
from mtr.servicos_mvp import ErroMTR,hash_dados,primitivo,rascunho_da_empresa,operador_transacional,versao,fingerprint,fonte_comercial,checar_campos
from mtr.sigor_contrato import identificador,inteiro,validar_dados,construir_payload,json_wire
from mtr.catalogos_mvp import referencia_operador
from mtr.sigor.catalogos import CAMPOS,normalizar_catalogo
from mtr.sigor.leitura import Operacao,metodo_http,validar_operacao
from mtr.sigor.configuracao import cliente_leitura
from mtr.sigor.privacidade import ErroSeguro

PAPEIS=('GERADOR','TRANSPORTADOR','DESTINADOR')
CONFIRMACOES={'participantes','classificacao','quantidade','tratamento_destinador','sem_condicionais','ciencia_homologacao'}
TIPOS={'unidades':'unidades-medida','tratamentos':'tratamentos','estados':'estados-fisicos','acondicionamentos':'acondicionamentos','classes':'classes'}

def conferir_transportador_frete(frete,dados,cpf_cnpj_vinculo):
    """DA01: o participante ambiental deve ser a transportadora comercial do frete."""
    if frete.transportadora_id is None:
        raise ErroMTR('TRANSPORTADORA_NAO_DEFINIDA','Defina a transportadora no cadastro do frete antes da revisão ambiental.',422)
    try:
        comercial=identificador(frete.transportadora.cnpj)
        coincide=identificador(dados.get('transportador_cnpj'))==comercial==identificador(cpf_cnpj_vinculo)
    except ValueError:
        coincide=False
    if not coincide:
        raise ErroMTR('TRANSPORTADOR_DIVERGENTE_FRETE','O transportador ambiental deve ter o mesmo CPF/CNPJ da transportadora do frete. Corrija o frete antes de fazer uma nova revisão ambiental.',422)


def uuid_valido(v):
    try: return UUID(str(v))
    except (ValueError,TypeError,AttributeError): raise ErroMTR('IDENTIFICADOR_INVALIDO','Confira o identificador informado.',400) from None

def vinculo_dto(v):
    return {'id':str(v.pk),'papel':v.papel,'cpf_cnpj':v.cpf_cnpj,'unidade':v.unidade,'simulado':v.simulado,
        'origem_validacao':'DECLARACAO_INDIVIDUAL_COM_EVIDENCIA','validacao_governamental_automatica':False,
        'evidencia_sha256':v.evidencia_sha256,'valido_ate':v.valido_ate.isoformat() if v.valido_ate else None,'revogado':RevogacaoVinculoSIGOR.objects.filter(pk=v.pk).exists()}

def obter_vinculo(empresa,id,papel=None,bloquear=False):
    q=VinculoAmbientalSIGOR.objects.select_for_update() if bloquear else VinculoAmbientalSIGOR.objects
    v=q.filter(pk=uuid_valido(id),empresa=empresa).first()
    if not v or papel and v.papel!=papel: raise ErroMTR('NAO_ENCONTRADO','Vínculo não encontrado neste contexto.',404)
    if RevogacaoVinculoSIGOR.objects.filter(pk=v.pk).exists() or v.valido_ate and v.valido_ate<=timezone.now(): raise ErroMTR('VINCULO_INATIVO','A evidência do vínculo expirou ou foi revogada; revise os participantes.')
    return v

def registrar_vinculo(empresa,dados,op):
    checar_campos(dados,{'papel','cpf_cnpj','unidade','simulado','evidencia_sha256','valido_ate','confirmar_habilitacao'})
    op=operador_transacional(op,empresa,'pode_revisar')
    if dados.get('papel') not in PAPEIS or dados.get('confirmar_habilitacao') is not True or type(dados.get('simulado')) is not bool or not re.fullmatch(r'[0-9a-f]{64}',str(dados.get('evidencia_sha256',''))): raise ErroMTR('EVIDENCIA_NECESSARIA','Informe papel, origem simulada ou real e hash da evidência; confirme a habilitação documental.',422)
    try: cnpj=identificador(dados.get('cpf_cnpj')); unidade=inteiro(dados.get('unidade')); documento_empresa=identificador(empresa.cnpj)
    except ValueError: raise ErroMTR('PARTICIPANTE_INVALIDO','Confira o identificador e a unidade ambiental.',422) from None
    if dados['papel']=='GERADOR' and cnpj!=documento_empresa: raise ErroMTR('GERADOR_DIVERGENTE','Primeiro cenário exige geradora e vendedora com o mesmo CNPJ.',422)
    limite=dados.get('valido_ate')
    if limite is not None:
        from django.utils.dateparse import parse_datetime
        try:
            limite=parse_datetime(limite)
            if limite is None or timezone.is_naive(limite) or limite<=timezone.now(): raise ValueError()
        except (TypeError,ValueError): raise ErroMTR('VALIDADE_INVALIDA','Informe validade futura com fuso explícito.',422) from None
    v=VinculoAmbientalSIGOR.objects.create(empresa=empresa,operador=op,papel=dados['papel'],cpf_cnpj=cnpj,unidade=unidade,
        simulado=dados['simulado'],evidencia_sha256=dados['evidencia_sha256'],valido_ate=limite)
    return vinculo_dto(v),201

def revogar_vinculo(empresa,id,op):
    op=operador_transacional(op,empresa,'pode_revisar'); v=obter_vinculo(empresa,id,bloquear=True)
    RevogacaoVinculoSIGOR.objects.create(vinculo=v,operador=op)
    return {'id':str(v.pk),'revogado':True},200

def captura_dto(c):
    return {'id':str(c.pk),'operacao':c.operacao,'parametro':c.parametro,'metodo_http':c.metodo_http,'origem':c.origem,
        'simulado':c.simulado,'itens':c.itens,'resumo':c.resumo,'fonte_sha256':c.fonte_sha256,'versao_oficial':c.versao_oficial,
        'classificacao_ambiental_aprovada':False}

def capturar(empresa,operacao,itens,*,parametro='',simulado,origem,metodo,fonte_sha256=None):
    norm=normalizar_catalogo(operacao,itens)
    fatos={'operacao':operacao,'parametro':parametro,'itens':norm,'simulado':simulado,'origem':origem,'metodo_http':metodo,'versao_oficial':None}
    resumo=hash_dados(fatos)
    return CapturaCatalogoSIGOR.objects.create(empresa=empresa,operacao=operacao,parametro=parametro,metodo_http=metodo,
        origem=origem,simulado=simulado,itens=norm,resumo=resumo,fonte_sha256=fonte_sha256 or hash_dados(itens),versao_oficial=None)

def conferir_captura(c):
    fatos={'operacao':c.operacao,'parametro':c.parametro,'itens':c.itens,'simulado':c.simulado,'origem':c.origem,'metodo_http':c.metodo_http,'versao_oficial':c.versao_oficial}
    if c.resumo!=hash_dados(fatos): raise ErroMTR('CATALOGO_INCONSISTENTE','Integridade da captura inválida; classificação bloqueada.')

def incorporar_referencia(empresa,op):
    operador_transacional(op,empresa,'pode_revisar')
    itens,meta=referencia_operador()
    c=capturar(empresa,'residuos',[{'resCodigoIbama':r['codigo'],'resDescricao':r['descricao']} for r in itens],simulado=False,
        origem='OPERADOR_REFERENCIA',metodo=None,fonte_sha256=meta['sha256'])
    return captura_dto(c),201

def consultar(empresa,vinculo_id,operacao,parametro,operador):
    if operacao!='autenticar' and operacao not in CAMPOS: raise ErroMTR('OPERACAO_BLOQUEADA','Operação de leitura não permitida.',400)
    try: op=Operacao(operacao); validar_operacao(op,parametro)
    except (ValueError,ErroSeguro): raise ErroMTR('PARAMETRO_INVALIDO','Confira a operação e seu parâmetro.',400) from None
    v=obter_vinculo(empresa,vinculo_id,'GERADOR')
    cliente,simulado=cliente_leitura(empresa,v,operacao,operador)
    try:
        cliente.autenticar()
        if operacao=='autenticar': return {'autenticado':True,'simulado':simulado,'habilitacao_comprovada':False,'emissao_real_habilitada':False}
        resultado=cliente.consultar_catalogo(op,parametro=parametro)
        c=capturar(empresa,operacao,resultado.para_consumo_local_sem_log(),parametro=parametro or '',simulado=simulado,
            origem='SIMULACAO' if simulado else 'RESPOSTA_API',metodo=metodo_http(op))
        return captura_dto(c)
    finally: cliente.fechar()

def catalogos_da_revisao(empresa,ids,dados):
    if not isinstance(ids,dict) or set(ids)!=set(CAMPOS): raise ErroMTR('CATALOGOS_NECESSARIOS','Informe as oito capturas, incluindo classes por resíduo e acondicionamentos por estado.',422)
    caps={}
    for op,id in ids.items():
        c=CapturaCatalogoSIGOR.objects.filter(pk=uuid_valido(id),empresa=empresa,operacao=op).first()
        if not c: raise ErroMTR('NAO_ENCONTRADO','Captura não encontrada neste contexto.',404)
        conferir_captura(c); caps[op]=c
    cp=caps['classes-por-residuo']; ap=caps['acondicionamentos-por-estado']
    if cp.parametro!=dados.get('resCodigoIbama') or ap.parametro!=str(dados.get('tieCodigo')): raise ErroMTR('FILTRO_DIVERGENTE','As relações consultadas não correspondem ao resíduo e estado selecionados.',422)
    try: cla=inteiro(dados.get('claCodigo')); tia=inteiro(dados.get('tiaCodigo'))
    except ValueError: raise ErroMTR('CLASSIFICACAO_INVALIDA','Confira os códigos ambientais.',422) from None
    if cla not in [r['codigo'] for r in cp.itens] or tia not in [r['codigo'] for r in ap.itens]: raise ErroMTR('COMBINACAO_INCOMPATIVEL','Classe ou acondicionamento não consta na relação selecionada.',422)
    cod=dados.get('resCodigoIbama','')
    if not isinstance(cod,str) or '*' in cod or cod in {'200132','200304'} or cod.startswith('Grupo'):
        raise ErroMTR('CONDICIONAIS_PENDENTES','Este resíduo requer validações condicionais ainda bloqueadas no primeiro cenário.',422)
    cat={k:caps[v].itens for k,v in TIPOS.items()}
    cat['residuos']=[{**r,'perigoso':None,'origem':dados.get('origem_codigo','captura_sigor')} for r in caps['residuos'].itens]
    erros=validar_dados(dados,empresa.cnpj,catalogo=cat)
    if erros: raise ErroMTR('PENDENCIAS_AMBIENTAIS','Corrija os dados ambientais antes de revisar.',422,pendencias=erros)
    return caps,cat

def revisar_ambiental(empresa,rascunho_id,dados,op):
    checar_campos(dados,{'versao','vinculos','catalogos','confirmacoes'})
    op=operador_transacional(op,empresa,'pode_revisar'); r=rascunho_da_empresa(empresa,rascunho_id,True); versao(r,dados.get('versao'))
    if r.frete_id is None:
        from mtr.operacional import validar
        if r.estado!='APROVADO' or RevisaoAmbientalSIGOR.objects.filter(rascunho=r).exists():
            raise ErroMTR('REVISAO_OPERACIONAL_NECESSARIA','Use a revisão individual do manifesto independente; não substituir um snapshot aprovado.')
        if not validar(r)['valido_para_preparacao']:
            raise ErroMTR('PENDENCIAS_AMBIENTAIS','A declaração operacional possui pendências.',422)
    if DespachoSIGOR.objects.filter(rascunho=r).exists(): raise ErroMTR('DESPACHO_EXISTENTE','Retome a intenção existente; não crie outra referência.')
    if not isinstance(dados.get('vinculos'),dict) or set(dados['vinculos'])!=set(PAPEIS): raise ErroMTR('PARTICIPANTES_NECESSARIOS','Selecione as três unidades ambientais.',422)
    conf=dados.get('confirmacoes')
    if not isinstance(conf,dict) or set(conf)!=CONFIRMACOES or any(v is not True for v in conf.values()): raise ErroMTR('CONFIRMACOES_NECESSARIAS','Confirme participantes, classificação, quantidade, tratamento, condicionais e ambiente.',422)
    vinculos={}
    # Mesmo ordenamento de locks em revisao, revogacao e despacho: empresa, operador,
    # rascunho, vinculos ordenados por UUID e despacho.
    for papel,id in sorted(dados['vinculos'].items(),key=lambda kv:str(kv[1])):
        vinculos[papel]=obter_vinculo(empresa,id,papel,True)
    from mtr.operacional import conferir_contexto, fingerprint_operacao, procedencia
    conferir_contexto(r,r.dados,vinculos['TRANSPORTADOR'].cpf_cnpj)
    for papel,prefix in [('GERADOR','gerador'),('TRANSPORTADOR','transportador'),('DESTINADOR','destinador')]:
        v=vinculos[papel]
        try: corresponde=identificador(r.dados.get(prefix+'_cnpj'))==v.cpf_cnpj and inteiro(r.dados.get(prefix+'_unidade'))==v.unidade
        except ValueError: corresponde=False
        if not corresponde:
            raise ErroMTR('PARTICIPANTE_DIVERGENTE','Os dados salvos não correspondem às unidades selecionadas.',422)
    if vinculos['GERADOR'].cpf_cnpj!=identificador(empresa.cnpj): raise ErroMTR('GERADOR_DIVERGENTE','Geradora e vendedora devem corresponder.',422)
    if r.frete_id and r.frete.situacao=='cancelado': raise ErroMTR('FRETE_CANCELADO','Frete cancelado não pode originar preparação.')
    caps,cat=catalogos_da_revisao(empresa,dados.get('catalogos'),r.dados)
    mapa={'unidades':'uniCodigo','tratamentos':'traCodigo','estados':'tieCodigo','acondicionamentos':'tiaCodigo','classes':'claCodigo','residuos':'resCodigoIbama'}
    selecionados={tipo:[row for row in itens if str(row['codigo'])==str(r.dados[mapa[tipo]])] for tipo,itens in cat.items()}
    snapshot={'schema':'mtr-sigor-preparacao-v1','dados':r.dados,'versao_rascunho':r.versao,'fingerprint_frete':fingerprint_operacao(r),
        'procedencia':procedencia(r),'contexto_operacional':r.contexto,'vinculos':{p:vinculo_dto(v) for p,v in vinculos.items()},
        'catalogos':{p:{k:v for k,v in captura_dto(c).items() if k!='itens'} for p,c in caps.items()},'catalogo_validacao':selecionados,'confirmacoes':conf,
        'responsavel':{'operador_id':op.pk,'usuario_id':op.usuario_id,'nome':op.usuario.get_full_name()},
        'habilitacao_origem':'DECLARACAO_INDIVIDUAL_COM_EVIDENCIA','emissao_real_habilitada':False}
    rev=RevisaoAmbientalSIGOR.objects.create(rascunho=r,operador=op,snapshot=primitivo(snapshot),resumo=hash_dados(snapshot))
    return {'id':str(rev.pk),'rascunho_id':str(r.pk),'resumo':rev.resumo,'emissao_real_habilitada':False},201

def preparar_despacho(empresa,rascunho_id,dados,op):
    checar_campos(dados,{'revisao_id','modo','confirmar_preparacao'})
    op=operador_transacional(op,empresa,'pode_autorizar'); r=rascunho_da_empresa(empresa,rascunho_id,True)
    if r.frete_id is None:
        from mtr.operacional import exigir_ausencia_resultado_pendente
        exigir_ausencia_resultado_pendente(empresa)
    if r.frete_id is None and dados.get('modo')=='HOMOLOGACAO' and not op.verificado_homologacao:
        raise ErroMTR('EVIDENCIAS_NAO_COMPROVADAS','Representação/habilitação individual precisa ser conferida antes de preparar homologação.',422)
    if dados.get('confirmar_preparacao') is not True or dados.get('modo') not in {'SIMULACAO','HOMOLOGACAO'}: raise ErroMTR('CONFIRMACAO_NECESSARIA','Autorize a preparação e informe seu modo.',422)
    if DespachoSIGOR.objects.filter(rascunho=r).exists(): raise ErroMTR('DESPACHO_EXISTENTE','Já existe intenção; consulte o estado antes de qualquer outra operação.')
    rev=RevisaoAmbientalSIGOR.objects.filter(pk=uuid_valido(dados.get('revisao_id')),rascunho=r).first()
    if not rev: raise ErroMTR('NAO_ENCONTRADO','Revisão não encontrada neste contexto.',404)
    if rev.resumo!=hash_dados(rev.snapshot): raise ErroMTR('REVISAO_INCONSISTENTE','Integridade da revisão inválida.')
    s=rev.snapshot
    from mtr.operacional import conferir_contexto, fingerprint_operacao
    conferir_contexto(r,s['dados'],s['vinculos']['TRANSPORTADOR']['cpf_cnpj'])
    if s['versao_rascunho']!=r.versao or s['dados']!=r.dados or s['fingerprint_frete']!=fingerprint_operacao(r) or s.get('contexto_operacional',{})!=r.contexto: raise ErroMTR('REVISAO_SUPERADA','Dados comerciais ou ambientais mudaram; revise novamente.')
    for p,v in sorted(s['vinculos'].items(),key=lambda kv:kv[1]['id']): obter_vinculo(empresa,v['id'],p,True)
    simulado=dados['modo']=='SIMULACAO'
    if not simulado and (any(v['simulado'] for v in s['vinculos'].values()) or any(c['simulado'] for c in s['catalogos'].values()) or r.dados.get('origem_codigo')=='fixture_fase1a'):
        raise ErroMTR('DADO_FICTICIO_BLOQUEADO','Fixtures ou capturas simuladas não podem compor uma intenção de homologação.',422)
    # UUID completo em Base32 (26 caracteres), sem truncar a identidade de 128 bits.
    id=uuid4(); ref='ZWM2'+b32encode(id.bytes).decode('ascii').rstrip('=')
    payload=construir_payload(s['dados'],s['responsavel']['nome'],ref,empresa.cnpj,catalogo=s['catalogo_validacao'])
    wire=json_wire(payload)
    d=DespachoSIGOR.objects.create(id=id,rascunho=r,revisao=rev,operador=op,referencia=ref,payload_wire=wire,resumo=sha256(wire.encode()).hexdigest(),simulado=simulado)
    EventoDespachoSIGOR.objects.create(despacho=d,acao='PREPARACAO_PERSISTIDA',detalhes={'revisao_sha256':rev.resumo,'simulado':simulado})
    from mtr.sigor.despacho import despacho_dto
    return despacho_dto(d),201
