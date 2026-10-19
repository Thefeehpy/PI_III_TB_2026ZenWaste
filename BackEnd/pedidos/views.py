from django.conf import settings
from rest_framework import status
from rest_framework.response import Response

from authentication.services import ZenWasteAPIView, require_empresa
from pedidos.gateways import PaymentGatewayError, get_payment_gateway
from pedidos.models import Order
from pedidos.serializers import (
    CardPaymentSerializer,
    CreateOrderSerializer,
    PixPaymentSerializer,
    SandboxResultSerializer,
)
from pedidos.services import (
    apply_webhook_event,
    cancel_order,
    create_order,
    get_buyer_order,
    get_buyer_orders,
    simulate_sandbox_result,
    start_payment,
)


def serialize_order(order):
    attempts = getattr(order, "payment_attempts", None)
    payment = attempts[0] if attempts else order.payments.order_by("-created_at").first()
    method = payment.method if payment else order.method or None
    item = {
        "id": str(order.listing_id),
        "name": order.item_name,
        "type": order.item_type,
        "description": order.item_description,
        "quantity": float(order.quantity),
        "unit": order.item_unit,
        "price": float(order.unit_price),
        "location": order.item_location,
        "company": order.item_company,
        "imageUrl": order.item_image_url,
    }
    result = {
        "id": str(order.pk),
        "number": order.number,
        "createdAt": order.created_at.isoformat(),
        "totalCents": int(order.total_amount * 100),
        "item": item,
        "quantity": float(order.quantity),
        "buyer": {
            "name": order.buyer_name,
            "email": order.buyer_email,
            "document": order.buyer_document,
            "phone": order.buyer_phone,
        },
        "fulfillment": order.fulfillment,
        "status": order.status,
        "installments": order.installments,
    }
    if order.paid_at:
        result["paidAt"] = order.paid_at.isoformat()
    if method:
        result["method"] = method
    if payment and method in ("credit", "debit") and (payment.card_brand or payment.card_last4):
        result["card"] = {"brand": payment.card_brand, "last4": payment.card_last4}
    if payment and method == "pix" and payment.pix_copy_paste:
        result["pix"] = {
            "id": str(payment.pk),
            "copyPaste": payment.pix_copy_paste,
            "expiresAt": payment.pix_expires_at.isoformat() if payment.pix_expires_at else "",
        }
    return result


def _authorized_order(request, pk):
    empresa, error = require_empresa(request)
    if error:
        return None, None, error
    order = get_buyer_order(pk, empresa)
    if not order:
        return empresa, None, Response(
            {"message": "Pedido nao encontrado."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return empresa, order, None


class OrdersAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error
        orders = get_buyer_orders(empresa)
        return Response({"items": [serialize_order(order) for order in orders]})

    def post(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = create_order(
            empresa,
            serializer.validated_data,
            request.headers.get("Idempotency-Key"),
        )
        return Response(serialize_order(order), status=status.HTTP_201_CREATED)


class OrderDetailAPIView(ZenWasteAPIView):
    def get(self, request, pk):
        _, order, error = _authorized_order(request, pk)
        if error:
            return error
        return Response(serialize_order(order))


class OrderPaymentAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, _, error = _authorized_order(request, pk)
        if error:
            return error
        serializer = CardPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = start_payment(
            pk,
            empresa,
            "card",
            serializer.validated_data,
            request.headers.get("Idempotency-Key"),
        )
        return Response(serialize_order(order))


class OrderPixAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, _, error = _authorized_order(request, pk)
        if error:
            return error
        serializer = PixPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = start_payment(
            pk,
            empresa,
            "pix",
            serializer.validated_data,
            request.headers.get("Idempotency-Key"),
        )
        return Response(serialize_order(order))


class OrderCancelAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, _, error = _authorized_order(request, pk)
        if error:
            return error
        order = cancel_order(pk, empresa)
        return Response(serialize_order(order))


class SandboxPaymentResultAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, _, error = _authorized_order(request, pk)
        if error:
            return error
        serializer = SandboxResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = simulate_sandbox_result(pk, empresa, serializer.validated_data["result"])
        return Response(serialize_order(order))


class PaymentWebhookAPIView(ZenWasteAPIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, provider):
        secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", "")
        signature = request.headers.get("X-Payment-Signature", "")
        if not secret:
            return Response(
                {"message": "Webhook nao configurado."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            gateway = get_payment_gateway()
            payload = gateway.verify_webhook(request.body, signature)
        except PaymentGatewayError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        text_fields = ("eventId", "paymentReference", "status")
        if (
            any(not isinstance(payload.get(field), str) or not payload[field] for field in text_fields)
            or not isinstance(payload.get("amountCents"), int)
            or isinstance(payload.get("amountCents"), bool)
            or payload["amountCents"] <= 0
        ):
            return Response({"message": "Evento incompleto."}, status=status.HTTP_400_BAD_REQUEST)

        if payload.get("currency", "BRL") != "BRL":
            return Response({"message": "Moeda do evento invalida."}, status=status.HTTP_400_BAD_REQUEST)

        if provider != getattr(settings, "PAYMENT_GATEWAY", "disabled"):
            return Response({"message": "Provedor nao habilitado."}, status=status.HTTP_404_NOT_FOUND)
        order = apply_webhook_event(
            provider,
            payload["eventId"],
            payload["paymentReference"],
            payload["status"],
            payload["amountCents"],
        )
        return Response({"received": True, "orderId": str(order.pk) if order else None})
