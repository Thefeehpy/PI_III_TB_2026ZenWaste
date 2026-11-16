"""Configuracao resolvida no servidor por empresa/unidade. Nenhum arquivo privado e aberto."""
import os
import re
from dataclasses import dataclass
from django.conf import settings
from mtr.sigor.leitura import ClienteSIGORLeitura,TransporteHTTPSHomologacao
from mtr.sigor.privacidade import CredenciaisSIGOR,ErroSeguro
from mtr.sigor_contrato import identificador

@dataclass(frozen=True,repr=False)
class ContaServidor:
    empresa_id: int
    operador_id: int
    unidade: int
    gerador_cnpj: str
    credencial_ref: str
    def __repr__(self): return '<Conta SIGOR privada e vinculada>'

def conta_da_empresa(empresa,vinculo,operador):
    try:
        v=getattr(settings,'MTR_SIGOR_CONTAS',{}).get(str(empresa.pk))
        if not isinstance(v,dict) or set(v)!={'unidade','gerador_cnpj','credencial_ref','operador_id'}: raise ValueError()
        ref=v['credencial_ref']
        if not isinstance(ref,str) or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,63}',ref): raise ValueError()
        documento_empresa=identificador(empresa.cnpj)
        if type(v['unidade']) is not int or v['unidade']!=vinculo.unidade or v['gerador_cnpj']!=documento_empresa or vinculo.cpf_cnpj!=documento_empresa or vinculo.papel!='GERADOR' or vinculo.empresa_id!=empresa.pk: raise ValueError()
        if type(v['operador_id']) is not int or v['operador_id']!=operador.pk or operador.empresa_id!=empresa.pk or not operador.ativo: raise ValueError()
        return ContaServidor(empresa.pk,operador.pk,v['unidade'],v['gerador_cnpj'],ref)
    except Exception: raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA') from None

def provedor_ambiente(ref):
    """Chamado apenas em runtime autorizado. O Codex nao precisa ler valores reais."""
    if not isinstance(ref,str) or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,63}',ref): raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
    try:
        return CredenciaisSIGOR(os.environ[ref+'_CPF_CNPJ'],os.environ[ref+'_SENHA'],os.environ[ref+'_UNIDADE'])
    except Exception: raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA') from None

def cliente_leitura(empresa,vinculo,operacao,operador):
    # Operacoes precisam de liberacao individual no servidor, mesmo com rede habilitada.
    if operacao not in getattr(settings,'MTR_SIGOR_OPERACOES_LEITURA',()): raise ErroSeguro('REDE_NAO_AUTORIZADA')
    conta=conta_da_empresa(empresa,vinculo,operador)
    provedor=getattr(settings,'MTR_SIGOR_PROVEDOR_CREDENCIAL',provedor_ambiente)
    transporte_factory=getattr(settings,'MTR_SIGOR_TRANSPORTE_LEITURA',None)
    if transporte_factory is None:
        transporte=TransporteHTTPSHomologacao(autorizacao_explicita=getattr(settings,'MTR_SIGOR_REDE_LEITURA_AUTORIZADA',False))
    else:
        transporte=transporte_factory()
        if getattr(transporte,'rede_real',True) is not False: raise ErroSeguro('REDE_NAO_AUTORIZADA')
    try:
        credenciais=provedor(conta.credencial_ref)
        if not isinstance(credenciais,CredenciaisSIGOR) or int(credenciais._payload_autenticacao()['unidade'])!=conta.unidade: raise ValueError()
        return ClienteSIGORLeitura(credenciais,transporte),getattr(transporte,'rede_real',True) is False
    except Exception: raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA') from None
