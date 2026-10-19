from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch, Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from anuncios.models import Anuncio
from empresas.models import Empresa
from pedidos.gateways import GatewayResult, PaymentGatewayError, get_payment_gateway
from pedidos.models import Order, PaymentAttempt, WebhookEvent
from produtos.models import Produto
from produtos.services import register_inventory_movement


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "O pedido nao pode ser atualizado neste estado."
    default_code = "conflict"


class PaymentProcessingError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "O provedor ainda esta confirmando a operacao. Consulte o pedido antes de tentar novamente."
    default_code = "payment_processing"


def _fingerprint(data):
    payload = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _required_idempotency_key(value):
    key = (value or "").strip()
    if not key or len(key) > 128:
        raise serializers.ValidationError({"message": "Envie uma chave Idempotency-Key valida."})
    return key


def _reserved_quantity(*, product_id=None, listing_id=None, exclude_order_id=None, now=None):
    now = now or timezone.now()
    orders = Order.objects.filter(
        status__in=(Order.Status.AWAITING_PAYMENT, Order.Status.PENDING),
        reservation_expires_at__gt=now,
    )
    if product_id is not None:
        orders = orders.filter(listing__produto_id=product_id)
    if listing_id is not None:
        orders = orders.filter(listing_id=listing_id)
    if exclude_order_id is not None:
        orders = orders.exclude(pk=exclude_order_id)
    return orders.aggregate(total=Sum("quantity"))["total"] or Decimal("0")


def reserved_quantity_for_product(product_id):
    return _reserved_quantity(product_id=product_id)


def reserved_quantity_for_listing(listing_id):
    return _reserved_quantity(listing_id=listing_id)


def _order_number():
    return f"ZW-{secrets.token_hex(5).upper()}"


@transaction.atomic
def create_order(empresa, data, idempotency_key):
    key = _required_idempotency_key(idempotency_key)
    fingerprint = _fingerprint(data)
    Empresa.objects.select_for_update().get(pk=empresa.pk)
    existing = Order.objects.filter(
        buyer_company=empresa,
        creation_idempotency_key=key,
    ).first()
    if existing:
        if existing.creation_fingerprint != fingerprint:
            raise ConflictError("A chave de idempotencia ja foi usada com outros dados.")
        return existing

    try:
        listing = Anuncio.objects.select_for_update().select_related(
            "produto", "produto__empresa"
        ).get(pk=data["listingId"])
    except Anuncio.DoesNotExist:
        raise serializers.ValidationError({"message": "Anuncio nao encontrado."})

    try:
        product = Produto.objects.select_for_update().get(pk=listing.produto_id)
    except Produto.DoesNotExist:
        raise serializers.ValidationError({"message": "Material indisponivel."})

    existing = Order.objects.filter(
        buyer_company=empresa,
        creation_idempotency_key=key,
    ).first()
    if existing:
        if existing.creation_fingerprint != fingerprint:
            raise ConflictError("A chave de idempotencia ja foi usada com outros dados.")
        return existing

    if listing.status_anuncio != "ativo" or not product.empresa_id:
        raise serializers.ValidationError({"message": "Este anuncio nao esta disponivel."})
    if product.empresa_id == empresa.id_empresa:
        raise serializers.ValidationError({"message": "Nao e permitido comprar o proprio anuncio."})

    quantity = data["quantity"]
    available_in_listing = listing.nr_qtd - _reserved_quantity(listing_id=listing.pk)
    available_in_product = product.quantidade - _reserved_quantity(product_id=product.pk)
    available = min(available_in_listing, available_in_product)
    if quantity > available:
        raise serializers.ValidationError({
            "message": f"Quantidade indisponivel. Saldo livre: {available}."
        })

    total = (listing.preco_final * quantity).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if total <= 0:
        raise serializers.ValidationError({"message": "O valor do pedido deve ser maior que R$ 0,01."})

    buyer = data["buyer"]
    company_document = "".join(character for character in empresa.cnpj if character.isdigit())
    if buyer["document"] != company_document:
        raise serializers.ValidationError({
            "buyer": {"document": "O CNPJ do comprador deve corresponder a empresa autenticada."}
        })
    seller = product.empresa
    return Order.objects.create(
        number=_order_number(),
        buyer_company=empresa,
        listing=listing,
        status=Order.Status.AWAITING_PAYMENT,
        quantity=quantity,
        unit_price=listing.preco_final,
        total_amount=total,
        buyer_name=buyer["name"],
        buyer_email=buyer["email"],
        buyer_document=buyer["document"],
        buyer_phone=buyer["phone"],
        item_name=product.descricao_produto,
        item_type=product.tipo_produto,
        item_description=listing.descricao_especifica or product.descricao_produto,
        item_unit=product.unidade,
        item_image_url=listing.imagem_url,
        item_location=listing.localizacao,
        item_company=seller.razao_social,
        creation_idempotency_key=key,
        creation_fingerprint=fingerprint,
        reservation_expires_at=timezone.now() + timedelta(
            minutes=getattr(settings, "ORDER_RESERVATION_MINUTES", 15)
        ),
    )


