from decimal import Decimal
from urllib.parse import quote

from rest_framework import serializers

from anuncios.imagens import QUANTIDADE_MAXIMA_IMAGENS_ANUNCIO, TAMANHO_MAXIMO_VALOR_IMAGEM, normalizar_imagens, validar_valor_imagem
from anuncios.models import Anuncio, ImagemAnuncio
from app.excecoes import ErroRegraNegocio
from produtos.consultas import quantidade_comprometida_carregada

URL_IMAGEM_PADRAO = "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&h=300&fit=crop"


def validar_valor_imagem_anuncio(valor):
    try:
        return validar_valor_imagem(valor)
    except ErroRegraNegocio as erro:
        raise serializers.ValidationError(erro.detalhes) from erro


class SerializadorEntradaImagemAnuncio(serializers.Serializer):
    url = serializers.CharField(max_length=TAMANHO_MAXIMO_VALOR_IMAGEM, trim_whitespace=False)
    isCover = serializers.BooleanField(required=False, default=False)
    order = serializers.IntegerField(min_value=0, required=False)

    def validate_url(self, valor):
        return validar_valor_imagem_anuncio(valor)


class SerializadorEntradaImagensAnuncio(serializers.Serializer):
    imageUrl = serializers.CharField(
        max_length=TAMANHO_MAXIMO_VALOR_IMAGEM, allow_blank=True, required=False, trim_whitespace=False,
    )
    images = SerializadorEntradaImagemAnuncio(many=True, required=False, max_length=QUANTIDADE_MAXIMA_IMAGENS_ANUNCIO)

    def validate_imageUrl(self, valor):
        return validar_valor_imagem_anuncio(valor)

    def validate_images(self, valor):
        try:
            return normalizar_imagens(valor)
        except ErroRegraNegocio as erro:
            raise serializers.ValidationError(erro.detalhes) from erro

    def validate(self, dados):
        if "images" in dados and "imageUrl" in dados:
            raise serializers.ValidationError({"images": "Envie images ou imageUrl, sem combinar os dois campos."})
        return dados


class SerializadorEntradaAnuncio(SerializadorEntradaImagensAnuncio):
    inventoryId = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(max_length=256)
    type = serializers.CharField(max_length=50)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    location = serializers.CharField(max_length=120, allow_blank=True, required=False)


class SerializadorAtualizacaoAnuncio(SerializadorEntradaImagensAnuncio):
    name = serializers.CharField(max_length=256, required=False)
    type = serializers.CharField(max_length=50, required=False)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"), required=False)
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False)
    location = serializers.CharField(max_length=120, allow_blank=True, required=False)


class SerializadorFinalizacaoAnuncio(serializers.Serializer):
    soldQuantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    buyerName = serializers.CharField(max_length=120, required=False, allow_blank=True)
    buyerPhone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    buyerCompanyId = serializers.IntegerField(min_value=1, required=False)
    reservationQuantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001"), required=False, allow_null=True,
    )
    reservationUnitPrice = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True,
    )
    reservationNote = serializers.CharField(max_length=500, allow_blank=True, required=False)


class SerializadorImagemAnuncio(serializers.ModelSerializer):
    id = serializers.CharField(source="pk")
    url = serializers.CharField(source="url_arquivo")
    isCover = serializers.BooleanField(source="eh_capa")
    order = serializers.IntegerField(source="ordem")

    class Meta:
        model = ImagemAnuncio
        fields = ("id", "url", "isCover", "order")


class SerializadorAnuncioComercial(serializers.ModelSerializer):
    id = serializers.SerializerMethodField(method_name="obter_id")
    name = serializers.CharField(source="produto.nome_residuo")
    type = serializers.CharField(source="produto.tipo_produto")
    description = serializers.SerializerMethodField(method_name="obter_descricao")
    quantity = serializers.SerializerMethodField(method_name="obter_quantidade")
    unit = serializers.CharField(source="produto.unidade")
    price = serializers.SerializerMethodField(method_name="obter_preco")
    location = serializers.CharField(source="localizacao")
    company = serializers.SerializerMethodField(method_name="obter_empresa")
    imageUrl = serializers.SerializerMethodField(method_name="obter_url_imagem")
    images = SerializadorImagemAnuncio(source="imagens", many=True, read_only=True)
    createdAt = serializers.SerializerMethodField(method_name="obter_data_criacao")
    contactPhone = serializers.SerializerMethodField(method_name="obter_telefone_contato")
    whatsappUrl = serializers.SerializerMethodField(method_name="obter_url_whatsapp")

    class Meta:
        model = Anuncio
        fields = (
            "id", "name", "type", "description", "quantity", "unit", "price",
            "location", "company", "imageUrl", "images", "createdAt", "contactPhone", "whatsappUrl",
        )

    def obter_id(self, anuncio):
        return str(anuncio.id_anuncio)

    def obter_descricao(self, anuncio):
        return anuncio.descricao_especifica or anuncio.produto.descricao_produto

    def obter_quantidade(self, anuncio):
        return float(anuncio.nr_qtd)

    def obter_preco(self, anuncio):
        return float(anuncio.preco_final)

    def obter_empresa(self, anuncio):
        return anuncio.produto.empresa.razao_social

    def obter_url_imagem(self, anuncio):
        return anuncio.imagem_url or URL_IMAGEM_PADRAO

    def obter_data_criacao(self, anuncio):
        return anuncio.data_publicacao.date().isoformat()

    def obter_telefone_contato(self, anuncio):
        return anuncio.produto.empresa.telefone_whatsapp

    def obter_url_whatsapp(self, anuncio):
        telefone = "".join(caractere for caractere in anuncio.produto.empresa.telefone_whatsapp if caractere.isdigit())
        prefixo_pais = "" if telefone.startswith("55") else "55"
        mensagem = f"Ola, tenho interesse no residuo {anuncio.produto.nome_residuo} anunciado na ZenWaste."
        return f"https://wa.me/{prefixo_pais}{telefone}?text={quote(mensagem)}"


class SerializadorAnuncioVendedor(SerializadorAnuncioComercial):
    itemId = serializers.SerializerMethodField(method_name="obter_id_item")
    status = serializers.CharField(source="situacao_anuncio")
    availableQuantity = serializers.SerializerMethodField(method_name="obter_quantidade_disponivel")

    class Meta(SerializadorAnuncioComercial.Meta):
        fields = SerializadorAnuncioComercial.Meta.fields + ("itemId", "status", "availableQuantity")

    def obter_id_item(self, anuncio):
        return str(anuncio.produto_id)

    def obter_quantidade_disponivel(self, anuncio):
        disponivel_produto = anuncio.produto.quantidade - quantidade_comprometida_carregada(anuncio.produto)
        disponivel_anuncio = anuncio.nr_qtd - quantidade_comprometida_carregada(anuncio.produto, id_anuncio=anuncio.pk)
        return float(max(Decimal("0"), min(disponivel_produto, disponivel_anuncio)))
