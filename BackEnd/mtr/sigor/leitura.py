"""Cliente restrito a autenticacao, catalogos e consulta API20 da homologacao SIGOR.

Derivado do cliente externo preservado; nenhuma operacao governamental de escrita.
"""
from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from urllib.parse import quote
import http.client
import json
import re
import ssl
import time
import urllib.error
import urllib.request

from .privacidade import CredenciaisSIGOR, Segredo, ErroSeguro, json_estrito, METODOS_POR_OPERACAO

BASE_HOMOLOGACAO = 'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest'
LIMITE_RESPOSTA = 4 * 1024 * 1024


class Operacao(Enum):
    AUTENTICAR = 'autenticar'
    CLASSES = 'classes'
    UNIDADES_MEDIDA = 'unidades-medida'
    TRATAMENTOS = 'tratamentos'
    ESTADOS_FISICOS = 'estados-fisicos'
    ACONDICIONAMENTOS = 'acondicionamentos'
    RESIDUOS = 'residuos'
    CLASSES_POR_RESIDUO = 'classes-por-residuo'
    ACONDICIONAMENTOS_POR_ESTADO = 'acondicionamentos-por-estado'
    CONSULTAR_REFERENCIA = 'consultar-referencia'


# Rotas fixas. O perfil GET se aplica somente a classes; demais métodos foram preservados.
CAMINHOS = MappingProxyType({
    Operacao.AUTENTICAR: '/gettoken',
    Operacao.CLASSES: '/retornaListaClasse',
    Operacao.UNIDADES_MEDIDA: '/retornaListaUnidade',
    Operacao.TRATAMENTOS: '/retornaListaTratamento',
    Operacao.ESTADOS_FISICOS: '/retornaListaEstadoFisico',
    Operacao.ACONDICIONAMENTOS: '/retornaListaAcondicionamento',
    Operacao.RESIDUOS: '/retornaListaResiduo',
    Operacao.CLASSES_POR_RESIDUO: '/retornaListaClassePorResiduo',
    Operacao.ACONDICIONAMENTOS_POR_ESTADO: '/retornaListaAcondicionamentoPorEstadoFisico',
    Operacao.CONSULTAR_REFERENCIA: '/retornaManifestoSeuCodigo',
})


def metodo_http(operacao):
    """Método fechado por operação, compartilhado pelo envio e diagnóstico seguro."""
    if not isinstance(operacao, Operacao): raise ErroSeguro('OPERACAO_BLOQUEADA')
    return METODOS_POR_OPERACAO[operacao.value]


def validar_operacao(operacao, parametro=None):
    if not isinstance(operacao, Operacao) or operacao not in CAMINHOS: raise ErroSeguro('OPERACAO_BLOQUEADA')
    if operacao == Operacao.CONSULTAR_REFERENCIA:
        if not isinstance(parametro, ConsultaReferencia): raise ErroSeguro('PARAMETRO_INVALIDO')
    elif operacao == Operacao.CLASSES_POR_RESIDUO:
        if not isinstance(parametro, str) or not re.fullmatch(r'[0-9]{6}(?:\*|\(\*\))?', parametro): raise ErroSeguro('PARAMETRO_INVALIDO')
    elif operacao == Operacao.ACONDICIONAMENTOS_POR_ESTADO:
        if not isinstance(parametro, str) or not re.fullmatch(r'[0-9]{1,12}', parametro): raise ErroSeguro('PARAMETRO_INVALIDO')
    elif parametro is not None: raise ErroSeguro('PARAMETRO_INVALIDO')


def url_permitida(operacao, parametro=None):
    validar_operacao(operacao, parametro)
    path = CAMINHOS[operacao]
    if parametro is not None and operacao != Operacao.CONSULTAR_REFERENCIA: path += '/' + quote(parametro, safe='')
    return BASE_HOMOLOGACAO + path