def _check_order_available(order):
    if order.status in (Order.Status.PAID, Order.Status.CANCELED):
        raise ConflictError("Este pedido ja foi finalizado.")
    if order.reservation_expires_at <= timezone.now():
        if order.status in (Order.Status.AWAITING_PAYMENT, Order.Status.PENDING):
            order.status = Order.Status.EXPIRED
            order.save(update_fields=["status", "updated_at"])
        raise ConflictError("A reserva deste pedido expirou. Crie um novo pedido.")


def _restore_order_reservation(order):
    retrying_failed_order = order.status == Order.Status.FAILED
    if order.reservation_expires_at <= timezone.now() and not retrying_failed_order:
        raise ConflictError("A reserva deste pedido expirou. Crie um novo pedido.")
    listing = Anuncio.objects.select_for_update().select_related("produto").get(pk=order.listing_id)
    product = Produto.objects.select_for_update().get(pk=listing.produto_id)
    listing_available = listing.nr_qtd - _reserved_quantity(
        listing_id=listing.pk,
        exclude_order_id=order.pk,
    )
    product_available = product.quantidade - _reserved_quantity(
        product_id=product.pk,
        exclude_order_id=order.pk,
    )
    if order.quantity > min(listing_available, product_available):
        raise ConflictError("A quantidade do pedido nao esta mais disponivel. Crie outro pedido.")
    order.status = Order.Status.AWAITING_PAYMENT
    if retrying_failed_order:
        order.reservation_expires_at = timezone.now() + timedelta(
            minutes=getattr(settings, "ORDER_RESERVATION_MINUTES", 30)
        )
    order.save(update_fields=["status", "reservation_expires_at", "updated_at"])


@transaction.atomic
def refresh_order_status(order):
    now = timezone.now()
    payment_attempts = getattr(order, "payment_attempts", None)
    if payment_attempts is None:
        payment_attempts = list(order.payments.all())
    pending_payments = [
        payment for payment in payment_attempts
        if payment.status == PaymentAttempt.Status.PENDING
    ]
    expired_pix = [
        payment for payment in pending_payments
        if payment.method == "pix" and payment.pix_expires_at and payment.pix_expires_at <= now
    ]
    if order.status in (Order.Status.AWAITING_PAYMENT, Order.Status.PENDING):
        if order.reservation_expires_at <= now:
            expired_payments = pending_payments
            order.status = Order.Status.EXPIRED
        elif expired_pix:
            expired_payments = expired_pix
            order.status = Order.Status.EXPIRED
        else:
            expired_payments = []
        for payment in expired_payments:
            payment.status = PaymentAttempt.Status.EXPIRED
            payment.save(update_fields=["status", "updated_at"])
        if order.status == Order.Status.EXPIRED:
            order.save(update_fields=["status", "updated_at"])
    return order


def _apply_result(order, payment, result):
    payment.status = result.status
    payment.provider_reference = result.reference
    payment.card_brand = result.card_brand
    payment.card_last4 = result.card_last4
    payment.pix_copy_paste = result.pix_copy_paste
    payment.pix_expires_at = result.pix_expires_at
    payment.save(update_fields=[
        "status", "provider_reference", "card_brand", "card_last4",
        "pix_copy_paste", "pix_expires_at", "updated_at",
    ])
    order.method = payment.method
    order.installments = payment.installments

    if result.status == PaymentAttempt.Status.PAID:
        if order.reservation_expires_at <= timezone.now():
            payment.status = PaymentAttempt.Status.EXPIRED
            payment.save(update_fields=["status", "updated_at"])
            order.status = Order.Status.EXPIRED
        else:
            order.status = Order.Status.PAID
            order.paid_at = timezone.now()
            order.save(update_fields=["status", "paid_at", "updated_at"])
            listing = Anuncio.objects.select_for_update().select_related("produto").get(
                pk=order.listing_id
            )
            product = Produto.objects.select_for_update().get(pk=listing.produto_id)
            register_inventory_movement(product, product.empresa, {
                "type": "saida",
                "quantity": order.quantity,
                "note": f"Pedido {order.number} pago",
            })
            listing.nr_qtd = max(Decimal("0"), listing.nr_qtd - order.quantity)
            update_fields = ["nr_qtd"]
            if listing.nr_qtd <= 0:
                listing.status_anuncio = "vendido"
                listing.data_final = timezone.localdate()
                update_fields.extend(["status_anuncio", "data_final"])
            listing.save(update_fields=update_fields)
    elif result.status == PaymentAttempt.Status.PENDING:
        order.status = Order.Status.PENDING
    elif result.status == PaymentAttempt.Status.FAILED:
        order.status = Order.Status.FAILED
    elif result.status == PaymentAttempt.Status.CANCELED:
        order.status = Order.Status.CANCELED
    elif result.status == PaymentAttempt.Status.EXPIRED:
        order.status = Order.Status.EXPIRED

    order.save(update_fields=["method", "installments", "status", "paid_at", "updated_at"])
    return order


