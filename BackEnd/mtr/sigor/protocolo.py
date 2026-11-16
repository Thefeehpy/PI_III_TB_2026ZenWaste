"""API10/API20 historicas: parse fechado, sem reaproveitar envelope de catalogos."""
from dataclasses import dataclass
from decimal import Decimal
import json
import http.client
import re
import ssl
import time
import urllib.error
import urllib.request
from mtr.sigor.privacidade import Segredo,json_estrito,ErroSeguro
from mtr.sigor.leitura import BASE_HOMOLOGACAO,SemRedirecionamento,RespostaPrivada,LIMITE_RESPOSTA,token_privado

@dataclass(frozen=True)
class ResultadoSIGOR:
    estado: str
    codigo: str
    numero_nacional: str | None = None
    numero_estadual: str | None = None
    validacoes: dict | None = None

def incerto(codigo='RESPOSTA_NAO_COMPROVADA',**kw): return ResultadoSIGOR('INDETERMINADA',codigo,**kw)
def numero(v):
    if v is None: return None
    if type(v) is int: v=str(v)
    if not isinstance(v,str) or not v.isascii() or not v.isdigit() or not 1<=len(v)<=32 or int(v)<=0: raise ValueError()
    return v

def mesmo_numero(a,b):
    if isinstance(a,bool) or not isinstance(a,(int,str,Decimal)) or isinstance(b,bool): return False
    try: return Decimal(str(a)).is_finite() and Decimal(str(a))==Decimal(str(b))
    except Exception: return False

def parte_emissao(p,esperada):
    return isinstance(p,dict) and type(p.get('unidade')) is int and p['unidade']==esperada['unidade'] and p.get('cpfCnpj')==esperada['cpfCnpj']

def interpretar_emissao(resposta,payload,gerador=None):
    try:
        data=resposta._json()
        if not isinstance(data,dict) or type(data.get('erroNacional')) is not bool: return incerto('ENVELOPE_API10_INCOMPATIVEL')
        lote=data.get('respostaApiwsManifestoDTO')
        if not isinstance(lote,list) or len(lote)!=1 or not isinstance(lote[0],dict): return incerto('LOTE_INCOMPATIVEL')
        m=lote[0]; esperado=payload[0]
        nacional=numero(m.get('manifestoNumeroNacional')); estadual=numero(m.get('manifestoNumeroEstadual'))
        numeros={'numero_nacional':nacional,'numero_estadual':estadual}
        if m.get('nomeResponsavel')!=esperado['nomeResponsavel'] or ('seuCodigo' in m and m['seuCodigo']!=esperado['seuCodigo']): return incerto('MANIFESTO_DIVERGENTE',**numeros)
        if m.get('gerador') is not None and (gerador is None or not parte_emissao(m['gerador'],{'unidade':gerador['unidade'],'cpfCnpj':gerador['cpf_cnpj']})): return incerto('GERADOR_DIVERGENTE',**numeros)
        if not parte_emissao(m.get('transportador'),esperado['transportador']) or not parte_emissao(m.get('destinador'),esperado['destinador']): return incerto('PARTICIPANTE_DIVERGENTE',**numeros)
        if m.get('armazenadorTemporario') is not None or (m.get('possuiArmazenamentoTemporario') is not None and m['possuiArmazenamentoTemporario'] is not False): return incerto('AT_FORA_ESCOPO',**numeros)
        itens=m.get('listaManifestoResiduos')
        if not isinstance(itens,list) or len(itens)!=1 or not isinstance(itens[0],dict): return incerto('ITEM_INCOMPATIVEL',**numeros)
        item=itens[0]; ei=esperado['listaManifestoResiduos'][0]
        if any(item.get(k)!=ei[k] or type(item.get(k)) is not type(ei[k]) for k in ['resCodigoIbama','uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo']) or not mesmo_numero(item.get('marQuantidade'),ei['marQuantidade']): return incerto('ITEM_DIVERGENTE',**numeros)
        flags={'manifesto':m.get('restResponseValido'),'transportador':m['transportador'].get('restResponseValido'),'destinador':m['destinador'].get('restResponseValido'),'item':item.get('restResponseValido'),'erro_nacional':data['erroNacional']}
        if any(type(v) is not bool for v in flags.values()): return incerto('VALIDACAO_AUSENTE',**numeros)
        if not flags['erro_nacional'] and all(flags[k] for k in ['manifesto','transportador','destinador','item']) and (nacional or estadual): return ResultadoSIGOR('CONFIRMADA','API10_CONFIRMADA',validacoes=flags,**numeros)
        if not flags['erro_nacional'] and flags['manifesto'] is False and not nacional and not estadual: return ResultadoSIGOR('REJEITADA','API10_REJEITADA',validacoes=flags)
        return incerto('RETORNO_PARCIAL_OU_INCONSISTENTE',validacoes=flags,**numeros)
    except Exception: return incerto('RESPOSTA_API10_INVALIDA')

