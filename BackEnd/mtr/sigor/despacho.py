"""Claim duravel -> transporte fora de SQL -> conclusao curta; uma tentativa por intencao."""
from dataclasses import asdict
from datetime import timedelta
from decimal import Decimal
from hashlib import sha256
from uuid import uuid4
import json
from django.db import connection,transaction
from django.utils import timezone
from empresas.models import Empresa
from mtr.models import DespachoSIGOR,EventoDespachoSIGOR,ReciboMTR,CapturaCatalogoSIGOR
from mtr.servicos_mvp import ErroMTR,hash_dados,operador_transacional,rascunho_da_empresa,fingerprint
from mtr.sigor.ambiental import obter_vinculo,uuid_valido,conferir_captura,conferir_transportador_frete
from mtr.sigor.protocolo import interpretar_emissao,interpretar_consulta,incerto
from mtr.sigor.leitura import ConsultaReferencia
from mtr.sigor.simulacao import TransporteDespachoSimulado
from mtr.sigor.configuracao import cliente_leitura
from mtr.sigor.privacidade import ErroSeguro

def obter(empresa,id,bloquear=False):
    q=DespachoSIGOR.objects.select_for_update() if bloquear else DespachoSIGOR.objects
    d=q.filter(pk=uuid_valido(id),rascunho__empresa=empresa).first()
    if not d: raise ErroMTR('NAO_ENCONTRADO','Intenção SIGOR não encontrada neste contexto.',404)
    return d

def despacho_dto(d):
    resultado=d.resultado
    from mtr.sigor.protocolo import politica_escrita_permite
    habilitada=not d.simulado and d.estado=='PREPARADA' and politica_escrita_permite(intencao_id=d.pk)
    return {'id':str(d.pk),'rascunho_id':str(d.rascunho_id),'revisao_id':str(d.revisao_id),'referencia':d.referencia,'estado':d.estado,
        'payload_sha256':d.resumo,
        'simulado':d.simulado,'tentativas':d.tentativas,'emissao_real_habilitada':habilitada,'emissao_oficial':False if d.simulado else d.estado=='CONFIRMADA',
        'resultado':{k:v for k,v in resultado.items() if k not in {'numero_nacional','numero_estadual'}} if d.simulado else resultado,
        'numero_oficial':None if d.simulado else resultado.get('numero_nacional') or resultado.get('numero_estadual'),
        'historico':[{'id':str(e.pk),'acao':e.acao,'detalhes':e.detalhes,'criado_em':e.criado_em.isoformat()} for e in d.eventos.order_by('criado_em','id')]}

def evento(d,acao,**dados): EventoDespachoSIGOR.objects.create(despacho=d,acao=acao,detalhes=dados)
def fora_atomic():
    if connection.in_atomic_block: raise ErroMTR('DESPACHO_FORA_TRANSACAO','O despacho deve iniciar fora de uma transação SQL; nenhuma tentativa foi feita.')

def empresa_lock(empresa):
    if not Empresa.objects.select_for_update().filter(pk=empresa.pk,ativo=True).exists(): raise ErroMTR('EMPRESA_INATIVA','Empresa não autorizada.',403)

def conferir(d,empresa):
    s=d.revisao.snapshot
    if hash_dados(s)!=d.revisao.resumo or sha256(d.payload_wire.encode()).hexdigest()!=d.resumo: raise ErroMTR('INTEGRIDADE_INVALIDA','Snapshot ou payload inconsistente; envio bloqueado.')
    r=d.rascunho
    from mtr.operacional import conferir_contexto, fingerprint_operacao
    conferir_contexto(r,s['dados'],s['vinculos']['TRANSPORTADOR']['cpf_cnpj'])
    if r.versao!=s['versao_rascunho'] or r.dados!=s['dados'] or s['fingerprint_frete']!=fingerprint_operacao(r) or s.get('contexto_operacional',{})!=r.contexto: raise ErroMTR('REVISAO_SUPERADA','Os dados mudaram depois da revisão; envio bloqueado.')
    for papel,v in sorted(s['vinculos'].items(),key=lambda kv:kv[1]['id']): obter_vinculo(empresa,v['id'],papel,True)
    for op,c in s['catalogos'].items():
        atual=CapturaCatalogoSIGOR.objects.filter(pk=c['id'],empresa=empresa,operacao=op).first()
        if not atual or atual.resumo!=c['resumo']: raise ErroMTR('CATALOGO_INCONSISTENTE','A captura de referência não corresponde à revisão.')
        conferir_captura(atual)