def start_payment(order_id, empresa, method, data, idempotency_key):
    key = _required_idempotency_key(idempotency_key)
    payment_fingerprint = _fingerprint({"method": method, **data})
    pending_payment_ids = []
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id, buyer_company=empresa)
        except Order.DoesNotExist:
            raise serializers.ValidationError({"message": "Pedido nao encontrado."})
        if order.cancellation_requested:
            raise ConflictError("O cancelamento deste pedido esta sendo processado.")

        payment = PaymentAttempt.objects.filter(order=order, idempotency_key=key).first()
        if payment:
            if payment.request_fingerprint != payment_fingerprint:
                raise ConflictError("A chave de idempotencia ja foi usada com outros dados.")
            if payment.status != PaymentAttempt.Status.PROCESSING:
                return order
            _check_order_available(order)
        else:
            if order.status in (Order.Status.EXPIRED, Order.Status.FAILED):
                _restore_order_reservation(order)
            else:
                _check_order_available(order)

            active_payment = order.payments.filter(
                status__in=(PaymentAttempt.Status.PENDING, PaymentAttempt.Status.PROCESSING)
            ).order_by("-created_at").first()
            if active_payment and active_payment.status == PaymentAttempt.Status.PROCESSING:
                raise ConflictError("Outro pagamento deste pedido esta sendo processado.")
            if (
                active_payment
                and method == "pix"
                and active_payment.method == "pix"
                and active_payment.pix_expires_at
                and active_payment.pix_expires_at > timezone.now()
            ):
                return order
            pending_payment_ids = list(
                order.payments.filter(status=PaymentAttempt.Status.PENDING)
                .values_list("pk", flat=True)
            )

            if method == "card" and data["method"] == "debit":
                payment_method = "debit"
            elif method == "card":
                payment_method = "credit"
            else:
                payment_method = "pix"

            payment = PaymentAttempt.objects.create(
                order=order,
                provider=getattr(settings, "PAYMENT_GATEWAY", "disabled"),
                method=payment_method,
                status=PaymentAttempt.Status.PROCESSING,
                idempotency_key=key,
                request_fingerprint=payment_fingerprint,
                amount_cents=int(order.total_amount * 100),
                installments=data.get("installments", 1),
            )
            order.status = Order.Status.PENDING
            order.method = payment_method
            order.installments = payment.installments
            order.save(update_fields=["status", "method", "installments", "updated_at"])

    try:
        gateway = get_payment_gateway()
        for pending_payment_id in pending_payment_ids:
            pending_payment = PaymentAttempt.objects.get(pk=pending_payment_id)
            gateway.cancel(pending_payment)
            with transaction.atomic():
                PaymentAttempt.objects.filter(
                    pk=pending_payment_id,
                    status=PaymentAttempt.Status.PENDING,
                ).update(status=PaymentAttempt.Status.CANCELED)
        if method == "card":
            result = gateway.charge_card(order, data, key)
        else:
            result = gateway.create_pix(order, key)
    except PaymentGatewayError as exc:
        if exc.outcome_unknown:
            raise PaymentProcessingError(str(exc))
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=order_id)
            payment = PaymentAttempt.objects.select_for_update().get(pk=payment.pk)
            payment.status = PaymentAttempt.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            if order.status not in (Order.Status.PAID, Order.Status.CANCELED):
                order.status = (
                    Order.Status.PENDING
                    if pending_payment_ids
                    else Order.Status.FAILED
                )
                order.save(update_fields=["status", "updated_at"])
        raise serializers.ValidationError({"message": str(exc)})

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        payment = PaymentAttempt.objects.select_for_update().get(pk=payment.pk)
        if order.status in (Order.Status.PAID, Order.Status.CANCELED):
            if order.status == Order.Status.PAID and payment.status == PaymentAttempt.Status.PAID:
                return order
            payment.status = PaymentAttempt.Status.CANCELED
            payment.save(update_fields=["status", "updated_at"])
            return order
        return _apply_result(order, payment, result)