class RequisicaoPrivada:
    __slots__ = ('operacao', 'parametro', '__credenciais', '__token')
    def __init__(self, operacao, *, parametro=None, credenciais=None, token=None):
        validar_operacao(operacao, parametro)
        if operacao == Operacao.AUTENTICAR:
            if not isinstance(credenciais, CredenciaisSIGOR) or token is not None: raise ErroSeguro('OPERACAO_BLOQUEADA')
        elif not isinstance(token, Segredo) or credenciais is not None: raise ErroSeguro('SESSAO_AUSENTE')
        self.operacao = operacao; self.parametro = parametro
        self.__credenciais = credenciais; self.__token = token
    def __repr__(self): return '<RequisicaoPrivada SIGOR: conteúdo/cabeçalhos omitidos>'
    def __str__(self): return self.__repr__()
    def _para_http(self):
        url = url_permitida(self.operacao, self.parametro)
        metodo = metodo_http(self.operacao)
        headers = {'Accept': 'application/json'}
        if metodo == 'POST': headers['Content-Type'] = 'application/json; charset=utf-8'
        body = None
        if self.operacao == Operacao.AUTENTICAR:
            body = json.dumps(self.__credenciais._payload_autenticacao(), ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        else:
            headers['Authorization'] = 'Bearer ' + self.__token._revelar_ao_transporte()
            if self.operacao == Operacao.CONSULTAR_REFERENCIA:
                body=json.dumps({'suaUnidade':self.parametro.unidade,'seuCodigo':self.parametro.referencia},separators=(',',':')).encode()
        return url, metodo, headers, body


@dataclass(frozen=True, repr=False)
class ConsultaReferencia:
    unidade: int
    referencia: str
    def __post_init__(self):
        if type(self.unidade) is not int or not 1<=self.unidade<=2147483647 or not isinstance(self.referencia,str) or not re.fullmatch(r'[A-Za-z0-9-]{1,30}',self.referencia):
            raise ErroSeguro('PARAMETRO_INVALIDO')
    def __repr__(self): return '<ConsultaReferencia privada>'


class RespostaPrivada:
    __slots__ = ('status', 'tipo_conteudo', '__conteudo')
    def __init__(self, status, tipo_conteudo, conteudo):
        self.status = status; self.tipo_conteudo = tipo_conteudo; self.__conteudo = conteudo
    def __repr__(self): return '<RespostaPrivada SIGOR: conteúdo omitido>'
    def __str__(self): return self.__repr__()
    def _json(self):
        if type(self.status) is not int or self.status != 200: raise ErroSeguro('HTTP_INESPERADO', status_http=self.status)
        if not isinstance(self.tipo_conteudo, str) or not re.match(r'^application/json(?:\s*;|$)', self.tipo_conteudo, re.I):
            raise ErroSeguro('RESPOSTA_INCOMPATIVEL', status_http=self.status)
        if not isinstance(self.__conteudo, bytes) or len(self.__conteudo) > LIMITE_RESPOSTA: raise ErroSeguro('LIMITE_DE_RESPOSTA')
        try: return json_estrito(self.__conteudo.decode('utf-8-sig'))
        except Exception: raise ErroSeguro('RESPOSTA_INCOMPATIVEL', status_http=self.status) from None


class SemRedirecionamento(urllib.request.HTTPRedirectHandler):
    def http_error_302(self, req, fp, code, msg, headers):
        if fp is not None:
            try: fp.close()
            except Exception: pass
        raise ErroSeguro('REDIRECIONAMENTO_BLOQUEADO', status_http=code) from None
    http_error_301 = http_error_302
    http_error_303 = http_error_302
    http_error_307 = http_error_302
    http_error_308 = http_error_302


class TransporteHTTPSHomologacao:
    rede_real = True
    def __init__(self, *, autorizacao_explicita=False):
        if autorizacao_explicita is not True: raise ErroSeguro('REDE_NAO_AUTORIZADA')
        contexto = ssl.create_default_context()
        contexto.minimum_version = ssl.TLSVersion.TLSv1_2
        contexto.check_hostname = True
        contexto.verify_mode = ssl.CERT_REQUIRED
        self.__opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SemRedirecionamento(),
            urllib.request.HTTPSHandler(context=contexto, debuglevel=0))

    def enviar(self, requisicao):
        if not isinstance(requisicao, RequisicaoPrivada): raise ErroSeguro('OPERACAO_BLOQUEADA')
        url, metodo, headers, body = requisicao._para_http()
        # Sem URL configurável, query, proxy de ambiente, cookie, redirects, retry ou fallback.
        if url != url_permitida(requisicao.operacao, requisicao.parametro) or metodo != metodo_http(requisicao.operacao):
            raise ErroSeguro('OPERACAO_BLOQUEADA')
        if metodo == 'GET' and body is not None: raise ErroSeguro('OPERACAO_BLOQUEADA')
        req = urllib.request.Request(url, data=body, headers=headers, method=metodo)
        http.client.HTTPConnection.debuglevel = 0
        http.client.HTTPSConnection.debuglevel = 0
        try:
            with self.__opener.open(req, timeout=15) as r:
                status = r.status
                if r.geturl() != url or 300 <= status < 400: raise ErroSeguro('REDIRECIONAMENTO_BLOQUEADO', status_http=status)
                if status in {401, 403}: raise ErroSeguro('ACESSO_REJEITADO', status_http=status)
                if status != 200: raise ErroSeguro('HTTP_INESPERADO', status_http=status)
                tipo = r.headers.get('Content-Type', '')
                if not re.match(r'^application/json(?:\s*;|$)', tipo, re.I): raise ErroSeguro('RESPOSTA_INCOMPATIVEL', status_http=status)
                chunks = []; total = 0; inicio = time.monotonic()
                while True:
                    chunk = r.read(min(65536, LIMITE_RESPOSTA + 1 - total))
                    if not chunk: break
                    total += len(chunk)
                    if total > LIMITE_RESPOSTA: raise ErroSeguro('LIMITE_DE_RESPOSTA')
                    if time.monotonic() - inicio > 30: raise ErroSeguro('FALHA_DE_TRANSPORTE')
                    chunks.append(chunk)
                return RespostaPrivada(status, tipo, b''.join(chunks))
        except ErroSeguro: raise
        except urllib.error.HTTPError as e:
            code = e.code
            try: e.close()
            except Exception: pass
            if 300 <= code < 400: raise ErroSeguro('REDIRECIONAMENTO_BLOQUEADO', status_http=code) from None
            if code in {401, 403}: raise ErroSeguro('ACESSO_REJEITADO', status_http=code) from None
            raise ErroSeguro('HTTP_INESPERADO', status_http=code) from None
        except (ssl.SSLError, ssl.CertificateError): raise ErroSeguro('TLS_NAO_VALIDADO') from None
        except urllib.error.URLError as e:
            categoria = 'TLS_NAO_VALIDADO' if isinstance(e.reason, ssl.SSLError) else 'FALHA_DE_TRANSPORTE'
            raise ErroSeguro(categoria) from None
        except Exception: raise ErroSeguro('FALHA_DE_TRANSPORTE') from None


