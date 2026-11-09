"""Adapter em memória e fábrica fechada para MOCK. Não contém cliente HTTP."""

from dataclasses import replace
from enum import StrEnum
import hashlib

from mtr.contratos import DocumentoSimulado, EstadoOperacaoSimulada, IntencaoSimulada, ItemCatalogoSimulado, ResultadoOperacaoSimulada, SessaoSimulada
from mtr.validacoes import validar_texto


class CenarioSimulado(StrEnum):
    SUCESSO = "sucesso"
    AUTENTICACAO_INVALIDA = "autenticacao_invalida"
    TIMEOUT = "timeout"
    RESPOSTA_MALFORMADA = "resposta_malformada"
    INDETERMINADO = "indeterminado"
    INDISPONIVEL = "indisponivel"
    PENDENTE = "pendente"


class ErroIntegracaoMTR(RuntimeError):
    pass


class ErroProvedorNaoPermitido(ErroIntegracaoMTR):
    pass


class ErroAutenticacaoSimulada(ErroIntegracaoMTR):
    pass


class ErroTempoEsgotadoSimulado(ErroIntegracaoMTR):
    resultado_indeterminado = True


class ErroRespostaSimuladaInvalida(ErroIntegracaoMTR):
    resultado_indeterminado = True


class ErroReconciliacaoPendente(ErroIntegracaoMTR):
    pass


class ErroConteudoConflitante(ErroIntegracaoMTR):
    pass


class ErroIndisponibilidadeSimulada(ErroIntegracaoMTR):
    pass


class IntegracaoSIGORSimulada:
    """Estado técnico de operações simuladas, não máquina de estados do MTR.

    Uma instância por cenário/teste. Não persiste intenção, token ou documento e
    não oferece garantias de idempotência distribuída para produção.
    """

    def __init__(self, cenario=CenarioSimulado.SUCESSO):
        self.cenario = CenarioSimulado(cenario)
        self._operacoes = {}

    def _verificar_acesso(self):
        if self.cenario == CenarioSimulado.AUTENTICACAO_INVALIDA:
            raise ErroAutenticacaoSimulada("MOCK: autenticação simulada rejeitada.")
        if self.cenario == CenarioSimulado.INDISPONIVEL:
            raise ErroIndisponibilidadeSimulada("MOCK: indisponibilidade simulada.")

    def autenticar(self):
        self._verificar_acesso()
        return SessaoSimulada()

    def consultar_catalogos(self):
        self._verificar_acesso()
        return (ItemCatalogoSimulado("000001", "FICTÍCIO: item exclusivo de simulação; sem classificação oficial."),)

    def validar(self, intencao):
        self._verificar_acesso()
        if not isinstance(intencao, IntencaoSimulada):
            raise TypeError("Use o contrato interno IntencaoSimulada.")
        return ()

    def solicitar_emissao(self, intencao):
        self.validar(intencao)
        anterior = self._operacoes.get(intencao.identificador_interno)
        if anterior:
            resumo, resultado = anterior
            if resumo != intencao.resumo_dados:
                raise ErroConteudoConflitante("MOCK: referência já utilizada com outro conteúdo.")
            if resultado.estado in (EstadoOperacaoSimulada.INDETERMINADA, EstadoOperacaoSimulada.PENDENTE):
                raise ErroReconciliacaoPendente("MOCK: consulte o resultado antes de repetir a solicitação.")
            return replace(resultado, correlacao=intencao.correlacao)
        referencia = "MOCK-MTR-" + hashlib.sha256(intencao.identificador_interno.encode()).hexdigest()[:24]
        estado = EstadoOperacaoSimulada.CONFIRMADA
        if self.cenario in (CenarioSimulado.TIMEOUT, CenarioSimulado.INDETERMINADO, CenarioSimulado.RESPOSTA_MALFORMADA):
            estado = EstadoOperacaoSimulada.INDETERMINADA
        elif self.cenario == CenarioSimulado.PENDENTE:
            estado = EstadoOperacaoSimulada.PENDENTE
        resultado = ResultadoOperacaoSimulada(referencia, intencao.correlacao, estado)
        self._operacoes[intencao.identificador_interno] = (intencao.resumo_dados, resultado)
        if self.cenario == CenarioSimulado.TIMEOUT:
            raise ErroTempoEsgotadoSimulado("MOCK: resposta não confirmada após timeout simulado.")
        if self.cenario == CenarioSimulado.RESPOSTA_MALFORMADA:
            raise ErroRespostaSimuladaInvalida("MOCK: resposta simulada incompatível; consultar antes de repetir.")
        return resultado

    def consultar_situacao(self, identificador_interno, correlacao):
        self._verificar_acesso()
        validar_texto(identificador_interno, "identificador_interno", limite=128)
        validar_texto(correlacao, "correlacao", limite=128)
        anterior = self._operacoes.get(identificador_interno)
        if not anterior:
            return ResultadoOperacaoSimulada("MOCK-NAO-ENCONTRADA", correlacao, EstadoOperacaoSimulada.NAO_ENCONTRADA)
        resumo, resultado = anterior
        resultado = replace(resultado, correlacao=correlacao, estado=EstadoOperacaoSimulada.CONFIRMADA)
        self._operacoes[identificador_interno] = (resumo, resultado)
        return resultado

    def recuperar_documento(self, identificador_interno):
        self._verificar_acesso()
        anterior = self._operacoes.get(identificador_interno)
        if not anterior or anterior[1].estado != EstadoOperacaoSimulada.CONFIRMADA:
            raise ErroReconciliacaoPendente("MOCK: não há resultado confirmado para recuperar.")
        return DocumentoSimulado(b"SIMULACAO ZENWASTE - SEM VALOR OFICIAL OU AMBIENTAL.\n")


def criar_integracao_mtr(provedor=None, *, cenario=CenarioSimulado.SUCESSO):
    if provedor is None:
        from django.conf import settings
        provedor = getattr(settings, "MTR_PROVEDOR", "MOCK")
    if not isinstance(provedor, str) or provedor.strip().upper() != "MOCK":
        raise ErroProvedorNaoPermitido("Somente MOCK está autorizado e implementado na Fase 1A.")
    return IntegracaoSIGORSimulada(cenario)
