"""Adaptador de compatibilidade da rota legada de anuncios."""
from rest_framework import serializers

from anuncios.models import Anuncio
from comercializacao.serializers import validar_valor_imagem_anuncio
from comercializacao.servicos import criar_anuncio


class SerializadorAnuncioLegado(serializers.ModelSerializer):
    imagem_url = serializers.CharField(required=False, allow_blank=True)
    status_anuncio = serializers.CharField(source="situacao_anuncio", read_only=True)

    class Meta:
        model = Anuncio
        fields = (
            "id_anuncio", "produto", "preco_final", "status_anuncio", "data_publicacao",
            "descricao_especifica", "nr_qtd", "data_final", "localizacao", "imagem_url",
        )
        read_only_fields = ("id_anuncio", "status_anuncio", "data_publicacao", "data_final")

    def validate_imagem_url(self, valor):
        return validar_valor_imagem_anuncio(valor)

    def validate_preco_final(self, valor):
        if valor < 0:
            raise serializers.ValidationError("O preco unitario nao pode ser negativo.")
        return valor

    def validate_nr_qtd(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("A quantidade anunciada deve ser positiva.")
        return valor

    def create(self, dados_validados):
        produto = dados_validados["produto"]
        return criar_anuncio(self.context["empresa"], {
            "inventoryId": produto.pk, "name": produto.nome_residuo,
            "type": produto.tipo_produto, "unit": produto.unidade,
            "price": dados_validados["preco_final"], "quantity": dados_validados["nr_qtd"],
            "description": dados_validados.get("descricao_especifica", ""),
            "location": dados_validados.get("localizacao", ""),
            "imageUrl": dados_validados.get("imagem_url", ""),
        })