def interpretar_consulta(resposta,payload,gerador):
    try:
        data=resposta._json()
        if not isinstance(data,dict) or data.get('erro') is not False or not isinstance(data.get('objetoResposta'),dict): return incerto('CONSULTA_INCONCLUSIVA')
        m=data['objetoResposta']; esperado=payload[0]
        nacional=numero(m.get('manNumero')); estadual=numero(m.get('manNumeroEstadual'))
        if not nacional and not estadual: return incerto('CONSULTA_SEM_NUMERO')
        if m.get('manResponsavel')!=esperado['nomeResponsavel']: return incerto('CONSULTA_RESPONSAVEL_DIVERGENTE')
        for campo,p in [('parceiroGerador',{'cpfCnpj':gerador['cpf_cnpj'],'unidade':gerador['unidade']}),('parceiroTransportador',esperado['transportador']),('parceiroDestinador',esperado['destinador'])]:
            r=m.get(campo)
            if not isinstance(r,dict) or r.get('parCnpj')!=p['cpfCnpj'] or type(r.get('parCodigo')) is not int or r['parCodigo']!=p['unidade']: return incerto('CONSULTA_PARTICIPANTE_DIVERGENTE')
        at=m.get('parceiroArmazenadorTemporario')
        if at is not None and (not isinstance(at,dict) or at.get('parCnpj') is not None or at.get('parCodigo') is not None): return incerto('CONSULTA_AT_FORA_ESCOPO')
        itens=m.get('listaManifestoResiduo')
        if not isinstance(itens,list) or len(itens)!=1: return incerto('CONSULTA_ITEM_INCOMPATIVEL')
        r=itens[0]; e=esperado['listaManifestoResiduos'][0]
        for campo,chave in [('residuo','resCodigoIbama'),('unidade','uniCodigo'),('tratamento','traCodigo'),('tipoEstado','tieCodigo'),('tipoAcondicionamento','tiaCodigo'),('classe','claCodigo')]:
            v=r.get(campo)
            if not isinstance(v,dict) or v.get(chave)!=e[chave] or type(v.get(chave)) is not type(e[chave]): return incerto('CONSULTA_ITEM_DIVERGENTE')
        if not mesmo_numero(r.get('marQuantidade'),e['marQuantidade']): return incerto('CONSULTA_QUANTIDADE_DIVERGENTE')
        return ResultadoSIGOR('CONFIRMADA','API20_CORRESPONDENCIA_ENCONTRADA',nacional,estadual)
    except Exception: return incerto('CONSULTA_INCONCLUSIVA')

class RequisicaoEmissaoSIGOR:
    __slots__=('__wire','__token')
    def __init__(self,wire,token):
        if not isinstance(wire,str) or len(wire.encode())>65536 or not isinstance(token,Segredo): raise ErroSeguro('PARAMETRO_INVALIDO')
        data=json_estrito(wire)
        if not isinstance(data,list) or len(data)!=1: raise ErroSeguro('PARAMETRO_INVALIDO')
        self.__wire=wire; self.__token=token_privado(token._revelar_ao_transporte())
    def __repr__(self): return '<RequisicaoEmissaoSIGOR privada; escrita bloqueada>'
    def _para_http(self):
        return BASE_HOMOLOGACAO+'/salvarManifestoLote','POST',{'Content-Type':'application/json; charset=utf-8','Accept':'application/json','Authorization':'Bearer '+self.__token._revelar_ao_transporte()},self.__wire.encode()

class AdaptadorEmissaoSIGORBloqueado:
    rede_real=True
    def preparar_requisicao(self,wire,token): return RequisicaoEmissaoSIGOR(wire,token)
    def enviar(self,requisicao,*args,**kwargs):
        if type(requisicao) is not RequisicaoEmissaoSIGOR or args or kwargs: raise PermissionError('ESCRITA_SIGOR_DESABILITADA_MTR02')
        url,metodo,headers,body=requisicao._para_http()
        from hashlib import sha256
        try:ref=json_estrito(body.decode('utf-8'))[0]['seuCodigo']
        except Exception:raise PermissionError('ESCRITA_SIGOR_DESABILITADA_MTR02') from None
        if not politica_escrita_permite(referencia=ref,payload_sha256=sha256(body).hexdigest()): raise PermissionError('ESCRITA_SIGOR_DESABILITADA_MTR02')
        if url!=BASE_HOMOLOGACAO+'/salvarManifestoLote' or metodo!='POST' or not isinstance(body,bytes): raise ErroSeguro('OPERACAO_BLOQUEADA')
        contexto=ssl.create_default_context();contexto.minimum_version=ssl.TLSVersion.TLSv1_2
        contexto.check_hostname=True;contexto.verify_mode=ssl.CERT_REQUIRED
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),SemRedirecionamento(),urllib.request.HTTPSHandler(context=contexto,debuglevel=0))
        req=urllib.request.Request(url,data=body,headers=headers,method='POST')
        http.client.HTTPConnection.debuglevel=0;http.client.HTTPSConnection.debuglevel=0
        try:
            with opener.open(req,timeout=15) as r:
                if r.geturl()!=url or 300<=r.status<400: raise ErroSeguro('REDIRECIONAMENTO_BLOQUEADO',status_http=r.status)
                if r.status!=200: raise ErroSeguro('HTTP_INESPERADO',status_http=r.status)
                tipo=r.headers.get('Content-Type','')
                if not re.match(r'^application/json(?:\s*;|$)',tipo,re.I): raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
                total=0;partes=[];inicio=time.monotonic()
                while True:
                    chunk=r.read(min(65536,LIMITE_RESPOSTA+1-total))
                    if not chunk: break
                    total+=len(chunk)
                    if total>LIMITE_RESPOSTA or time.monotonic()-inicio>30: raise ErroSeguro('LIMITE_DE_RESPOSTA')
                    partes.append(chunk)
                return RespostaPrivada(200,tipo,b''.join(partes))
        except ErroSeguro: raise
        except urllib.error.HTTPError as e:
            status=e.code
            try:e.close()
            except Exception:pass
            raise ErroSeguro('HTTP_INESPERADO',status_http=status) from None
        except Exception: raise ErroSeguro('FALHA_DE_TRANSPORTE') from None

def politica_escrita_permite(**contexto):
    """Negada por padrão; somente liberação específica + concessão vigente, nunca flag genérica."""
    try:
        from mtr.sigor.ativacao_api10 import permite
        return permite(**contexto)
    except Exception:return False