def _finalizar(empresa,id,worker,resultado):
    # Erro de commit e queda de processo nao apagam o claim previamente confirmado.
    with transaction.atomic(durable=True):
        empresa_lock(empresa); d=obter(empresa,id,True)
        if d.trabalhador!=worker or d.estado not in {'EM_DESPACHO','INDETERMINADA'}: return despacho_dto(d)
        d.estado=resultado.estado; d.resultado={**asdict(resultado),'simulado':d.simulado}
        d.save(update_fields=['estado','resultado','atualizada_em'])
        evento(d,'RESULTADO_REGISTRADO',estado=d.estado,codigo=resultado.codigo,simulado=d.simulado)
        return despacho_dto(d)

def despachar_simulado(empresa,id,op,chave,cenario='sucesso',*,transporte=None):
    fora_atomic(); chave=uuid_valido(chave)
    if cenario not in {'sucesso','rejeicao','timeout','malformada','participante_invalido','parcial'}: raise ErroMTR('CENARIO_INVALIDO','Cenário simulado não disponível.',400)
    d0=obter(empresa,id); resumo=hash_dados({'despacho':str(d0.pk),'cenario':cenario,'operador':op.pk})
    operacao=f'sigor-despacho:{d0.pk}:{op.pk}'
    ack={'id':str(d0.pk),'aceito':True,'status_url':f'/api/mtr/sigor/despachos/{d0.pk}/','emissao_real_habilitada':False}
    with transaction.atomic(durable=True):
        empresa_lock(empresa); op=operador_transacional(op,empresa,'pode_autorizar')
        anterior=ReciboMTR.objects.filter(empresa=empresa,chave=chave).first()
        if anterior:
            if anterior.operacao!=operacao or anterior.resumo!=resumo: raise ErroMTR('CHAVE_REUTILIZADA','Chave já utilizada para outro comando.')
            return anterior.resposta,anterior.status_http
        rascunho_da_empresa(empresa,d0.rascunho_id,True)
        # Bloqueia os vinculos antes do despacho, na mesma ordem da revisao/revogacao.
        if d0.estado=='PREPARADA': conferir(d0,empresa)
        d=obter(empresa,id,True)
        if not d.simulado: raise ErroMTR('ESCRITA_SIGOR_BLOQUEADA','Transporte de escrita real permanece desabilitado nesta etapa.',403)
        worker=None
        if d.estado=='PREPARADA':
            if d.rascunho.frete_id is None and DespachoSIGOR.objects.filter(rascunho__empresa=empresa,rascunho__frete__isnull=True,estado__in=['EM_DESPACHO','INDETERMINADA']).exclude(pk=d.pk).exists():
                raise ErroMTR('RESULTADO_INDETERMINADO','Resolva a tentativa anterior antes de iniciar outra simulação/envio.')
            worker=uuid4(); d.trabalhador=worker; d.estado='EM_DESPACHO'; d.tentativas=1
            d.iniciada_em=timezone.now(); d.limite_trabalhador=d.iniciada_em+timedelta(seconds=60)
            d.save(); evento(d,'TENTATIVA_PERSISTIDA',simulado=True)
        elif d.estado=='EM_DESPACHO' and d.limite_trabalhador<=timezone.now():
            d.estado='INDETERMINADA'; d.resultado={'codigo':'TRABALHADOR_INTERROMPIDO','simulado':True}; d.save()
            evento(d,'TRABALHADOR_RECUPERADO',estado=d.estado)
        ReciboMTR.objects.create(empresa=empresa,chave=chave,operacao=operacao,resumo=resumo,resposta=ack,status_http=202)
    if worker is None: return ack,202
    # Neste ponto claim, referencia, revisao e recibo ja estao COMMITADOS.
    try:
        from mtr.sigor.emissao_controlada import SimuladorAPI10Produto, ClienteEmissaoSIGOR
        port=transporte or (SimuladorAPI10Produto(cenario) if d.rascunho.frete_id is None else TransporteDespachoSimulado(cenario))
        if not isinstance(port,TransporteDespachoSimulado) or port.rede_real is not False: raise PermissionError()
        resposta=port.enviar(d.payload_wire)
        resultado=ClienteEmissaoSIGOR().interpretar(resposta,d.payload_wire,d.revisao.snapshot['vinculos']['GERADOR']) if d.rascunho.frete_id is None else interpretar_emissao(resposta,json.loads(d.payload_wire,parse_float=Decimal),d.revisao.snapshot['vinculos']['GERADOR'])
    except Exception: resultado=incerto('FALHA_APOS_CLAIM')
    _finalizar(empresa,id,worker,resultado)
    return ack,202

