from django.urls import path

from apps.common.views import endpoint_index

from . import views


urlpatterns = [
    path(
        "",
        endpoint_index(
            "ZenWaste Market API",
            [
                {"method": "GET", "path": "/api/market/prices/", "description": "Historico e metricas da bolsa de residuos."},
                {"method": "GET", "path": "/api/market/suggest-price/?type=Plastico%20Industrial", "description": "Sugestao de preco por tipo."},
            ],
        ),
        name="market-index",
    ),
    path("prices/", views.prices, name="market-prices"),
    path("suggest-price/", views.suggest, name="market-suggest-price"),
]
