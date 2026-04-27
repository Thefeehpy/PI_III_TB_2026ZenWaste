from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import MvtoProduto, Produto
from inventory.serializers import MvtoProdutoSerializer, ProdutoSerializer


class InventoryIndexView(APIView):
    def get(self, request):
        return Response(
            {
                "name": "ZenWaste Inventory API",
                "endpoints": [
                    {"method": "GET", "path": "/api/inventory/items/", "description": "Lista itens privados."},
                    {"method": "POST", "path": "/api/inventory/items/", "description": "Cria item privado."},
                    {"method": "GET", "path": "/api/inventory/movements/", "description": "Lista movimentacoes."},
                    {"method": "POST", "path": "/api/inventory/items/<id>/movements/", "description": "Registra entrada ou saida."},
                ],
            }
        )


class InventoryItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ProdutoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Produto.objects.filter(empresa=self.request.user.empresa)
            .select_related("categoria_residuo", "unidade", "reserva")
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"items": serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response({"item": self.get_serializer(item).data}, status=status.HTTP_201_CREATED)


class InventoryItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProdutoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Produto.objects.filter(empresa=self.request.user.empresa)
            .select_related("categoria_residuo", "unidade", "reserva")
        )

    def retrieve(self, request, *args, **kwargs):
        return Response({"item": self.get_serializer(self.get_object()).data})

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return Response({"item": response.data})


class InventoryMovementListView(generics.ListAPIView):
    serializer_class = MvtoProdutoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            MvtoProduto.objects.filter(produto__empresa=self.request.user.empresa)
            .select_related("produto", "produto__categoria_residuo", "produto__unidade")
        )

    def list(self, request, *args, **kwargs):
        return Response({"movements": self.get_serializer(self.get_queryset(), many=True).data})


class InventoryItemMovementListCreateView(generics.ListCreateAPIView):
    serializer_class = MvtoProdutoSerializer
    permission_classes = [IsAuthenticated]

    def get_produto(self):
        return get_object_or_404(
            Produto.objects.select_related("categoria_residuo", "unidade", "reserva"),
            pk=self.kwargs["pk"],
            empresa=self.request.user.empresa,
        )

    def get_queryset(self):
        return (
            MvtoProduto.objects.filter(produto_id=self.kwargs["pk"], produto__empresa=self.request.user.empresa)
            .select_related("produto", "produto__categoria_residuo", "produto__unidade")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "POST":
            context["produto"] = self.get_produto()
        return context

    def list(self, request, *args, **kwargs):
        return Response({"movements": self.get_serializer(self.get_queryset(), many=True).data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = serializer.save()
        product_payload = ProdutoSerializer(movement.produto, context={"request": request}).data
        return Response(
            {"item": product_payload, "movement": self.get_serializer(movement).data},
            status=status.HTTP_201_CREATED,
        )
