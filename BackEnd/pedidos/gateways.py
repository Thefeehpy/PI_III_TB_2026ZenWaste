from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import uuid

from django.conf import settings
from django.utils.module_loading import import_string
from django.utils import timezone


class PaymentGatewayError(Exception):
    def __init__(self, message, *, outcome_unknown=False):
        super().__init__(message)
        self.outcome_unknown = outcome_unknown


@dataclass(frozen=True)
class GatewayResult:
    status: str
    reference: str = ""
    card_brand: str = ""
    card_last4: str = ""
    pix_copy_paste: str = ""
    pix_expires_at: datetime | None = None


class PaymentGateway:
    name = "base"

    def charge_card(self, order, data, idempotency_key):
        raise NotImplementedError

    def create_pix(self, order, idempotency_key):
        raise NotImplementedError

    def cancel(self, payment):
        raise NotImplementedError

    def verify_webhook(self, raw_body, signature):
        secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", "")
        if not secret:
            raise PaymentGatewayError("Webhook nao configurado.")
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise PaymentGatewayError("Assinatura invalida.")
        try:
            return json.loads(raw_body)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise PaymentGatewayError("Payload de webhook invalido.") from exc


class DisabledGateway(PaymentGateway):
    name = "disabled"

    def _unavailable(self):
        raise PaymentGatewayError(
            "O provedor de pagamentos ainda nao foi configurado."
        )

    def charge_card(self, order, data, idempotency_key):
        self._unavailable()

    def create_pix(self, order, idempotency_key):
        self._unavailable()

    def cancel(self, payment):
        self._unavailable()


class SandboxGateway(PaymentGateway):
    """Local-only fake gateway. Its Pix payload is not a bank payment code."""

    name = "sandbox"

    def charge_card(self, order, data, idempotency_key):
        if not data["token"].startswith(("sandbox_", "demo_")):
            raise PaymentGatewayError("Use um token de cartao do ambiente sandbox.")
        declined = data["token"].startswith(("sandbox_declined_", "demo_declined_"))
        return GatewayResult(
            status="failed" if declined else "paid",
            reference=f"sandbox_{uuid.uuid4().hex}",
            card_brand=data.get("brand", ""),
            card_last4=data.get("last4", ""),
        )

    def create_pix(self, order, idempotency_key):
        payment_id = uuid.uuid4().hex
        expires_at = timezone.now() + timedelta(minutes=15)
        return GatewayResult(
            status="pending",
            reference=f"sandbox_{payment_id}",
            pix_copy_paste=(
                f"ZENWASTE|PIX-SANDBOX|SEM-VALOR-DE-PAGAMENTO|{payment_id}"
            ),
            pix_expires_at=expires_at,
        )

    def cancel(self, payment):
        return None


def get_payment_gateway():
    gateway_name = getattr(settings, "PAYMENT_GATEWAY", "disabled")
    if gateway_name == "sandbox" and settings.DEBUG:
        return SandboxGateway()
    if gateway_name == "disabled":
        return DisabledGateway()
    gateway_class = getattr(settings, "PAYMENT_GATEWAY_CLASS", "")
    if gateway_class:
        gateway_type = import_string(gateway_class)
        gateway = gateway_type()
        if not isinstance(gateway, PaymentGateway):
            raise PaymentGatewayError("A classe configurada nao implementa PaymentGateway.")
        return gateway
    raise PaymentGatewayError(
        "Gateway invalido ou sandbox habilitado fora de DEBUG."
    )
