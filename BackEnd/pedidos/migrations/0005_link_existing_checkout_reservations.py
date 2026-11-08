"""Link checkout history without issuing physical stock a second time."""

from django.db import migrations


def link_checkout_reservations(apps, schema_editor):
    Order = apps.get_model("pedidos", "Order")
    Reservation = apps.get_model("anuncios", "Reserva")
    alias = schema_editor.connection.alias
    for order in Order.objects.using(alias).select_related("listing").iterator():
        active = order.status in ("awaiting_payment", "pending")
        status = "pronta" if active else (
            "finalizada" if order.status == "paid" else
            "expirada" if order.status == "expired" else "cancelada"
        )
        reservation, _ = Reservation.objects.using(alias).get_or_create(
            pedido_id=order.pk,
            defaults={
                "produto_id": order.listing.produto_id,
                "empresa_compradora_id": order.buyer_company_id,
                "quantidade_reservada": order.quantity,
                "preco_unitario": order.unit_price,
                "modalidade": "compromisso",
                "status": status,
                "nome_comprador": order.buyer_name,
                "numero_comprador": order.buyer_phone,
                "prazo_reserva": order.reservation_expires_at.date(),
                "data_finalizacao": None if active else (order.paid_at or order.updated_at),
            },
        )
        Reservation.objects.using(alias).filter(pk=reservation.pk).update(data_reserva=order.created_at)


def unlink_checkout_reservations(apps, schema_editor):
    # These records are projections of checkout history; retaining them when
    # the link column disappears would turn them into unrelated capture goals.
    # The original quantity, parties and prices remain preserved in Order.
    Reservation = apps.get_model("anuncios", "Reserva")
    Reservation.objects.using(schema_editor.connection.alias).filter(pedido__isnull=False).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pedidos", "0004_alter_order_buyer_company_alter_order_buyer_document_and_more"),
        ("anuncios", "0011_finalize_listing_structure"),
    ]

    operations = [migrations.RunPython(link_checkout_reservations, unlink_checkout_reservations)]
