from decimal import Decimal
from urllib.parse import quote

from django.db import transaction
from rest_framework import serializers

from accounts.models import Empresa
from inventory.models import Produto
from inventory.serializers import ProdutoSerializer
from inventory.services import decimal_to_number, get_or_create_category, get_or_create_unit
from market.pricing import suggest_price
from marketplace.models import Anuncio, ImagemAnuncio


DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=400&h=300&fit=crop"


def digits_only(value: str) -> str:
    return "".join(character for character in value if character.isdigit())


def build_whatsapp_url(ad: Anuncio) -> str:
    message = quote(f'Ola! Vi o anuncio "{ad.produto.nome_residuo}" na ZenWaste e tenho interesse. Podemos negociar?')
    phone = digits_only(ad.produto.empresa.telefone_whatsapp)
    if phone and not phone.startswith("55"):
        phone = "55" + phone
    return f"https://wa.me/{phone}?text={message}" if phone else f"https://wa.me/?text={message}"


class ImagemAnuncioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImagemAnuncio
        fields = "__all__"


class AnuncioSerializer(serializers.ModelSerializer):
    inventoryId = serializers.IntegerField(write_only=True, required=False)
    name = serializers.CharField(write_only=True, max_length=100)
    type = serializers.CharField(write_only=True, max_length=50)
    description = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=500)
    quantity = serializers.DecimalField(source="nr_qntd", max_digits=10, decimal_places=2)
    unit = serializers.CharField(write_only=True, required=False, allow_blank=True)
    price = serializers.DecimalField(source="preco_final", max_digits=10, decimal_places=2)
    location = serializers.CharField(source="localizacao", required=False, allow_blank=True)
    imageUrl = serializers.URLField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Anuncio
        fields = [
            "id_anuncio",
            "inventoryId",
            "name",
            "type",
            "description",
            "quantity",
            "unit",
            "price",
            "location",
            "imageUrl",
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("A quantidade disponivel deve ser maior que zero.")
        return value

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("O preco sugerido nao pode ser negativo.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        company: Empresa = request.user.empresa
        inventory_id = validated_data.pop("inventoryId", None)
        name = validated_data.pop("name")
        waste_type = validated_data.pop("type")
        unit = validated_data.pop("unit", "kg") or "kg"
        image_url = validated_data.pop("imageUrl", "")
        description = validated_data.pop("description", "")
        quantity = validated_data["nr_qntd"]
        final_price = validated_data["preco_final"]
        location = validated_data.get("localizacao") or "Nao informado"
        product = None

        if inventory_id:
            product = Produto.objects.filter(pk=inventory_id, empresa=company).select_related("categoria_residuo", "unidade").first()
            if not product:
                raise serializers.ValidationError({"message": "Item de estoque nao encontrado."})
            if quantity > product.quantidade_total:
                raise serializers.ValidationError({"message": "A quantidade anunciada nao pode ultrapassar o saldo do estoque."})
            waste_type = product.categoria_residuo.nome_material
            unit = product.unidade.sigla_unidade

        suggested_price = Decimal(str(suggest_price(waste_type))).quantize(Decimal("0.01"))
        if final_price == 0:
            final_price = suggested_price

        with transaction.atomic():
            if product is None:
                product = Produto.objects.create(
                    empresa=company,
                    nome_residuo=name[:100],
                    categoria_residuo=get_or_create_category(waste_type),
                    unidade=get_or_create_unit(unit),
                    quantidade_total=quantity,
                )
                product.atualizar_status()
                product.save(update_fields=["status"])

            ad = Anuncio.objects.create(
                produto=product,
                preco_sugerido_ia=suggested_price,
                preco_final=final_price,
                descricao_especifico=(description or f"Material disponivel no estoque da {company.razao_social}.")[:500],
                nr_qntd=quantity,
                localizacao=location[:120],
            )

            if image_url:
                ImagemAnuncio.objects.create(produto=product, url_arquivo=image_url, eh_capa=True)

        return ad

    def update(self, instance, validated_data):
        if "name" in validated_data:
            instance.produto.nome_residuo = validated_data["name"][:100]
            instance.produto.save(update_fields=["nome_residuo"])
        if "description" in validated_data:
            instance.descricao_especifico = validated_data["description"][:500]
        if "nr_qntd" in validated_data:
            instance.nr_qntd = validated_data["nr_qntd"]
        if "preco_final" in validated_data:
            instance.preco_final = validated_data["preco_final"]
        if "localizacao" in validated_data:
            instance.localizacao = validated_data["localizacao"] or instance.localizacao
        instance.save()
        return instance

    def to_representation(self, instance):
        cover = instance.produto.imagens.filter(eh_capa=True).first() or instance.produto.imagens.first()
        return {
            "id": str(instance.id_anuncio),
            "name": instance.produto.nome_residuo,
            "type": instance.produto.categoria_residuo.nome_material,
            "description": instance.descricao_especifico,
            "quantity": decimal_to_number(instance.nr_qntd),
            "unit": instance.produto.unidade.sigla_unidade,
            "price": decimal_to_number(instance.preco_final),
            "location": instance.localizacao,
            "company": instance.produto.empresa.razao_social,
            "imageUrl": cover.url_arquivo if cover else DEFAULT_IMAGE_URL,
            "createdAt": instance.data_publicacao.isoformat(),
            "contactPhone": instance.produto.empresa.telefone_whatsapp,
            "whatsappUrl": build_whatsapp_url(instance),
        }
