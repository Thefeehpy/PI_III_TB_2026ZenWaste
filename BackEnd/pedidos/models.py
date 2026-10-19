import uuid

from django.db import models

from anuncios.models import Anuncio
from empresas.models import Empresa


class Order(models.Model):
    class Status(models.TextChoices):
        AWAITING_PAYMENT = "awaiting_payment", "Aguardando pagamento"
        PENDING = "pending", "Pagamento pendente"
        PAID = "paid", "Pago"
        FAILED = "failed", "Falhou"
        CANCELED = "canceled", "Cancelado"
        EXPIRED = "expired", "Expirado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=24, unique=True)
    buyer_company = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="marketplace_orders",
    )
    listing = models.ForeignKey(
        Anuncio,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.AWAITING_PAYMENT,
        db_index=True,
    )
    method = models.CharField(max_length=12, blank=True)
    installments = models.PositiveSmallIntegerField(default=1)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    fulfillment = models.CharField(max_length=16, default="pickup")
    buyer_name = models.CharField(max_length=120)
    buyer_email = models.EmailField(max_length=256)
    buyer_document = models.CharField(max_length=14)
    buyer_phone = models.CharField(max_length=20)
    item_name = models.CharField(max_length=256)
    item_type = models.CharField(max_length=50)
    item_description = models.CharField(max_length=500, blank=True)
    item_unit = models.CharField(max_length=12)
    item_image_url = models.TextField(blank=True)
    item_location = models.CharField(max_length=120, blank=True)
    item_company = models.CharField(max_length=100)
    creation_idempotency_key = models.CharField(max_length=128)
    creation_fingerprint = models.CharField(max_length=64)
    reservation_expires_at = models.DateTimeField(db_index=True)
    cancellation_requested = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["buyer_company", "creation_idempotency_key"],
                name="unique_order_creation_key_per_buyer",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="order_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gt=0),
                name="order_total_positive",
            ),
        ]

    def __str__(self):
        return self.number


class PaymentAttempt(models.Model):
    class Status(models.TextChoices):
        PROCESSING = "processing", "Processando"
        PENDING = "pending", "Pendente"
        PAID = "paid", "Pago"
        FAILED = "failed", "Falhou"
        CANCELED = "canceled", "Cancelado"
        EXPIRED = "expired", "Expirado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(max_length=40)
    method = models.CharField(max_length=12)
    status = models.CharField(max_length=16, choices=Status.choices, db_index=True)
    idempotency_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)
    provider_reference = models.CharField(max_length=160, blank=True)
    amount_cents = models.PositiveBigIntegerField()
    installments = models.PositiveSmallIntegerField(default=1)
    card_brand = models.CharField(max_length=32, blank=True)
    card_last4 = models.CharField(max_length=4, blank=True)
    pix_copy_paste = models.TextField(blank=True)
    pix_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "idempotency_key"],
                name="unique_payment_key_per_order",
            ),
            models.UniqueConstraint(
                fields=["provider", "provider_reference"],
                condition=~models.Q(provider_reference=""),
                name="unique_provider_payment_reference",
            ),
        ]

    def __str__(self):
        return f"{self.order.number} · {self.method} · {self.status}"


class WebhookEvent(models.Model):
    provider = models.CharField(max_length=40)
    event_id = models.CharField(max_length=160)
    payment = models.ForeignKey(
        PaymentAttempt,
        on_delete=models.PROTECT,
        related_name="webhook_events",
        null=True,
        blank=True,
    )
    processed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "event_id"],
                name="unique_provider_webhook_event",
            ),
        ]

    def __str__(self):
        return f"{self.provider}:{self.event_id}"
