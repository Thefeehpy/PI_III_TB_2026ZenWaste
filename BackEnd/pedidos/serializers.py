from decimal import Decimal
import re

from rest_framework import serializers


class CreateOrderSerializer(serializers.Serializer):
    listingId = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    buyer = serializers.DictField()

    def validate_buyer(self, value):
        fields = ("name", "email", "document", "phone")
        if any(not isinstance(value.get(field), str) for field in fields):
            raise serializers.ValidationError("Informe todos os dados do comprador.")

        buyer = {field: value[field].strip() for field in fields}
        if not buyer["name"] or len(buyer["name"]) > 120:
            raise serializers.ValidationError({"name": "Informe o nome do comprador."})
        if not buyer["email"] or len(buyer["email"]) > 256 or "@" not in buyer["email"]:
            raise serializers.ValidationError({"email": "Informe um e-mail valido."})

        document = re.sub(r"\D", "", buyer["document"])
        if len(document) != 14:
            raise serializers.ValidationError({"document": "Informe um CNPJ valido."})
        buyer["document"] = document
        buyer["phone"] = re.sub(r"\D", "", buyer["phone"])
        if len(buyer["phone"]) < 10 or len(buyer["phone"]) > 13:
            raise serializers.ValidationError({"phone": "Informe um telefone valido."})
        return buyer


class CardPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=("credit", "debit"))
    token = serializers.CharField(max_length=512, trim_whitespace=True)
    brand = serializers.CharField(max_length=32, required=False, allow_blank=True)
    last4 = serializers.RegexField(r"^\d{4}$", required=False, allow_blank=True)
    installments = serializers.IntegerField(min_value=1, max_value=12, default=1)

    def to_internal_value(self, data):
        allowed_fields = {"method", "token", "brand", "last4", "installments"}
        unknown_fields = set(data) - allowed_fields
        if unknown_fields:
            raise serializers.ValidationError({
                "message": "Envie somente o token do provedor; dados brutos do cartao nao sao aceitos."
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        if attrs["method"] == "debit" and attrs["installments"] != 1:
            raise serializers.ValidationError({"installments": "Debito aceita apenas pagamento a vista."})
        return attrs


class PixPaymentSerializer(serializers.Serializer):
    pass


class SandboxResultSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=("paid", "failed"))
