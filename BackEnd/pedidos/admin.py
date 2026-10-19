from django.contrib import admin

from pedidos.models import Order, PaymentAttempt, WebhookEvent


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("number", "buyer_company", "status", "total_amount", "created_at")
    list_filter = ("status", "method", "created_at")
    search_fields = ("number", "buyer_name", "buyer_email", "buyer_document")
    readonly_fields = ("id", "created_at", "updated_at", "paid_at")


@admin.register(PaymentAttempt)
class PaymentAttemptAdmin(admin.ModelAdmin):
    list_display = ("order", "provider", "method", "status", "amount_cents", "created_at")
    list_filter = ("provider", "method", "status")
    search_fields = ("order__number", "provider_reference")
    readonly_fields = tuple(field.name for field in PaymentAttempt._meta.fields)


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("provider", "event_id", "payment", "processed", "received_at")
    list_filter = ("provider", "processed")
    readonly_fields = tuple(field.name for field in WebhookEvent._meta.fields)