def cancel_order(order_id, empresa):
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id, buyer_company=empresa)
        except Order.DoesNotExist:
            raise serializers.ValidationError({"message": "Pedido nao encontrado."})
        if order.status == Order.Status.CANCELED:
            return order
        if order.status == Order.Status.PAID:
            raise ConflictError("Um pedido pago nao pode ser cancelado por esta operacao.")
        if order.status == Order.Status.EXPIRED and order.reservation_expires_at <= timezone.now():
            return order
        if order.payments.filter(status=PaymentAttempt.Status.PROCESSING).exists():
            raise ConflictError("Um pagamento esta sendo processado. Aguarde antes de cancelar.")
        order.cancellation_requested = True
        order.save(update_fields=["cancellation_requested", "updated_at"])
        payment_ids = list(
            order.payments.filter(status=PaymentAttempt.Status.PENDING)
            .values_list("pk", flat=True)
        )

    try:
        gateway = get_payment_gateway()
        for payment_id in payment_ids:
            gateway.cancel(PaymentAttempt.objects.get(pk=payment_id))
    except PaymentGatewayError as exc:
        with transaction.atomic():
            Order.objects.filter(pk=order_id).update(cancellation_requested=False)
        raise serializers.ValidationError({"message": str(exc)})

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        if order.status == Order.Status.PAID:
            order.cancellation_requested = False
            order.save(update_fields=["cancellation_requested", "updated_at"])
            return order
        PaymentAttempt.objects.filter(
            pk__in=payment_ids,
            status=PaymentAttempt.Status.PENDING,
        ).update(status=PaymentAttempt.Status.CANCELED)
        order.status = Order.Status.CANCELED
        order.cancellation_requested = False
        order.save(update_fields=["status", "cancellation_requested", "updated_at"])
        return order


@transaction.atomic
def apply_webhook_event(provider, event_id, reference, result_status, amount_cents):
    if result_status not in {
        PaymentAttempt.Status.PAID,
        PaymentAttempt.Status.FAILED,
        PaymentAttempt.Status.CANCELED,
        PaymentAttempt.Status.EXPIRED,
    }:
        raise serializers.ValidationError({"message": "Status de pagamento invalido."})

    event, created = WebhookEvent.objects.get_or_create(
        provider=provider,
        event_id=event_id,
    )
    if not created and event.processed:
        return event.payment.order if event.payment_id else None

    order_id = PaymentAttempt.objects.filter(
        provider=provider,
        provider_reference=reference,
    ).values_list("order_id", flat=True).first()
    if order_id is None:
        raise serializers.ValidationError({"message": "Pagamento nao encontrado."})
    order = Order.objects.select_for_update().get(pk=order_id)
    payment = PaymentAttempt.objects.select_for_update().get(
        provider=provider,
        provider_reference=reference,
        order=order,
    )
    if payment.amount_cents != amount_cents:
        raise serializers.ValidationError({"message": "Valor do evento nao corresponde ao pedido."})
    event.payment = payment
    if order.status not in (Order.Status.PAID, Order.Status.CANCELED):
        result = GatewayResult(
            status=result_status,
            reference=payment.provider_reference,
            card_brand=payment.card_brand,
            card_last4=payment.card_last4,
        )
        _apply_result(order, payment, result)
    event.processed = True
    event.save(update_fields=["payment", "processed"])
    return order


def get_buyer_orders(empresa):
    orders = list(
        Order.objects.filter(buyer_company=empresa)
        .prefetch_related(Prefetch(
            "payments",
            queryset=PaymentAttempt.objects.order_by("-created_at"),
            to_attr="payment_attempts",
        ))
    )
    for order in orders:
        refresh_order_status(order)
    return orders


def get_buyer_order(order_id, empresa):
    order = Order.objects.filter(
        pk=order_id,
        buyer_company=empresa,
    ).prefetch_related(Prefetch(
        "payments",
        queryset=PaymentAttempt.objects.order_by("-created_at"),
        to_attr="payment_attempts",
    )).first()
    if order:
        refresh_order_status(order)
    return order


@transaction.atomic
def simulate_sandbox_result(order_id, empresa, result_status):
    if not settings.DEBUG or getattr(settings, "PAYMENT_GATEWAY", "disabled") != "sandbox":
        raise ConflictError("Simulacao disponivel apenas no sandbox local.")
    try:
        order = Order.objects.select_for_update().get(pk=order_id, buyer_company=empresa)
    except Order.DoesNotExist:
        raise serializers.ValidationError({"message": "Pedido nao encontrado."})
    _check_order_available(order)
    payment = order.payments.filter(method="pix", status=PaymentAttempt.Status.PENDING).first()
    if not payment:
        raise ConflictError("Nao existe um Pix pendente para este pedido.")
    result = GatewayResult(
        status=result_status,
        reference=payment.provider_reference,
        pix_copy_paste=payment.pix_copy_paste,
        pix_expires_at=payment.pix_expires_at,
    )
    return _apply_result(order, payment, result)