def recuperar_interrompido(empresa,id):
    atual=obter(empresa,id)
    if atual.estado!='EM_DESPACHO' or atual.limite_trabalhador>timezone.now(): return despacho_dto(atual)
    fora_atomic()
    with transaction.atomic(durable=True):
        empresa_lock(empresa); d=obter(empresa,id,True)
        if d.estado=='EM_DESPACHO' and d.limite_trabalhador<=timezone.now():
            d.estado='INDETERMINADA'; d.resultado={'codigo':'TRABALHADOR_INTERROMPIDO','simulado':d.simulado}; d.save()
            evento(d,'TRABALHADOR_RECUPERADO',estado=d.estado)
        return despacho_dto(d)

def reconciliar(empresa,id,op,*,transporte=None):
    fora_atomic(); recuperar_interrompido(empresa,id)
    with transaction.atomic(durable=True):
        empresa_lock(empresa); operador_transacional(op,empresa,'pode_autorizar'); d=obter(empresa,id,True)
        if d.estado in {'CONFIRMADA','REJEITADA'}: return despacho_dto(d)
        if d.estado!='INDETERMINADA': raise ErroMTR('CONSULTA_NAO_APLICAVEL','Consulte após uma tentativa indeterminada; não consulte uma preparação sem envio ou um trabalhador ativo.')
        gerador=d.revisao.snapshot['vinculos']['GERADOR']
        vinculo=obter_vinculo(empresa,gerador['id'],'GERADOR')
        consulta=ConsultaReferencia(vinculo.unidade,d.referencia)
        wire=d.payload_wire; payload=json.loads(wire,parse_float=Decimal)
    # API20 e consultiva, porem tambem exige liberacao individual de rede/op.
    cliente=None
    try:
        if d.simulado:
            port=transporte or TransporteDespachoSimulado()
            if not isinstance(port,TransporteDespachoSimulado) or port.rede_real is not False: raise PermissionError()
            resposta=port.consultar(wire,consulta,gerador)
        else:
            cliente,simulado=cliente_leitura(empresa,vinculo,'consultar-referencia',op)
            if simulado: raise ErroSeguro('OPERACAO_BLOQUEADA')
            cliente.autenticar(); resposta=cliente.consultar_referencia(consulta)
        resultado=interpretar_consulta(resposta,payload,gerador)
    except Exception: resultado=incerto('CONSULTA_INCONCLUSIVA')
    finally:
        if cliente: cliente.fechar()
    with transaction.atomic(durable=True):
        empresa_lock(empresa); atual=obter(empresa,id,True)
        if atual.estado!='INDETERMINADA': return despacho_dto(atual)
        if resultado.estado=='CONFIRMADA':
            atual.estado='CONFIRMADA'; atual.resultado={**asdict(resultado),'simulado':atual.simulado}; atual.save()
        evento(atual,'RECONCILIACAO_CONSULTIVA',codigo=resultado.codigo,estado=atual.estado,novo_envio_permitido=False,simulado=atual.simulado)
        return despacho_dto(atual)
