from decimal import Decimal

from rest_framework import serializers

from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto


class ProdutoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Produto
        fields = "__all__"


class InventoryItemInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    type = serializers.CharField(max_length=50)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0"))
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True, default="kg")


class InventoryItemUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False)
    type = serializers.CharField(max_length=50, required=False)
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)


class InventoryMovementInputSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=("entrada", "saida"))
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class ReservationInputSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    unitPrice = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    buyerName = serializers.CharField(max_length=120)
    buyerPhone = serializers.CharField(max_length=20)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class ReservationStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("em_captacao", "pronta", "finalizada", "cancelada"))


class InventoryItemSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    name = serializers.CharField(source="descricao_produto")
    type = serializers.CharField(source="tipo_produto")
    quantity = serializers.SerializerMethodField()
    unit = serializers.CharField(source="unidade")
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
            "status",
            "createdAt",
            "updatedAt",
        )

    def get_id(self, produto):
        return str(produto.id_produto)

    def get_quantity(self, produto):
        return float(produto.quantidade)

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

    def get_reservedAt(self, reserva):
        return reserva.data_reserva.isoformat()

    def get_finalizedAt(self, reserva):
        return reserva.data_finalizacao.isoformat() if reserva.data_finalizacao else ""
