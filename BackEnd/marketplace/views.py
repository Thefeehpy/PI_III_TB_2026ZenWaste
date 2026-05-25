from rest_framework import status
from rest_framework.response import Response

from anuncios.models import Anuncio
from authentication.services import ZenWasteAPIView, require_empresa
from marketplace.serializers import (
    FinalizeAdSerializer,
    MarketplaceAdInputSerializer,
    MarketplaceAdSerializer,
    MarketplaceAdUpdateSerializer,
    SellerAdSerializer,
)
from produtos.serializers import InventoryItemSerializer, InventoryMovementSerializer, ReservationSerializer
from marketplace.services import create_ad, finalize_ad_sale, list_active_ads, list_seller_ads, update_ad


class MarketplaceAdsAPIView(ZenWasteAPIView):
    def get(self, request):
        ads = list_active_ads(request.query_params)
        return Response({"items": MarketplaceAdSerializer(ads, many=True).data})

    def post(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        serializer = MarketplaceAdInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        anuncio = create_ad(empresa, serializer.validated_data)

        return Response({"item": MarketplaceAdSerializer(anuncio).data}, status=status.HTTP_201_CREATED)


class MarketplaceAdDetailAPIView(ZenWasteAPIView):
    def patch(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        try:
            anuncio = Anuncio.objects.select_related("produto", "produto__empresa").get(
                id_anuncio=pk,
                produto__empresa=empresa,
            )
        except Anuncio.DoesNotExist:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = MarketplaceAdUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        anuncio = update_ad(anuncio, serializer.validated_data)

        return Response({"item": MarketplaceAdSerializer(anuncio).data})

    def delete(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        updated = Anuncio.objects.filter(id_anuncio=pk, produto__empresa=empresa).update(status_anuncio="inativo")
        if not updated:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)


class SellerMarketplaceAdsAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        ads = list_seller_ads(empresa)
        return Response({"items": SellerAdSerializer(ads, many=True).data})


class MarketplaceAdFinalizeAPIView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = require_empresa(request)
        if error:
            return error

        try:
            anuncio = Anuncio.objects.select_related("produto", "produto__empresa").get(
                id_anuncio=pk,
                produto__empresa=empresa,
            )
        except Anuncio.DoesNotExist:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = FinalizeAdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = finalize_ad_sale(anuncio, serializer.validated_data)

        response = {
            "ad": SellerAdSerializer(result["ad"]).data,
            "item": InventoryItemSerializer(result["ad"].produto).data,
            "movement": InventoryMovementSerializer(result["movement"]).data,
        }

        if result["reservation"]:
            response["reservation"] = ReservationSerializer(result["reservation"]).data

        return Response(response)
