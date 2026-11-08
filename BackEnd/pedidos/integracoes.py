from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import uuid

from django.conf import settings
from django.utils.module_loading import import_string
from django.utils import timezone


class ErroIntegracaoPagamento(Exception):
    def __init__(self, mensagem, *, resultado_desconhecido=False):
        super().__init__(mensagem)
        self.resultado_desconhecido = resultado_desconhecido


@dataclass(frozen=True)
class ResultadoPagamento:
    situacao: str
    referencia: str = ""
    bandeira_cartao: str = ""
    final_cartao: str = ""
    pix_copia_cola: str = ""
    pix_expira_em: datetime | None = None


class IntegracaoPagamento:
    nome = "base"

    def cobrar_cartao(self, pedido, dados, chave_idempotencia):
        raise NotImplementedError

    def criar_pix(self, pedido, chave_idempotencia):
        raise NotImplementedError

    def cancelar(self, pagamento):
        raise NotImplementedError

    def validar_notificacao(self, corpo_original, assinatura):
        segredo = getattr(settings, 'SEGREDO_NOTIFICACAO_PAGAMENTO', "")
        if not segredo:
            raise ErroIntegracaoPagamento("Webhook nao configurado.")
        esperado = hmac.new(segredo.encode(), corpo_original, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(assinatura, esperado):
            raise ErroIntegracaoPagamento("Assinatura invalida.")
        try:
            return json.loads(corpo_original)
        except (json.JSONDecodeError, UnicodeDecodeError) as erro:
            raise ErroIntegracaoPagamento("Payload de webhook invalido.") from erro


class IntegracaoDesabilitada(IntegracaoPagamento):
    nome = "disabled"

    def _informar_indisponibilidade(self):
        raise ErroIntegracaoPagamento(
            "O provedor de pagamentos ainda nao foi configurado."
        )

    def cobrar_cartao(self, pedido, dados, chave_idempotencia):
        self._informar_indisponibilidade()

    def criar_pix(self, pedido, chave_idempotencia):
        self._informar_indisponibilidade()

    def cancelar(self, pagamento):
        self._informar_indisponibilidade()


class IntegracaoSimulada(IntegracaoPagamento):
    """Integração simulada local; seu conteúdo Pix não é um código bancário."""

    nome = "sandbox"

    def cobrar_cartao(self, pedido, dados, chave_idempotencia):
        if not dados["token"].startswith(("sandbox_", "demo_")):
            raise ErroIntegracaoPagamento("Use um token de cartao do ambiente sandbox.")
        recusado = dados["token"].startswith(("sandbox_declined_", "demo_declined_"))
        return ResultadoPagamento(
            situacao="failed" if recusado else "paid",
            referencia=f"sandbox_{uuid.uuid4().hex}",
            bandeira_cartao=dados.get("brand", ""),
            final_cartao=dados.get("last4", ""),
        )

    def criar_pix(self, pedido, chave_idempotencia):
        pagamento_id = uuid.uuid4().hex
        expira_em = timezone.now() + timedelta(minutes=15)
        return ResultadoPagamento(
            situacao="pending",
            referencia=f"sandbox_{pagamento_id}",
            pix_copia_cola=(
                f"ZENWASTE|PIX-SANDBOX|SEM-VALOR-DE-PAGAMENTO|{pagamento_id}"
            ),
            pix_expira_em=expira_em,
        )

    def cancelar(self, pagamento):
        return None


def obter_integracao_pagamento():
    nome_integracao = getattr(settings, 'INTEGRACAO_PAGAMENTO', "disabled")
    if nome_integracao == "sandbox" and settings.DEBUG:
        return IntegracaoSimulada()
    if nome_integracao == "disabled":
        return IntegracaoDesabilitada()
    classe_integracao = getattr(settings, 'CLASSE_INTEGRACAO_PAGAMENTO', "")
    if classe_integracao:
        tipo_integracao = import_string(classe_integracao)
        integracao = tipo_integracao()
        if not isinstance(integracao, IntegracaoPagamento):
            raise ErroIntegracaoPagamento("A classe configurada nao implementa IntegracaoPagamento.")
        return integracao
    raise ErroIntegracaoPagamento(
        "Gateway invalido ou sandbox habilitado fora de DEBUG."
    )
