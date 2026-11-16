"""Primitivas de privacidade adaptadas do cliente externo, sem carregamento de arquivos."""
from types import MappingProxyType
import json
import re
from decimal import Decimal

# Somente nomes internos; nunca aceitar URL, parâmetro ou texto recebido do servidor.
METODOS_POR_OPERACAO = MappingProxyType({
    'autenticar': 'POST',
    'classes': 'GET',  # Perfil específico aprovado após 405 no POST; sem fallback.
    'unidades-medida': 'POST',
    'tratamentos': 'POST',
    'estados-fisicos': 'POST',
    'acondicionamentos': 'POST',
    'residuos': 'POST',
    'classes-por-residuo': 'POST',
    'acondicionamentos-por-estado': 'POST',
    'consultar-referencia': 'POST',
})
OPERACOES_DIAGNOSTICO = frozenset(METODOS_POR_OPERACAO)


class ErroSeguro(Exception):
    """Só códigos locais e metadados enumerados. Nunca armazena resposta, causa ou valor privado."""
    def __init__(self, categoria, *, status_http=None, codigo_api=None, formato=None,
        etapa=None, operacao=None, metodo_http=None):
        categorias = {
            'CONFIGURACAO_PRIVADA_INVALIDA', 'CAMINHO_PRIVADO_NAO_PERMITIDO', 'ENTRADA_OCULTA_INDISPONIVEL',
            'REDE_NAO_AUTORIZADA', 'OPERACAO_BLOQUEADA', 'PARAMETRO_INVALIDO', 'SESSAO_AUSENTE',
            'AUTENTICACAO_REJEITADA', 'ACESSO_REJEITADO', 'HTTP_INESPERADO', 'REDIRECIONAMENTO_BLOQUEADO',
            'FALHA_DE_TRANSPORTE', 'TLS_NAO_VALIDADO', 'RESPOSTA_INCOMPATIVEL', 'LIMITE_DE_RESPOSTA',
            'CATALOGO_REJEITADO', 'RESPOSTA_SENSIVEL_BLOQUEADA',
        }
        self.categoria = categoria if categoria in categorias else 'RESPOSTA_INCOMPATIVEL'
        self.status_http = status_http if type(status_http) is int and 100 <= status_http <= 599 else None
        self.codigo_api = codigo_api if isinstance(codigo_api, str) and re.fullmatch(r'[0-9]{3}', codigo_api) else None
        self.formato = formato if formato in {'objeto', 'lista', 'texto', 'booleano', 'numero', 'nulo', 'outro'} else None
        contexto_valido = (isinstance(operacao, str) and operacao in OPERACOES_DIAGNOSTICO
            and etapa == ('AUTENTICACAO' if operacao == 'autenticar' else 'RECONCILIACAO' if operacao == 'consultar-referencia' else 'CONSULTA_CATALOGO')
            and metodo_http == METODOS_POR_OPERACAO[operacao])
        self.etapa = etapa if contexto_valido else None
        self.operacao = operacao if contexto_valido else None
        self.metodo_http = metodo_http if contexto_valido else None
        super().__init__(self.categoria)

    def com_contexto_operacao(self, operacao, metodo_http):
        """Nova exceção sanitizada; contexto atribuído pelo cliente, sem copiar resposta/causa."""
        return ErroSeguro(self.categoria, status_http=self.status_http, codigo_api=self.codigo_api,
            formato=self.formato, etapa='AUTENTICACAO' if operacao == 'autenticar' else 'RECONCILIACAO' if operacao == 'consultar-referencia' else 'CONSULTA_CATALOGO',
            operacao=operacao, metodo_http=metodo_http)

    def resumo_publico(self):
        return {k: v for k, v in {'categoria': self.categoria, 'status_http': self.status_http,
            'codigo_api': self.codigo_api, 'formato_objeto_resposta': self.formato,
            'etapa': self.etapa, 'operacao': self.operacao, 'metodo_http': self.metodo_http}.items() if v is not None}


class Segredo:
    __slots__ = ('__valor',)
    def __init__(self, valor): self.__valor = valor
    def __str__(self): return '<privado>'
    def __repr__(self): return '<Segredo privado>'
    def _revelar_ao_transporte(self): return self.__valor


class CredenciaisSIGOR:
    __slots__ = ('__cpf_cnpj', '__senha', '__unidade')
    def __init__(self, cpf_cnpj, senha, unidade):
        if not all(isinstance(v, str) for v in [cpf_cnpj, senha, unidade]):
            raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
        identificador = cpf_cnpj.strip(' \t')
        if not re.fullmatch(r'[0-9./-]+', identificador): raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
        identificador = re.sub(r'[./-]', '', identificador)
        if len(identificador) not in {11, 14} or not re.fullmatch(r'[0-9]{1,12}', unidade):
            raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
        if not 1 <= len(senha) <= 1024 or any(ord(c) < 32 or ord(c) == 127 or 0xd800 <= ord(c) <= 0xdfff for c in senha):
            raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
        self.__cpf_cnpj = Segredo(identificador)
        self.__senha = Segredo(senha)  # Não remover espaços ou normalizar senha.
        self.__unidade = Segredo(unidade)

    def __str__(self): return '<credenciais SIGOR privadas>'
    def __repr__(self): return '<CredenciaisSIGOR privadas>'
    def _payload_autenticacao(self):
        return {'cpfCnpj': self.__cpf_cnpj._revelar_ao_transporte(), 'senha': self.__senha._revelar_ao_transporte(), 'unidade': self.__unidade._revelar_ao_transporte()}
    def _valores_para_protecao(self): return tuple(self._payload_autenticacao().values())


def json_estrito(conteudo):
    def pares(itens):
        obj = {}
        for k, v in itens:
            if k in obj: raise ValueError()
            obj[k] = v
        return obj
    def constante(_): raise ValueError()
    return json.loads(conteudo, object_pairs_hook=pares, parse_constant=constante, parse_float=Decimal)


def credenciais_de_mapa(dados):
    if not isinstance(dados, dict) or set(dados) != {'cpfCnpj', 'senha', 'unidade'}:
        raise ErroSeguro('CONFIGURACAO_PRIVADA_INVALIDA')
    return CredenciaisSIGOR(dados['cpfCnpj'], dados['senha'], dados['unidade'])



def carregar_ambiente(ambiente):
    """Mapa privado fornecido pelo servidor; sem descoberta de arquivos."""
    try:
        return credenciais_de_mapa({"cpfCnpj": ambiente["SIGOR_HOM_CPF_CNPJ"], "senha": ambiente["SIGOR_HOM_SENHA"], "unidade": ambiente["SIGOR_HOM_UNIDADE"]})
    except Exception:
        raise ErroSeguro("CONFIGURACAO_PRIVADA_INVALIDA") from None
