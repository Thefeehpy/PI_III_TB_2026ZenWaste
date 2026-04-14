from django.urls import path

from apps.common.views import endpoint_index

from . import views


urlpatterns = [
    path(
        "",
        endpoint_index(
            "ZenWaste Marketplace API",
            [
                {"method": "GET", "path": "/api/marketplace/ads/", "description": "Lista anuncios publicos."},
                {"method": "POST", "path": "/api/marketplace/ads/", "description": "Publica anuncio autenticado."},
                {"method": "GET", "path": "/api/marketplace/ads/<id>/", "description": "Detalha anuncio."},
                {"method": "GET", "path": "/api/marketplace/ads/<id>/whatsapp/", "description": "Gera link do WhatsApp."},
            ],
        ),
        name="marketplace-index",
    ),
    path("ads/", views.ads, name="marketplace-ads"),
    path("ads/<int:ad_id>/", views.ad_detail, name="marketplace-ad-detail"),
    path("ads/<int:ad_id>/whatsapp/", views.ad_whatsapp, name="marketplace-ad-whatsapp"),
]
