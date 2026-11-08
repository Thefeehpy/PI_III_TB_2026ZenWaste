from django.urls import path

from comercializacao.views import (
    VisaoDetalheAnuncioComercial,
    VisaoFinalizacaoAnuncio,
    VisaoAnunciosComerciais,
    VisaoAnunciosVendedor,
)


urlpatterns = [
    path("ads/", VisaoAnunciosComerciais.as_view(), name="api-marketplace-ads"),
    path("ads/mine/", VisaoAnunciosVendedor.as_view(), name="api-marketplace-seller-ads"),
    path("ads/<int:pk>/", VisaoDetalheAnuncioComercial.as_view(), name="api-marketplace-ad-detail"),
    path("ads/<int:pk>/finalize/", VisaoFinalizacaoAnuncio.as_view(), name="api-marketplace-ad-finalize"),
]
