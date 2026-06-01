from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from anuncios.models import Reserva
from authentication.services import normalize_text
from anuncios.models import Anuncio
from produtos.models import MovimentacaoEstoque, Produto
from produtos.serializers import reservation_table_exists


def clean_inventory_name(name):
    return " ".join(str(name or "").strip().split())


def validate_unique_inventory_name(empresa, name, current_product=None):
    normalized_name = normalize_text(name)
    products = Produto.objects.filter(empresa=empresa)

    if current_product:
        products = products.exclude(id_produto=current_product.id_produto)

    for product in products.only("id_produto", "descricao_produto"):
        if normalize_text(product.descricao_produto) == normalized_name:
            raise serializers.ValidationError({
                "message": "Ja existe um item cadastrado com esse nome. Use o item existente ou escolha outro nome."
            })


def sync_status(produto):
    produto.atualizar_status()
    return produto


def create_inventory_item(empresa, data):
    name = clean_inventory_name(data["name"])
    validate_unique_inventory_name(empresa, name)

    produto = Produto(
        empresa=empresa,
        descricao_produto=name,
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

    target_quantity = data.get("targetQuantity")
    if target_quantity and reservation_table_exists():
        create_product_reservation(produto, {
            "quantity": target_quantity,
            "unitPrice": Decimal("0"),
            "buyerName": "Reserva do cliente",
            "buyerPhone": "-",
            "deadline": data.get("deadline"),
            "note": "Reserva registrada no cadastro do item.",
        })
        produto._target_quantity = target_quantity

    if data.get("deadline"):
        produto._deadline = data["deadline"]

    return produto


def update_inventory_item(produto, data):
    if "name" in data:
        data["name"] = clean_inventory_name(data["name"])
        validate_unique_inventory_name(produto.empresa, data["name"], current_product=produto)

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

    target_quantity = data.get("targetQuantity")
    if target_quantity and reservation_table_exists():
        reserva = Reserva.objects.filter(
            produto=produto,
            status__in=("em_captacao", "pronta"),
        ).order_by("data_reserva").first()

        if reserva:
            reserva.quantidade_reservada = target_quantity
            reserva.prazo_reserva = data.get("deadline")
            reserva.status = calculate_reservation_status(produto, target_quantity)
            reserva.save(update_fields=["quantidade_reservada", "prazo_reserva", "status"])
        else:
            create_product_reservation(produto, {
                "quantity": target_quantity,
                "unitPrice": Decimal("0"),
                "buyerName": "Reserva do cliente",
                "buyerPhone": "-",
                "deadline": data.get("deadline"),
                "note": "Reserva registrada no detalhe do item.",
            })

        produto._target_quantity = target_quantity

    if data.get("deadline"):
        produto._deadline = data["deadline"]

    return produto


@transaction.atomic
def delete_inventory_item(produto):
    closed_ads = Anuncio.objects.filter(produto=produto, status_anuncio="ativo").update(
        status_anuncio="inativo",
        data_final=timezone.localdate(),
    )
    produto.delete()
    return closed_ads


def calculate_reservation_status(produto, quantidade_reservada):
    if produto.quantidade >= quantidade_reservada:
        return "pronta"
    return "em_captacao"


def refresh_product_reservations(produto):
    if not reservation_table_exists():
        return

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
    if not reservation_table_exists():
        raise serializers.ValidationError({"message": "Reservas ainda nao estao disponiveis neste banco de dados."})

    reserva = Reserva(
        produto=produto,
        quantidade_reservada=data["quantity"],
        preco_unitario=data["unitPrice"],
        nome_comprador=data["buyerName"].strip(),
        numero_comprador=data["buyerPhone"].strip(),
        prazo_reserva=data.get("deadline"),
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


@transaction.atomic
def register_inventory_movement(produto, empresa, data):
    if not empresa or produto.empresa_id != empresa.id_empresa:
        raise serializers.ValidationError({"message": "Este item de estoque nao pertence ao usuario autenticado."})

    try:
        produto_bloqueado = Produto.objects.select_for_update().get(
            id_produto=produto.id_produto,
            empresa=empresa,
        )
    except Produto.DoesNotExist:
        raise serializers.ValidationError({"message": "Item de estoque nao encontrado para este usuario."})
    quantity = data["quantity"]
    movement_type = data["type"]

    resulting_quantity = (
        produto_bloqueado.quantidade + quantity
        if movement_type == "entrada"
        else produto_bloqueado.quantidade - quantity
    )

    if resulting_quantity < Decimal("0"):
        raise serializers.ValidationError({"message": "Saida maior que a quantidade disponivel."})

    produto_bloqueado.quantidade = resulting_quantity
    sync_status(produto_bloqueado)
    produto_bloqueado.save()

    movement = MovimentacaoEstoque.objects.create(
        produto=produto_bloqueado,
        empresa=empresa,
        tipo=movement_type,
        quantidade=quantity,
        observacao=data.get("note", ""),
        saldo_resultante=resulting_quantity,
    )

    refresh_product_reservations(produto_bloqueado)

    produto.quantidade = produto_bloqueado.quantidade
    produto.status = produto_bloqueado.status
    produto.atualizado_em = produto_bloqueado.atualizado_em

    return movement
