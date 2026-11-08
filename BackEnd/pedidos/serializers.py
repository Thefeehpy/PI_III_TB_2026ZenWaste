from decimal import Decimal
import re

from rest_framework import serializers


class SerializadorCriacaoPedido(serializers.Serializer):
    listingId = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    buyer = serializers.DictField()

    def validate_buyer(self, valor):
        campos = ("name", "email", "document", "phone")
        if any(not isinstance(valor.get(campo), str) for campo in campos):
            raise serializers.ValidationError("Informe todos os dados do comprador.")

        compradora = {campo: valor[campo].strip() for campo in campos}
        if not compradora["name"] or len(compradora["name"]) > 120:
            raise serializers.ValidationError({"name": "Informe o nome do comprador."})
        if not compradora["email"] or len(compradora["email"]) > 256 or "@" not in compradora["email"]:
            raise serializers.ValidationError({"email": "Informe um e-mail valido."})

        documento = re.sub(r"\D", "", compradora["document"])
        if len(documento) != 14:
            raise serializers.ValidationError({"document": "Informe um CNPJ valido."})
        compradora["document"] = documento
        compradora["phone"] = re.sub(r"\D", "", compradora["phone"])
        if len(compradora["phone"]) < 10 or len(compradora["phone"]) > 13:
            raise serializers.ValidationError({"phone": "Informe um telefone valido."})
        return compradora


class SerializadorPagamentoCartao(serializers.Serializer):
    method = serializers.ChoiceField(choices=("credit", "debit"))
    token = serializers.CharField(max_length=512, trim_whitespace=True)
    brand = serializers.CharField(max_length=32, required=False, allow_blank=True)
    last4 = serializers.RegexField(r"^\d{4}$", required=False, allow_blank=True)
    installments = serializers.IntegerField(min_value=1, max_value=12, default=1)

    def to_internal_value(self, dados):
        campos_permitidos = {"method", "token", "brand", "last4", "installments"}
        campos_desconhecidos = set(dados) - campos_permitidos
        if campos_desconhecidos:
            raise serializers.ValidationError({
                "message": "Envie somente o token do provedor; dados brutos do cartao nao sao aceitos."
            })
        return super().to_internal_value(dados)

    def validate(self, atributos):
        if atributos["method"] == "debit" and atributos["installments"] != 1:
            raise serializers.ValidationError({"installments": "Debito aceita apenas pagamento a vista."})
        return atributos


class SerializadorPagamentoPix(serializers.Serializer):
    pass


class SerializadorResultadoSimulado(serializers.Serializer):
    result = serializers.ChoiceField(choices=("paid", "failed"))
