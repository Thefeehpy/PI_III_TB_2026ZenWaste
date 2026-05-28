from rest_framework import generics, status
from rest_framework.response import Response

from authentication.services import ZenWasteAPIView, require_empresa
from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto
from produtos.serializers import (
    InventoryItemInputSerializer,
    InventoryItemSerializer,
    InventoryItemUpdateSerializer,
    InventoryMovementInputSerializer,
    InventoryMovementSerializer,
    ProdutoSerializer,
    ReservationInputSerializer,
    ReservationSerializer,
    ReservationStatusUpdateSerializer,
    reservation_table_exists,
)
from produtos.services import (
    create_inventory_item,
    create_product_reservation,
    delete_inventory_item,
    register_inventory_movement,
    update_inventory_item,
    update_product_reservation,
)


class ProdutoCreateListView(generics.ListCreateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class ProdutoRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class ProdutoCreate(generics.CreateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class ProdutoUpdate(generics.UpdateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class ProdutoDestroy(generics.DestroyAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class ProdutoRetrieve(generics.RetrieveAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


class InventoryItemsAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        items = Produto.objects.filter(empresa=empresa).order_by("-atualizado_em")
        return Response({"items": InventoryItemSerializer(items, many=True).data})

    def post(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        serializer = InventoryItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        produto = create_inventory_item(empresa, serializer.validated_data)

        return Response({"item": InventoryItemSerializer(produto).data}, status=status.HTTP_201_CREATED)


class InventoryItemDetailAPIView(ZenWasteAPIView):
    def patch(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        try:
            produto = Produto.objects.get(id_produto=pk, empresa=empresa)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InventoryItemUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        produto = update_inventory_item(produto, serializer.validated_data)

        return Response({"item": InventoryItemSerializer(produto).data})

    def delete(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        try:
            produto = Produto.objects.get(id_produto=pk, empresa=empresa)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        closed_ads = delete_inventory_item(produto)
        return Response({"message": "Item excluido com sucesso.", "closedAds": closed_ads})


class InventoryMovementsAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        movements = MovimentacaoEstoque.objects.filter(empresa=empresa).select_related("produto")
        return Response({"movements": InventoryMovementSerializer(movements, many=True).data})


class InventoryItemMovementAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        try:
            produto = Produto.objects.get(id_produto=pk, empresa=empresa)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InventoryMovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movimento = register_inventory_movement(produto, empresa, serializer.validated_data)

        return Response({
            "item": InventoryItemSerializer(produto).data,
            "movement": InventoryMovementSerializer(movimento).data,
        })


class InventoryReservationsAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        if not reservation_table_exists():
            return Response({"items": []})

        reservations = Reserva.objects.filter(produto__empresa=empresa).select_related("produto")
        return Response({"items": ReservationSerializer(reservations, many=True).data})


class InventoryItemReservationsAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        if not reservation_table_exists():
            return Response(
                {"message": "Reservas ainda nao estao disponiveis neste banco de dados."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            produto = Produto.objects.get(id_produto=pk, empresa=empresa)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReservationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reserva = create_product_reservation(produto, serializer.validated_data)

        return Response({"reservation": ReservationSerializer(reserva).data}, status=status.HTTP_201_CREATED)


class InventoryReservationDetailAPIView(ZenWasteAPIView):
    def patch(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        if not reservation_table_exists():
            return Response(
                {"message": "Reservas ainda nao estao disponiveis neste banco de dados."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            reserva = Reserva.objects.select_related("produto").get(id_reserva=pk, produto__empresa=empresa)
        except Reserva.DoesNotExist:
            return Response({"message": "Reserva nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReservationStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reserva = update_product_reservation(reserva, serializer.validated_data["status"])

        return Response({"reservation": ReservationSerializer(reserva).data})