def formato(v):
    if v is None: return 'nulo'
    if isinstance(v, bool): return 'booleano'
    if isinstance(v, dict): return 'objeto'
    if isinstance(v, list): return 'lista'
    if isinstance(v, str): return 'texto'
    if isinstance(v, (int, float)): return 'numero'
    return 'outro'


def envelope(resposta, *, autenticacao=False):
    data = resposta._json()
    if not isinstance(data, dict) or type(data.get('erro')) is not bool or 'objetoResposta' not in data:
        raise ErroSeguro('RESPOSTA_INCOMPATIVEL', status_http=200, formato=formato(data))
    if data['erro']:
        raise ErroSeguro('AUTENTICACAO_REJEITADA' if autenticacao else 'CATALOGO_REJEITADO', status_http=200, codigo_api=data.get('mensagem'))
    return data['objetoResposta']


def token_privado(valor):
    if not isinstance(valor, str): raise ErroSeguro('RESPOSTA_INCOMPATIVEL', formato=formato(valor))
    token = valor.strip(' \t')
    if token.lower() == 'bearer': raise ErroSeguro('RESPOSTA_INCOMPATIVEL', formato='texto')
    if token.lower().startswith('bearer '): token = token[7:]
    if not 1 <= len(token) <= 8192 or not re.fullmatch(r'[A-Za-z0-9._~+/-]+={0,}', token):
        raise ErroSeguro('RESPOSTA_INCOMPATIVEL', formato='texto')
    return Segredo(token)


@dataclass(frozen=True)
class ResumoCatalogo:
    operacao: str
    quantidade_itens: int
    status_http: int = 200


class CatalogoPrivado:
    __slots__ = ('resumo', '__itens')
    def __init__(self, operacao, itens): self.resumo = ResumoCatalogo(operacao.value, len(itens)); self.__itens = itens
    def __repr__(self): return f'<CatalogoPrivado: {self.resumo.quantidade_itens} itens; conteúdo omitido>'
    def __str__(self): return self.__repr__()
    def para_consumo_local_sem_log(self):
        # Acesso explícito apenas para integração futura revisada. O CLI nunca exibe/salva itens brutos.
        return json.loads(json.dumps(self.__itens, ensure_ascii=False))


