from django.urls import path

from apps.common.views import endpoint_index

from . import views


urlpatterns = [
    path(
        "",
        endpoint_index(
            "ZenWaste Inventory API",
            [
                {"method": "GET", "path": "/api/inventory/items/", "description": "Lista itens privados de estoque."},
                {"method": "POST", "path": "/api/inventory/items/", "description": "Cria item de estoque."},
                {"method": "GET", "path": "/api/inventory/movements/", "description": "Lista movimentacoes privadas."},
                {"method": "POST", "path": "/api/inventory/items/<id>/movements/", "description": "Registra entrada ou saida."},
            ],
        ),
        name="inventory-index",
    ),
    path("items/", views.items, name="inventory-items"),
    path("items/<int:item_id>/", views.item_detail, name="inventory-item-detail"),
    path("items/<int:item_id>/movements/", views.item_movements, name="inventory-item-movements"),
    path("movements/", views.movements, name="inventory-movements"),
]
