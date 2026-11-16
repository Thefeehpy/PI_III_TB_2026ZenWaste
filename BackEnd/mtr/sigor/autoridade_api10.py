"""Autoridade API10 exclusivamente server-side; não acessa arquivos nem a autoridade Q2."""
import base64
import hashlib
import hmac
import json
import os
import re
from mtr.servicos_mvp import ErroMTR
from mtr.sigor.emissao_controlada import AutoridadeEmissaoAPI10

DOMINIO=b'ZENWASTE:SIGOR:API10:CONCESSAO:v1\x00'


def _mensagem(escopo):
    if not isinstance(escopo,dict) or escopo.get('finalidade')!='API10_EMISSAO_HOMOLOGACAO' or escopo.get('ambiente')!='https://mtrr-hom.cetesb.sp.gov.br/apiws/rest' or escopo.get('metodo')!='POST' or escopo.get('rota')!='/salvarManifestoLote' or type(escopo.get('max_tentativas')) is not int or escopo['max_tentativas']!=1:
        raise ErroMTR('ESCOPO_API10_INVALIDO','A autoridade aceita somente concessão API10 específica de homologação.',403)
    try:return DOMINIO+json.dumps(escopo,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
    except Exception:raise ErroMTR('ESCOPO_API10_INVALIDO','Escopo não canônico.',422) from None


def _chave_ambiente():
    # Executado somente pelo servidor/processo pessoal autorizado; nunca inspecionado pelo Codex.
    try:
        chave=base64.b64decode(os.environ['MTR_SIGOR_API10_CHAVE_B64'],validate=True)
        if not 32<=len(chave)<=128 or len(set(chave))<16:raise ValueError()
        return chave
    except Exception:raise ErroMTR('AUTORIDADE_API10_INDISPONIVEL','Chave própria API10 não configurada com segurança no processo servidor.',403) from None


class AutoridadeHMACAPI10(AutoridadeEmissaoAPI10):
    def __init__(self,provedor_chave=None):self.__provedor=provedor_chave or _chave_ambiente
    def __repr__(self):return '<Autoridade API10; segredo omitido; independente de Q2>'
    def assinar(self,escopo):
        mensagem=_mensagem(escopo);chave=self.__provedor()
        if not isinstance(chave,bytes) or len(chave)<32:raise ErroMTR('AUTORIDADE_API10_INDISPONIVEL','Material de assinatura indisponível.',403)
        return 'api10-hmac-v1:'+hmac.new(chave,mensagem,hashlib.sha256).hexdigest()
    def verificar(self,escopo,assinatura):
        if not isinstance(assinatura,str) or not re.fullmatch('api10-hmac-v1:[0-9a-f]{64}',assinatura):
            raise ErroMTR('ASSINATURA_API10_INVALIDA','Assinatura específica API10 inválida.',403)
        if not hmac.compare_digest(self.assinar(escopo),assinatura):
            raise ErroMTR('ASSINATURA_API10_INVALIDA','Assinatura não corresponde ao escopo.',403)