class ClienteSIGORLeitura:
    def __init__(self, credenciais, transporte):
        if not isinstance(credenciais, CredenciaisSIGOR): raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
        self.__credenciais = credenciais; self.__transporte = transporte; self.__token = None
    def __repr__(self): return '<ClienteSIGORLeitura: contexto privado e operações limitadas>'
    def __str__(self): return self.__repr__()

    def autenticar(self):
        self.__token = None
        try:
            resposta = self.__transporte.enviar(RequisicaoPrivada(Operacao.AUTENTICAR, credenciais=self.__credenciais))
            self.__token = token_privado(envelope(resposta, autenticacao=True))
            return True
        except ErroSeguro as e:
            raise e.com_contexto_operacao(Operacao.AUTENTICAR.value, metodo_http(Operacao.AUTENTICAR)) from None
        except Exception:
            raise ErroSeguro('FALHA_DE_TRANSPORTE').com_contexto_operacao(Operacao.AUTENTICAR.value, metodo_http(Operacao.AUTENTICAR)) from None

    def consultar_catalogo(self, operacao, *, parametro=None):
        validar_operacao(operacao, parametro)
        if operacao in {Operacao.AUTENTICAR,Operacao.CONSULTAR_REFERENCIA}: raise ErroSeguro('OPERACAO_BLOQUEADA')
        if self.__token is None: raise ErroSeguro('SESSAO_AUSENTE')
        try:
            resposta = self.__transporte.enviar(RequisicaoPrivada(operacao, parametro=parametro, token=self.__token))
            itens = envelope(resposta)
            # Perfil tolera apenas lista ou JSON textual que contém lista; demais envelopes falham fechados.
            if isinstance(itens, str):
                try: itens = json_estrito(itens)
                except Exception: raise ErroSeguro('RESPOSTA_INCOMPATIVEL', formato='texto') from None
            if not isinstance(itens, list) or len(itens) > 100000 or any(not isinstance(i, dict) for i in itens):
                raise ErroSeguro('RESPOSTA_INCOMPATIVEL', formato=formato(itens))
            privados = (*self.__credenciais._valores_para_protecao()[:2], self.__token._revelar_ao_transporte())
            def checar(v, depth=0):
                if depth > 30: raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
                if isinstance(v, dict):
                    for k, val in v.items():
                        if str(k).lower() in {'senha', 'password', 'token', 'authorization', 'cpfcnpj', 'cpf', 'cnpj'}:
                            raise ErroSeguro('RESPOSTA_SENSIVEL_BLOQUEADA')
                        checar(val, depth + 1)
                elif isinstance(v, list):
                    for val in v: checar(val, depth + 1)
                elif isinstance(v, str) and any(p and p in v for p in privados):
                    raise ErroSeguro('RESPOSTA_SENSIVEL_BLOQUEADA')
            checar(itens)
            return CatalogoPrivado(operacao, itens)
        except ErroSeguro as e:
            if e.status_http in {401, 403}: self.__token = None
            raise e.com_contexto_operacao(operacao.value, metodo_http(operacao)) from None
        except Exception:
            raise ErroSeguro('FALHA_DE_TRANSPORTE').com_contexto_operacao(operacao.value, metodo_http(operacao)) from None

    def fechar(self): self.__token = None

    def consultar_referencia(self,consulta):
        validar_operacao(Operacao.CONSULTAR_REFERENCIA,consulta)
        if self.__token is None: raise ErroSeguro('SESSAO_AUSENTE')
        if consulta.unidade!=int(self.__credenciais._payload_autenticacao()['unidade']): raise ErroSeguro('OPERACAO_BLOQUEADA')
        try:
            return self.__transporte.enviar(RequisicaoPrivada(Operacao.CONSULTAR_REFERENCIA,parametro=consulta,token=self.__token))
        except ErroSeguro as e:
            raise e.com_contexto_operacao('consultar-referencia','POST') from None
        except Exception:
            raise ErroSeguro('FALHA_DE_TRANSPORTE').com_contexto_operacao('consultar-referencia','POST') from None
