from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto


def sync_status(produto):
    produto.atualizar_status()
    return produto


def create_inventory_item(empresa, data):
    produto = Produto(
        empresa=empresa,
        descricao_produto=data["name"].strip(),
        tipo_produto=data["type"].strip(),
        quantidade=data["quantity"],
        unidade=(data.get("unit") or "kg").strip() or "kg",
    )
    sync_status(produto)
    produto.save()

    if produto.quantidade > 0:
        MovimentacaoEstoque.objects.create(
            produto=produto,
            empresa=empresa,
            tipo="entrada",
            quantidade=produto.quantidade,
            observacao="Cadastro inicial",
            saldo_resultante=produto.quantidade,
        )

    return produto


def update_inventory_item(produto, data):
    field_map = {
        "name": "descricao_produto",
        "type": "tipo_produto",
        "unit": "unidade",
    }

    for request_field, model_field in field_map.items():
        if request_field in data:
            value = data[request_field]
            if request_field == "unit":
                value = (value or "kg").strip() or "kg"
            setattr(produto, model_field, value)

    sync_status(produto)
    produto.save()
    return produto


def calculate_reservation_status(produto, quantidade_reservada):
    if produto.quantidade >= quantidade_reservada:
        return "pronta"
    return "em_captacao"


def refresh_product_reservations(produto):
    open_reservations = Reserva.objects.filter(
        produto=produto,
        status__in=("em_captacao", "pronta"),
    )

    for reserva in open_reservations:
        next_status = calculate_reservation_status(produto, reserva.quantidade_reservada)
        if reserva.status != next_status:
            reserva.status = next_status
            reserva.save(update_fields=["status"])


@transaction.atomic
def create_product_reservation(produto, data):
    reserva = Reserva(
        produto=produto,
        quantidade_reservada=data["quantity"],
        preco_unitario=data["unitPrice"],
        nome_comprador=data["buyerName"].strip(),
        numero_comprador=data["buyerPhone"].strip(),
        observacao=(data.get("note") or "").strip(),
    )
    reserva.status = calculate_reservation_status(produto, reserva.quantidade_reservada)
    reserva.save()
    return reserva


@transaction.atomic
def update_product_reservation(reserva, status_value):
    if reserva.status in ("finalizada", "cancelada"):
        raise serializers.ValidationError({"message": "Reservas finalizadas nao podem ser alteradas."})

    if status_value == "cancelada":
        reserva.status = "cancelada"
        reserva.data_finalizacao = timezone.now()
        reserva.save()
        return reserva

    if status_value == "finalizada":
        if reserva.produto.quantidade < reserva.quantidade_reservada:
            raise serializers.ValidationError({
                "message": "Nao ha saldo suficiente para finalizar a venda desta reserva."
            })

        register_inventory_movement(reserva.produto, reserva.produto.empresa, {
            "type": "saida",
            "quantity": reserva.quantidade_reservada,
            "note": f"Venda finalizada pela reserva #{reserva.id_reserva}",
        })
        reserva.status = "finalizada"
        reserva.data_finalizacao = timezone.now()
        reserva.save()
        refresh_product_reservations(reserva.produto)
        return reserva

    reserva.status = calculate_reservation_status(reserva.produto, reserva.quantidade_reservada)
    reserva.save(update_fields=["status"])
    return reserva


def register_inventory_movement(produto, empresa, data):
    quantity = data["quantity"]
    movement_type = data["type"]

    resulting_quantity = (
        produto.quantidade + quantity
        if movement_type == "entrada"
        else produto.quantidade - quantity
    )

    if resulting_quantity < Decimal("0"):
        raise serializers.ValidationError({"message": "Saida maior que a quantidade disponivel."})

    produto.quantidade = resulting_quantity
    sync_status(produto)
    produto.save()

    movement = MovimentacaoEstoque.objects.create(
        produto=produto,
        empresa=empresa,
        tipo=movement_type,
        quantidade=quantity,
        observacao=data.get("note", ""),
        saldo_resultante=resulting_quantity,
    )

    refresh_product_reservations(produto)
    return movement
