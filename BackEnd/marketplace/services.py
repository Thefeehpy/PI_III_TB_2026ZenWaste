from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from anuncios.models import Anuncio
from produtos.models import Produto
from produtos.services import create_product_reservation, register_inventory_movement


def list_active_ads(filters):
    ads = Anuncio.objects.filter(status_anuncio="ativo").select_related("produto", "produto__empresa")

    if filters.get("type"):
        ads = ads.filter(produto__tipo_produto__icontains=filters["type"])
    if filters.get("location"):
        ads = ads.filter(localizacao__icontains=filters["location"])
    if filters.get("minPrice"):
        ads = ads.filter(preco_final__gte=filters["minPrice"])
    if filters.get("maxPrice"):
        ads = ads.filter(preco_final__lte=filters["maxPrice"])

    return ads.order_by("-data_publicacao")


def resolve_product_for_ad(empresa, data):
    produto = None
    inventory_id = data.get("inventoryId")

    if inventory_id:
        produto = Produto.objects.filter(id_produto=inventory_id, empresa=empresa).first()

    if produto:
        produto.descricao_produto = data["name"].strip()
        produto.tipo_produto = data["type"].strip()
        produto.unidade = (data.get("unit") or produto.unidade or "kg").strip() or "kg"
        if data["quantity"] > produto.quantidade:
            raise serializers.ValidationError({
                "message": "A quantidade anunciada nao pode ultrapassar o saldo atual do produto."
            })
        produto.atualizar_status()
        produto.save()
        return produto

    produto = Produto(
        empresa=empresa,
        descricao_produto=data["name"].strip(),
        tipo_produto=data["type"].strip(),
        quantidade=0,
        unidade=(data.get("unit") or "kg").strip() or "kg",
    )
    produto.atualizar_status()
    produto.save()
    if data["quantity"] > 0:
        register_inventory_movement(produto, empresa, {
            "type": "entrada",
            "quantity": data["quantity"],
            "note": "Cadastro inicial via anuncio",
        })
    return produto


def create_ad(empresa, data):
    produto = resolve_product_for_ad(empresa, data)

    return Anuncio.objects.create(
        produto=produto,
        preco_final=data["price"],
        descricao_especifica=(data.get("description") or "").strip(),
        nr_qtd=data["quantity"],
        localizacao=(data.get("location") or "").strip(),
        imagem_url=(data.get("imageUrl") or "").strip(),
    )


def update_ad(anuncio, data):
    produto = anuncio.produto

    product_fields = {
        "name": "descricao_produto",
        "type": "tipo_produto",
        "unit": "unidade",
    }
    ad_fields = {
        "description": "descricao_especifica",
        "quantity": "nr_qtd",
        "price": "preco_final",
        "location": "localizacao",
        "imageUrl": "imagem_url",
    }

    if "quantity" in data and data["quantity"] > produto.quantidade:
        raise serializers.ValidationError({
            "message": "A quantidade anunciada nao pode ultrapassar o saldo atual do produto."
        })

    for request_field, model_field in product_fields.items():
        if request_field in data:
            value = data[request_field]
            if request_field == "unit":
                value = (value or produto.unidade or "kg").strip() or "kg"
            setattr(produto, model_field, value)

    for request_field, model_field in ad_fields.items():
        if request_field in data:
            setattr(anuncio, model_field, data[request_field])

    produto.atualizar_status()
    produto.save()
    anuncio.save()
    return anuncio


def list_seller_ads(empresa):
    return Anuncio.objects.filter(produto__empresa=empresa).select_related(
        "produto",
        "produto__empresa",
    ).order_by("-data_publicacao")


@transaction.atomic
def finalize_ad_sale(anuncio, data):
    produto = anuncio.produto
    sold_quantity = data["soldQuantity"]

    if anuncio.status_anuncio != "ativo":
        raise serializers.ValidationError({"message": "Apenas anuncios ativos podem ser finalizados."})

    if sold_quantity > produto.quantidade:
        raise serializers.ValidationError({
            "message": "A quantidade vendida nao pode ultrapassar o saldo atual do produto."
        })

    movimento = register_inventory_movement(produto, produto.empresa, {
        "type": "saida",
        "quantity": sold_quantity,
        "note": f"Venda finalizada pelo anuncio #{anuncio.id_anuncio}",
    })

    anuncio.status_anuncio = "vendido"
    anuncio.data_final = timezone.localdate()
    anuncio.save(update_fields=["status_anuncio", "data_final"])

    reserva = None
    reservation_quantity = data.get("reservationQuantity")
    if reservation_quantity:
        buyer_name = (data.get("buyerName") or "").strip()
        buyer_phone = (data.get("buyerPhone") or "").strip()

        if not buyer_name or not buyer_phone:
            raise serializers.ValidationError({
                "message": "Informe nome e numero do comprador para criar a reserva."
            })

        reserva = create_product_reservation(produto, {
            "quantity": reservation_quantity,
            "unitPrice": data.get("reservationUnitPrice") or anuncio.preco_final,
            "buyerName": buyer_name,
            "buyerPhone": buyer_phone,
            "note": data.get("reservationNote", ""),
        })

    return {
        "ad": anuncio,
        "movement": movimento,
        "reservation": reserva,
    }
