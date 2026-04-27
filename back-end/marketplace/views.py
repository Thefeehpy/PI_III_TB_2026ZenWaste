from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from marketplace.models import Anuncio
from marketplace.serializers import AnuncioSerializer, build_whatsapp_url


class MarketplaceIndexView(APIView):
    def get(self, request):
        return Response(
            {
                "name": "ZenWaste Marketplace API",
                "endpoints": [
                    {"method": "GET", "path": "/api/marketplace/ads/", "description": "Lista anuncios publicos."},
                    {"method": "POST", "path": "/api/marketplace/ads/", "description": "Publica anuncio autenticado."},
                    {"method": "GET", "path": "/api/marketplace/ads/<id>/", "description": "Detalha anuncio."},
                    {"method": "GET", "path": "/api/marketplace/ads/<id>/whatsapp/", "description": "Gera link do WhatsApp."},
                ],
            }
        )


class MarketplaceAdListCreateView(generics.ListCreateAPIView):
    serializer_class = AnuncioSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return []

    def get_queryset(self):
        queryset = (
            Anuncio.objects.select_related(
                "produto",
                "produto__empresa",
                "produto__categoria_residuo",
                "produto__unidade",
            )
            .prefetch_related("produto__imagens")
            .filter(status_anuncio=Anuncio.STATUS_ATIVO)
        )
        search = self.request.GET.get("search", "").strip()
        waste_type = self.request.GET.get("type", "").strip()
        location = self.request.GET.get("location", "").strip()
        min_price = self.request.GET.get("minPrice", "").strip()
        max_price = self.request.GET.get("maxPrice", "").strip()

        if search:
            queryset = queryset.filter(
                Q(produto__nome_residuo__icontains=search)
                | Q(produto__categoria_residuo__nome_material__icontains=search)
            )
        if waste_type and waste_type != "all":
            queryset = queryset.filter(produto__categoria_residuo__nome_material=waste_type)
        if location and location != "all":
            queryset = queryset.filter(localizacao=location)
        if min_price:
            queryset = queryset.filter(preco_final__gte=min_price)
        if max_price:
            queryset = queryset.filter(preco_final__lte=max_price)
        return queryset

    def list(self, request, *args, **kwargs):
        return Response({"items": self.get_serializer(self.get_queryset(), many=True).data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ad = serializer.save()
        return Response({"item": self.get_serializer(ad).data}, status=status.HTTP_201_CREATED)


class MarketplaceAdDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AnuncioSerializer

    def get_queryset(self):
        return (
            Anuncio.objects.select_related(
                "produto",
                "produto__empresa",
                "produto__categoria_residuo",
                "produto__unidade",
            )
            .prefetch_related("produto__imagens")
            .filter(status_anuncio=Anuncio.STATUS_ATIVO)
        )

    def get_permissions(self):
        if self.request.method in ["PATCH", "PUT", "DELETE"]:
            return [IsAuthenticated()]
        return []

    def retrieve(self, request, *args, **kwargs):
        return Response({"item": self.get_serializer(self.get_object()).data})

    def update(self, request, *args, **kwargs):
        ad = self.get_object()
        if ad.produto.empresa_id != request.user.empresa.pk:
            return Response({"message": "Voce so pode editar anuncios da sua propria empresa."}, status=403)
        response = super().update(request, *args, **kwargs)
        return Response({"item": response.data})

    def destroy(self, request, *args, **kwargs):
        ad = self.get_object()
        if ad.produto.empresa_id != request.user.empresa.pk:
            return Response({"message": "Voce so pode editar anuncios da sua propria empresa."}, status=403)
        ad.status_anuncio = Anuncio.STATUS_INATIVO
        ad.save(update_fields=["status_anuncio"])
        return Response({"message": "Anuncio inativado."})


class MarketplaceAdWhatsappView(APIView):
    def get(self, request, pk):
        ad = generics.get_object_or_404(Anuncio.objects.select_related("produto", "produto__empresa"), pk=pk)
        return Response({"url": build_whatsapp_url(ad)})
