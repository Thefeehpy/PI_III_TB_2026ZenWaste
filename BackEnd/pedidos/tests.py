from decimal import Decimal
from datetime import timedelta
import hashlib
import hmac
import json
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from anuncios.models import Anuncio
from authentication.services import make_token
from empresas.models import Empresa
from pedidos.gateways import GatewayResult, PaymentGatewayError
from pedidos.models import Order, PaymentAttempt
from produtos.models import Produto


@override_settings(
    PAYMENT_GATEWAY="sandbox",
    PAYMENT_WEBHOOK_SECRET="test-webhook-secret",
    DEBUG=True,
)
class OrderPaymentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = Empresa.objects.create(
            cnpj="11222333000181",
            razao_social="Compradora LTDA",
            telefone_whatsapp="11999990001",
            descricao_segmento="Industria",
            email="compras@example.com",
            senha="senha123",
        )
        self.seller = Empresa.objects.create(
            cnpj="11444777000161",
            razao_social="Recicladora LTDA",
            telefone_whatsapp="11999990002",
            descricao_segmento="Reciclagem",
            email="vendas@example.com",
            senha="senha123",
        )
        self.product = Produto.objects.create(
            empresa=self.seller,
            tipo_produto="Plastico",
            quantidade=Decimal("10.000"),
            descricao_produto="Aparas PEAD",
            unidade="kg",
        )
        self.listing = Anuncio.objects.create(
            produto=self.product,
            preco_final=Decimal("12.50"),
            status_anuncio="ativo",
            nr_qtd=Decimal("10.000"),
            descricao_especifica="Aparas limpas",
            localizacao="Sao Paulo - SP",
        )
        self.authenticate_as(self.buyer)
        self.buyer_details = {
            "name": "Compradora LTDA",
            "email": "compras@example.com",
            "document": "11.222.333/0001-81",
            "phone": "(11) 99999-0001",
        }

    def authenticate_as(self, empresa):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {make_token(empresa)}")

    def create_order(self, *, key="order-create-1", quantity="2.500"):
        return self.client.post(
            "/api/orders/",
            {
                "listingId": self.listing.pk,
                "quantity": quantity,
                "buyer": self.buyer_details,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_creation_calculates_total_and_is_idempotent(self):
        first = self.create_order()
        second = self.create_order()

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(first.data["totalCents"], 3125)
        self.assertEqual(Order.objects.count(), 1)

    def test_reusing_creation_key_with_different_payload_conflicts(self):
        self.assertEqual(self.create_order().status_code, 201)

        response = self.create_order(quantity="3.000")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    def test_active_orders_reserve_listing_quantity(self):
        self.assertEqual(self.create_order(quantity="8.000").status_code, 201)

        response = self.create_order(key="order-create-2", quantity="3.000")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 1)

    def test_inventory_cannot_be_moved_below_reserved_orders(self):
        self.assertEqual(self.create_order(quantity="8.000").status_code, 201)
        self.authenticate_as(self.seller)

        response = self.client.post(
            f"/api/inventory/items/{self.product.pk}/movements/",
            {"type": "saida", "quantity": "3.000", "note": "Baixa manual"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantidade, Decimal("10.000"))

    def test_seller_cannot_change_or_finalize_reserved_listing(self):
        self.assertEqual(self.create_order(quantity="8.000").status_code, 201)
        self.authenticate_as(self.seller)

        update = self.client.patch(
            f"/api/marketplace/ads/{self.listing.pk}/",
            {"quantity": "7.000"},
            format="json",
        )
        finalize = self.client.post(
            f"/api/marketplace/ads/{self.listing.pk}/finalize/",
            {"soldQuantity": "1.000"},
            format="json",
        )

        self.assertEqual(update.status_code, 400)
        self.assertEqual(finalize.status_code, 400)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.nr_qtd, Decimal("10.000"))
        self.assertEqual(self.listing.status_anuncio, "ativo")

    def test_inventory_with_order_history_cannot_be_deleted(self):
        self.assertEqual(self.create_order().status_code, 201)
        self.authenticate_as(self.seller)

        response = self.client.delete(f"/api/inventory/items/{self.product.pk}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Produto.objects.filter(pk=self.product.pk).exists())

    def test_buyer_cannot_create_order_for_another_company_document(self):
        self.buyer_details["document"] = "11444777000161"

        response = self.create_order()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_card_payment_updates_stock_once_when_replayed(self):
        order_response = self.create_order()
        order_id = order_response.data["id"]
        payload = {
            "method": "credit",
            "token": "demo_approved_test-token",
            "brand": "Visa",
            "last4": "4242",
            "installments": 1,
        }

        first = self.client.post(
            f"/api/orders/{order_id}/payments/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )
        second = self.client.post(
            f"/api/orders/{order_id}/payments/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["status"], Order.Status.PAID)
        self.assertEqual(second.status_code, 200, second.data)
        self.product.refresh_from_db()
        self.listing.refresh_from_db()
        self.assertEqual(self.product.quantidade, Decimal("7.500"))
        self.assertEqual(self.listing.nr_qtd, Decimal("7.500"))
        self.assertEqual(PaymentAttempt.objects.count(), 1)

        changed_payload = {**payload, "installments": 2}
        conflict = self.client.post(
            f"/api/orders/{order_id}/payments/",
            changed_payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )
        self.assertEqual(conflict.status_code, 409)

    def test_failed_payment_can_retry_with_fresh_reservation(self):
        order_id = self.create_order().data["id"]
        failed = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "credit",
                "token": "demo_declined_test",
                "brand": "Visa",
                "last4": "4242",
                "installments": 1,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="card-declined",
        )
        order = Order.objects.get(pk=order_id)
        order.reservation_expires_at = timezone.now() - timedelta(seconds=1)
        order.save(update_fields=["reservation_expires_at"])

        retried = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "debit",
                "token": "demo_approved_retry",
                "brand": "Visa",
                "last4": "4242",
                "installments": 1,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="debit-approved-retry",
        )

        self.assertEqual(failed.status_code, 200)
        self.assertEqual(failed.data["status"], Order.Status.FAILED)
        self.assertEqual(retried.status_code, 200, retried.data)
        self.assertEqual(retried.data["status"], Order.Status.PAID)

    def test_endpoint_rejects_raw_card_fields(self):
        order_id = self.create_order().data["id"]

        response = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "credit",
                "token": "demo_approved_test-token",
                "number": "4111111111111111",
                "cvv": "123",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-raw",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PaymentAttempt.objects.count(), 0)

    def test_uncertain_gateway_result_keeps_attempt_for_idempotent_retry(self):
        order_id = self.create_order().data["id"]
        payload = {
            "method": "credit",
            "token": "provider-token",
            "brand": "Visa",
            "last4": "4242",
            "installments": 1,
        }
        key = "payment-unknown-then-confirmed"

        class UncertainGateway:
            def charge_card(self, order, data, idempotency_key):
                raise PaymentGatewayError("Resposta do provedor inconclusiva.", outcome_unknown=True)

        with patch("pedidos.services.get_payment_gateway", return_value=UncertainGateway()):
            uncertain = self.client.post(
                f"/api/orders/{order_id}/payments/",
                payload,
                format="json",
                HTTP_IDEMPOTENCY_KEY=key,
            )

        self.assertEqual(uncertain.status_code, 503)
        self.assertEqual(Order.objects.get(pk=order_id).status, Order.Status.PENDING)
        attempt = PaymentAttempt.objects.get(order_id=order_id)
        self.assertEqual(attempt.status, PaymentAttempt.Status.PROCESSING)

        class ConfirmedGateway:
            def charge_card(self, order, data, idempotency_key):
                return GatewayResult(status="paid", card_brand="Visa", card_last4="4242")

        with patch("pedidos.services.get_payment_gateway", return_value=ConfirmedGateway()):
            retry = self.client.post(
                f"/api/orders/{order_id}/payments/",
                payload,
                format="json",
                HTTP_IDEMPOTENCY_KEY=key,
            )

        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(retry.data["status"], Order.Status.PAID)
        self.assertEqual(PaymentAttempt.objects.filter(order_id=order_id).count(), 1)

    def test_pix_is_pending_until_signed_provider_confirmation(self):
        order_id = self.create_order().data["id"]
        response = self.client.post(
            f"/api/orders/{order_id}/pix/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-pix-1",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], Order.Status.PENDING)
        self.assertIn("ZENWASTE|PIX-SANDBOX", response.data["pix"]["copyPaste"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantidade, Decimal("10.000"))

        payment = PaymentAttempt.objects.get(order_id=order_id)
        payload = {
            "eventId": "evt-test-1",
            "paymentReference": payment.provider_reference,
            "status": "paid",
            "amountCents": payment.amount_cents,
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(
            b"test-webhook-secret",
            body,
            hashlib.sha256,
        ).hexdigest()
        webhook = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            body,
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE=signature,
        )

        self.assertEqual(webhook.status_code, 200, webhook.data)
        self.assertEqual(Order.objects.get(pk=order_id).status, Order.Status.PAID)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantidade, Decimal("7.500"))

    def test_order_is_not_visible_to_another_company(self):
        order_id = self.create_order().data["id"]
        self.authenticate_as(self.seller)

        response = self.client.get(f"/api/orders/{order_id}/")

        self.assertEqual(response.status_code, 404)

    def test_cancel_releases_inventory_reservation(self):
        order_id = self.create_order(quantity="6.000").data["id"]
        canceled = self.client.post(f"/api/orders/{order_id}/cancel/", {}, format="json")

        replacement = self.create_order(key="order-after-cancel", quantity="10.000")

        self.assertEqual(canceled.status_code, 200, canceled.data)
        self.assertEqual(canceled.data["status"], Order.Status.CANCELED)
        self.assertEqual(replacement.status_code, 201, replacement.data)

    def test_expired_order_releases_reservation_on_read(self):
        order_id = self.create_order(quantity="10.000").data["id"]
        order = Order.objects.get(pk=order_id)
        order.reservation_expires_at = timezone.now() - timedelta(seconds=1)
        order.save(update_fields=["reservation_expires_at"])

        detail = self.client.get(f"/api/orders/{order_id}/")
        replacement = self.create_order(key="order-after-expiry", quantity="10.000")

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["status"], Order.Status.EXPIRED)
        self.assertEqual(replacement.status_code, 201, replacement.data)

    def test_signed_webhook_rejects_wrong_amount(self):
        order_id = self.create_order().data["id"]
        self.client.post(
            f"/api/orders/{order_id}/pix/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-pix-wrong-amount",
        )
        payment = PaymentAttempt.objects.get(order_id=order_id)
        payload = {
            "eventId": "evt-wrong-amount",
            "paymentReference": payment.provider_reference,
            "status": "paid",
            "amountCents": payment.amount_cents + 1,
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(b"test-webhook-secret", body, hashlib.sha256).hexdigest()

        response = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            body,
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.get(pk=order_id).status, Order.Status.PENDING)

    def test_webhook_rejects_invalid_signature(self):
        response = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            b'{"eventId":"evt","paymentReference":"ref","status":"paid","amountCents":100}',
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE="invalid",
        )

        self.assertEqual(response.status_code, 401)
