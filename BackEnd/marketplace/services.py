from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from anuncios.models import Anuncio
from produtos.models import Produto

from produtos.services import (
    clean_inventory_name,
    create_product_reservation,
    register_inventory_movement,
    validate_unique_inventory_name,
)

from marketplace.builders import VendaAdBuilder

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
        name = clean_inventory_name(data["name"])
        validate_unique_inventory_name(empresa, name, current_product=produto)
        produto.descricao_produto = name
        produto.tipo_produto = data["type"].strip()
        produto.unidade = (data.get("unit") or produto.unidade or "kg").strip() or "kg"
        if data["quantity"] > produto.quantidade:
            raise serializers.ValidationError({
                "message": "A quantidade anunciada nao pode ultrapassar o saldo atual do produto."
            })
        produto.atualizar_status()
        produto.save()
        return produto

    name = clean_inventory_name(data["name"])
    validate_unique_inventory_name(empresa, name)
    produto = Produto(
        empresa=empresa,
        descricao_produto=name,
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
            if request_field == "name":
                value = clean_inventory_name(value)
                validate_unique_inventory_name(produto.empresa, value, current_product=produto)
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
    builder = VendaAdBuilder(anuncio)
    
    # Orquestração fluida (Method Chaining)
    resultado = (
        builder
        .com_quantidade_vendida(data["soldQuantity"])
        .adicionar_reserva(data)
        .executar()
    )
    
    return resultado