from decimal import Decimal
from urllib.parse import quote

from rest_framework import serializers

from anuncios.models import Anuncio


DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&h=300&fit=crop"


class MarketplaceAdInputSerializer(serializers.Serializer):
    inventoryId = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(max_length=256)
    type = serializers.CharField(max_length=50)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True, default="kg")
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    location = serializers.CharField(max_length=120, allow_blank=True, required=False)
    imageUrl = serializers.URLField(max_length=500, allow_blank=True, required=False)


class MarketplaceAdUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False)
    type = serializers.CharField(max_length=50, required=False)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=False)
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False)
    location = serializers.CharField(max_length=120, allow_blank=True, required=False)
    imageUrl = serializers.URLField(max_length=500, allow_blank=True, required=False)


class FinalizeAdSerializer(serializers.Serializer):
    soldQuantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    buyerName = serializers.CharField(max_length=120, required=False, allow_blank=True)
    buyerPhone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    reservationQuantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
        allow_null=True,
    )
    reservationUnitPrice = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
        allow_null=True,
    )
    reservationNote = serializers.CharField(max_length=500, allow_blank=True, required=False)


class MarketplaceAdSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    name = serializers.CharField(source="produto.descricao_produto")
    type = serializers.CharField(source="produto.tipo_produto")
    description = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()
    unit = serializers.CharField(source="produto.unidade")
    price = serializers.SerializerMethodField()
    location = serializers.CharField(source="localizacao")
    company = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()
    createdAt = serializers.SerializerMethodField()
    contactPhone = serializers.SerializerMethodField()
    whatsappUrl = serializers.SerializerMethodField()

    class Meta:
        model = Anuncio
        fields = (
            "id",
            "name",
            "type",
            "description",
            "quantity",
            "unit",
            "price",
            "location",
            "company",
            "imageUrl",
            "createdAt",
            "contactPhone",
            "whatsappUrl",
        )

    def get_id(self, anuncio):
        return str(anuncio.id_anuncio)

    def get_description(self, anuncio):
        return anuncio.descricao_especifica or anuncio.produto.descricao_produto

    def get_quantity(self, anuncio):
        return float(anuncio.nr_qtd)

    def get_price(self, anuncio):
        return float(anuncio.preco_final)

    def get_company(self, anuncio):
        empresa = anuncio.produto.empresa
        return empresa.razao_social if empresa else "Empresa ZenWaste"

    def get_imageUrl(self, anuncio):
        return anuncio.imagem_url or DEFAULT_IMAGE_URL

    def get_createdAt(self, anuncio):
        return anuncio.data_publicacao.date().isoformat()

    def get_contactPhone(self, anuncio):
        empresa = anuncio.produto.empresa
        return empresa.telefone_whatsapp if empresa else ""

    def get_whatsappUrl(self, anuncio):
        empresa = anuncio.produto.empresa
        if not empresa:
            return ""

        phone = "".join(character for character in empresa.telefone_whatsapp if character.isdigit())
        country_prefix = "" if phone.startswith("55") else "55"
        message = f"Ola, tenho interesse no residuo {anuncio.produto.descricao_produto} anunciado na ZenWaste."
        return f"https://wa.me/{country_prefix}{phone}?text={quote(message)}"


class SellerAdSerializer(MarketplaceAdSerializer):
    itemId = serializers.SerializerMethodField()
    status = serializers.CharField(source="status_anuncio")
    availableQuantity = serializers.SerializerMethodField()

    class Meta(MarketplaceAdSerializer.Meta):
        fields = MarketplaceAdSerializer.Meta.fields + (
            "itemId",
            "status",
            "availableQuantity",
        )

    def get_itemId(self, anuncio):
        return str(anuncio.produto_id)

    def get_availableQuantity(self, anuncio):
        return float(anuncio.produto.quantidade)
