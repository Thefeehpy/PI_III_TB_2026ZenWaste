"""Contrato API10 do produto. A porta governamental permanece fechada nesta entrega."""
from decimal import Decimal
from hashlib import sha256
import re
from django.utils import timezone
from mtr.sigor.privacidade import Segredo, json_estrito
from mtr.sigor.protocolo import RequisicaoEmissaoSIGOR, AdaptadorEmissaoSIGORBloqueado, interpretar_emissao, incerto
from mtr.sigor.simulacao import TransporteDespachoSimulado
from mtr.sigor_contrato import inteiro, identificador
from mtr.servicos_mvp import ErroMTR, hash_dados


def validar_wire(wire):
    if not isinstance(wire,str) or len(wire.encode())>65536:raise ValueError('PAYLOAD_INVALIDO')
    p=json_estrito(wire)
    if not isinstance(p,list) or len(p)!=1 or not isinstance(p[0],dict):raise ValueError('PAYLOAD_INVALIDO')
    m=p[0]
    if set(m)!={'nomeResponsavel','seuCodigo','transportador','destinador','listaManifestoResiduos'}:raise ValueError('PAYLOAD_INVALIDO')
    if not isinstance(m['nomeResponsavel'],str) or not m['nomeResponsavel'].strip() or len(m['nomeResponsavel'])>120 or any(ord(c)<32 for c in m['nomeResponsavel']):raise ValueError('PESSOA_INVALIDA')
    if not isinstance(m['seuCodigo'],str) or not re.fullmatch('[A-Za-z0-9-]{1,30}',m['seuCodigo']):raise ValueError('REFERENCIA_INVALIDA')
    for k in ['transportador','destinador']:
        v=m[k]
        if not isinstance(v,dict) or set(v)!={'cpfCnpj','unidade'} or type(v['unidade']) is not int:raise ValueError('PARTICIPANTE_INVALIDO')
        inteiro(v['unidade']);identificador(v['cpfCnpj'])
    itens=m['listaManifestoResiduos']
    if not isinstance(itens,list) or len(itens)!=1 or not isinstance(itens[0],dict):raise ValueError('ITEM_INVALIDO')
    i=itens[0]
    if set(i)!={'resCodigoIbama','marQuantidade','uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo'}:raise ValueError('ITEM_INVALIDO')
    if not isinstance(i['resCodigoIbama'],str) or not re.fullmatch('[0-9]{6}(?:[*]|[(][*][)])?',i['resCodigoIbama']):raise ValueError('CODIGO_INVALIDO')
    q=i['marQuantidade']
    if isinstance(q,bool) or not isinstance(q,(int,Decimal)) or not 0<q<Decimal('1000000000') or Decimal(q)!=Decimal(q).quantize(Decimal('.001')):raise ValueError('QUANTIDADE_INVALIDA')
    for k in ['uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo']:
        if type(i[k]) is not int:raise ValueError('CODIGO_INVALIDO')
        inteiro(i[k])
    return p


class ClienteEmissaoSIGOR:
    def preparar_requisicao(self,wire,token):
        validar_wire(wire)
        return RequisicaoEmissaoSIGOR(wire,token)

    def interpretar(self,resposta,wire,gerador=None):
        p=validar_wire(wire)
        try:
            if resposta._json()['respostaApiwsManifestoDTO'][0].get('seuCodigo')!=p[0]['seuCodigo']:
                return incerto('CORRELACAO_NAO_COMPROVADA')
        except Exception:return incerto('RESPOSTA_NAO_COMPROVADA')
        return interpretar_emissao(resposta,p,gerador)

    def enviar_governamental(self,requisicao,*args,**kwargs):
        # Policy remains false; no Q2 key, generic setting, request flag or admin bypass.
        return AdaptadorEmissaoSIGORBloqueado().enviar(requisicao,*args,**kwargs)


class SimuladorAPI10Produto(TransporteDespachoSimulado):
    """Same dispatcher, actual HTTP request contract, false transport without sockets."""
    def enviar(self,wire):
        req=ClienteEmissaoSIGOR().preparar_requisicao(wire,Segredo('SESSAO_FICTICIA_API10'))
        url,metodo,headers,body=req._para_http()
        if url!='https://mtrr-hom.cetesb.sp.gov.br/apiws/rest/salvarManifestoLote' or metodo!='POST' or body!=wire.encode() or 'Authorization' not in headers:
            raise ValueError('CONTRATO_HTTP_INVALIDO')
        return super().enviar(body.decode())


class AutoridadeEmissaoAPI10:
    """Interface server-side; não usa nem lê a autoridade HMAC Q2."""
    def verificar(self,escopo,assinatura):
        raise ErroMTR('AUTORIDADE_API10_INDISPONIVEL','Autoridade específica de emissão não configurada.',403)


def registrar_concessao(solicitacao,escopo,assinatura,autoridade):
    """No public endpoint. Called only by future trusted approval integration, never browser input."""
    from django.db import transaction
    from django.utils.dateparse import parse_datetime
    from mtr.models import ConcessaoEmissaoSIGOR
    if not isinstance(autoridade,AutoridadeEmissaoAPI10):raise ErroMTR('AUTORIDADE_API10_INDISPONIVEL','Autoridade de emissão necessária.',403)
    obrigatorios=set(solicitacao.escopo)|{'inicio','fim','aprovador','evidencia_aprovacao'}
    if not isinstance(escopo,dict) or set(escopo)!=obrigatorios:raise ErroMTR('CONCESSAO_INVALIDA','Escopo específico incompleto.',422)
    for k,v in solicitacao.escopo.items():
        if k not in {'inicio','fim','aprovador','evidencia_aprovacao'} and escopo[k]!=v:
            raise ErroMTR('CONCESSAO_DIVERGENTE','A autorização não corresponde à intenção/snapshot/conta.',422)
    try:
        inicio=parse_datetime(escopo['inicio']);fim=parse_datetime(escopo['fim'])
        if not inicio or not fim or timezone.is_naive(inicio) or timezone.is_naive(fim) or not inicio<=timezone.now()<fim or (fim-inicio).total_seconds()>86400:raise ValueError()
        if not isinstance(escopo['aprovador'],str) or not escopo['aprovador'] or not re.fullmatch('[0-9a-f]{64}',escopo['evidencia_aprovacao']):raise ValueError()
    except Exception:raise ErroMTR('CONCESSAO_INVALIDA','Janela, aprovador ou evidência inválidos.',422) from None
    autoridade.verificar(escopo,assinatura)
    if not isinstance(assinatura,str) or not 1<=len(assinatura)<=8192:raise ErroMTR('CONCESSAO_INVALIDA','Assinatura verificável necessária.',422)
    with transaction.atomic():
        from mtr.models import DespachoSIGOR
        d=DespachoSIGOR.objects.select_for_update().get(pk=solicitacao.despacho_id)
        if d.simulado or d.tentativas or d.estado!='PREPARADA':raise ErroMTR('INTENCAO_NAO_AUTORIZAVEL','A intenção não está disponível para um envio novo.')
        if hash_dados(solicitacao.escopo)!=solicitacao.resumo or d.resumo!=escopo['payload_sha256'] or d.revisao.resumo!=escopo['snapshot_sha256']:
            raise ErroMTR('INTEGRIDADE_INVALIDA','Hash da intenção/revisão mudou.')
        return ConcessaoEmissaoSIGOR.objects.create(solicitacao=solicitacao,escopo=escopo,
            assinatura_sha256=sha256(assinatura.encode()).hexdigest(),autoridade_referencia=escopo['aprovador'],valida_desde=inicio,valida_ate=fim)
