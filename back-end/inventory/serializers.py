from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from inventory.models import MvtoProduto, Produto, Reserva
from inventory.services import decimal_to_number, get_or_create_category, get_or_create_unit


class ProdutoSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="nome_residuo", max_length=100)
    type = serializers.CharField(write_only=True)
    quantity = serializers.DecimalField(source="quantidade_total", max_digits=10, decimal_places=2)
    unit = serializers.CharField(write_only=True)
    targetQuantity = serializers.DecimalField(write_only=True, max_digits=10, decimal_places=2)
    deadline = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Produto
        fields = [
            "id_produto",
            "name",
            "type",
            "quantity",
            "unit",
            "targetQuantity",
            "deadline",
        ]

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("A quantidade nao pode ser negativa.")
        return value

    def validate_targetQuantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("A meta deve ser maior que zero.")
        return value

    def create(self, validated_data):
        company = self.context["request"].user.empresa
        waste_type = validated_data.pop("type")
        unit_sigla = validated_data.pop("unit")
        target_quantity = validated_data.pop("targetQuantity")
        validated_data.pop("deadline", None)

        with transaction.atomic():
            reserva = Reserva.objects.create(status_meta="em_aberto", qntd_reserva=target_quantity)
            produto = Produto.objects.create(
                empresa=company,
                categoria_residuo=get_or_create_category(waste_type),
                unidade=get_or_create_unit(unit_sigla),
                reserva=reserva,
                **validated_data,
            )
            produto.atualizar_status()
            produto.save(update_fields=["status"])

            if produto.quantidade_total > 0:
                MvtoProduto.objects.create(produto=produto, nr_qntd=produto.quantidade_total)

        return produto

    def update(self, instance, validated_data):
        if "nome_residuo" in validated_data:
            instance.nome_residuo = validated_data["nome_residuo"]
        if "quantidade_total" in validated_data:
            nova_quantidade = validated_data["quantidade_total"]
            diferenca = nova_quantidade - instance.quantidade_total
            instance.quantidade_total = nova_quantidade
            if diferenca:
                MvtoProduto.objects.create(produto=instance, nr_qntd=diferenca)
        if "type" in validated_data:
            instance.categoria_residuo = get_or_create_category(validated_data["type"])
        if "unit" in validated_data:
            instance.unidade = get_or_create_unit(validated_data["unit"])
        if "targetQuantity" in validated_data:
            if instance.reserva:
                instance.reserva.qntd_reserva = validated_data["targetQuantity"]
                instance.reserva.save(update_fields=["qntd_reserva"])
            else:
                instance.reserva = Reserva.objects.create(qntd_reserva=validated_data["targetQuantity"])

        instance.atualizar_status()
        instance.save()
        return instance

    def to_representation(self, instance):
        return {
            "id": str(instance.id_produto),
            "name": instance.nome_residuo,
            "type": instance.categoria_residuo.nome_material,
            "quantity": decimal_to_number(instance.quantidade_total),
            "unit": instance.unidade.sigla_unidade,
            "targetQuantity": decimal_to_number(instance.meta_quantidade),
            "deadline": instance.data_registro.isoformat(),
            "status": instance.api_status,
            "createdAt": instance.data_registro.isoformat(),
            "updatedAt": instance.data_registro.isoformat(),
        }


class MvtoProdutoSerializer(serializers.ModelSerializer):
    itemId = serializers.CharField(source="produto_id", read_only=True)
    type = serializers.ChoiceField(choices=["entrada", "saida"], write_only=True)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True)
    note = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = MvtoProduto
        fields = ["id_estoque", "itemId", "type", "quantity", "note"]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("A quantidade deve ser maior que zero.")
        return value

    def create(self, validated_data):
        produto = self.context["produto"]
        movement_type = validated_data["type"]
        quantity = validated_data["quantity"]

        if movement_type == "saida" and quantity > produto.quantidade_total:
            raise serializers.ValidationError({"message": "A saida nao pode ser maior que o saldo disponivel em estoque."})

        signed_quantity = quantity if movement_type == "entrada" else -quantity
        with transaction.atomic():
            produto.quantidade_total += signed_quantity
            produto.atualizar_status()
            produto.save(update_fields=["quantidade_total", "status"])
            return MvtoProduto.objects.create(produto=produto, nr_qntd=signed_quantity)

    def to_representation(self, instance):
        movement_type = "entrada" if instance.nr_qntd >= Decimal("0") else "saida"
        return {
            "id": str(instance.id_estoque),
            "itemId": str(instance.produto_id),
            "itemName": instance.produto.nome_residuo,
            "itemType": instance.produto.categoria_residuo.nome_material,
            "type": movement_type,
            "quantity": decimal_to_number(abs(instance.nr_qntd)),
            "unit": instance.produto.unidade.sigla_unidade,
            "note": None,
            "createdAt": instance.dt_entrada.isoformat(),
            "resultingQuantity": decimal_to_number(instance.produto.quantidade_total),
        }
