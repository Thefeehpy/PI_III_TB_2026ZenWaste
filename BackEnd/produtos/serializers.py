from decimal import Decimal
from functools import lru_cache

from django.db import connection
from rest_framework import serializers

from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto


@lru_cache(maxsize=1)
def reservation_table_exists():
    return Reserva._meta.db_table in connection.introspection.table_names()


class ProdutoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Produto
        fields = "__all__"


class InventoryItemInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    type = serializers.CharField(max_length=50)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0"))
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True, default="kg")
    targetQuantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
        allow_null=True,
    )
    deadline = serializers.DateField(required=False, allow_null=True)


class InventoryItemUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False)
    type = serializers.CharField(max_length=50, required=False)
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)
    targetQuantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
        allow_null=True,
    )
    deadline = serializers.DateField(required=False, allow_null=True)


class InventoryMovementInputSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=("entrada", "saida"))
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class ReservationInputSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    unitPrice = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    buyerName = serializers.CharField(max_length=120)
    buyerPhone = serializers.CharField(max_length=20)
    deadline = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class ReservationStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("em_captacao", "pronta", "finalizada", "cancelada"))


class InventoryItemSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    name = serializers.CharField(source="descricao_produto")
    type = serializers.CharField(source="tipo_produto")
    quantity = serializers.SerializerMethodField()
    unit = serializers.CharField(source="unidade")
    targetQuantity = serializers.SerializerMethodField()
    deadline = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    createdAt = serializers.SerializerMethodField()
    updatedAt = serializers.SerializerMethodField()

    class Meta:
        model = Produto
        fields = (
            "id",
            "name",
            "type",
            "quantity",
            "unit",
            "targetQuantity",
            "deadline",
            "status",
            "createdAt",
            "updatedAt",
        )

    def get_id(self, produto):
        return str(produto.id_produto)

    def get_quantity(self, produto):
        return float(produto.quantidade)

    def get_targetQuantity(self, produto):
        if hasattr(produto, "_target_quantity"):
            return float(produto._target_quantity)

        if not reservation_table_exists():
            return 0

        total = Decimal("0")
        reservas = getattr(produto, "reservas", None)
        if reservas is not None:
            total = sum(
                (reserva.quantidade_reservada for reserva in reservas.filter(status__in=("em_captacao", "pronta"))),
                Decimal("0"),
            )

        return float(total)

    def get_deadline(self, produto):
        if hasattr(produto, "_deadline") and produto._deadline:
            return produto._deadline.isoformat()

        if reservation_table_exists():
            reserva = produto.reservas.filter(status__in=("em_captacao", "pronta")).order_by("data_reserva").first()
            if reserva and reserva.prazo_reserva:
                return reserva.prazo_reserva.isoformat()
            if reserva:
                return reserva.data_reserva.date().isoformat()

        return produto.data_registro.isoformat()

    def get_status(self, produto):
        target_quantity = Decimal(str(self.get_targetQuantity(produto)))

        if produto.quantidade <= 0:
            return "em_estoque"

        if target_quantity > 0 and produto.quantidade < target_quantity:
            return "em_producao"

        return "concluido"

    def get_createdAt(self, produto):
        return produto.data_registro.isoformat()

    def get_updatedAt(self, produto):
        return produto.atualizado_em.isoformat()


class InventoryMovementSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    itemId = serializers.SerializerMethodField()
    itemName = serializers.CharField(source="produto.descricao_produto")
    itemType = serializers.CharField(source="produto.tipo_produto")
    quantity = serializers.SerializerMethodField()
    unit = serializers.CharField(source="produto.unidade")
    note = serializers.CharField(source="observacao")
    createdAt = serializers.SerializerMethodField()
    resultingQuantity = serializers.SerializerMethodField()

    class Meta:
        model = MovimentacaoEstoque
        fields = (
            "id",
            "itemId",
            "itemName",
            "itemType",
            "type",
            "quantity",
            "unit",
            "note",
            "createdAt",
            "resultingQuantity",
        )

    type = serializers.CharField(source="tipo")

    def get_id(self, movimento):
        return str(movimento.id_movimentacao)

    def get_itemId(self, movimento):
        return str(movimento.produto_id)

    def get_quantity(self, movimento):
        return float(movimento.quantidade)

    def get_createdAt(self, movimento):
        return movimento.criado_em.isoformat()

    def get_resultingQuantity(self, movimento):
        return float(movimento.saldo_resultante)


class ReservationSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    itemId = serializers.SerializerMethodField()
    itemName = serializers.CharField(source="produto.descricao_produto")
    itemType = serializers.CharField(source="produto.tipo_produto")
    unit = serializers.CharField(source="produto.unidade")
    currentQuantity = serializers.SerializerMethodField()
    missingQuantity = serializers.SerializerMethodField()
    buyerName = serializers.CharField(source="nome_comprador")
    buyerPhone = serializers.CharField(source="numero_comprador")
    quantity = serializers.SerializerMethodField()
    unitPrice = serializers.SerializerMethodField()
    totalPrice = serializers.SerializerMethodField()
    note = serializers.CharField(source="observacao")
    deadline = serializers.SerializerMethodField()
    reservedAt = serializers.SerializerMethodField()
    finalizedAt = serializers.SerializerMethodField()

    class Meta:
        model = Reserva
        fields = (
            "id",
            "itemId",
            "itemName",
            "itemType",
            "unit",
            "currentQuantity",
            "missingQuantity",
            "buyerName",
            "buyerPhone",
            "quantity",
            "unitPrice",
            "totalPrice",
            "status",
            "note",
            "deadline",
            "reservedAt",
            "finalizedAt",
        )

    def get_id(self, reserva):
        return str(reserva.id_reserva)

    def get_itemId(self, reserva):
        return str(reserva.produto_id)

    def get_currentQuantity(self, reserva):
        return float(reserva.produto.quantidade)

    def get_missingQuantity(self, reserva):
        missing = reserva.quantidade_reservada - reserva.produto.quantidade
        return float(max(missing, Decimal("0")))

    def get_quantity(self, reserva):
        return float(reserva.quantidade_reservada)

    def get_unitPrice(self, reserva):
        return float(reserva.preco_unitario)

    def get_totalPrice(self, reserva):
        return float(reserva.quantidade_reservada * reserva.preco_unitario)

    def get_deadline(self, reserva):
        return reserva.prazo_reserva.isoformat() if reserva.prazo_reserva else ""

    def get_reservedAt(self, reserva):
        return reserva.data_reserva.isoformat()

    def get_finalizedAt(self, reserva):
        return reserva.data_finalizacao.isoformat() if reserva.data_finalizacao else ""
