from django.urls import path

from produtos.views import (
    VisaoAPIDetalheItemEstoque,
    VisaoAPIMovimentacaoItemEstoque,
    VisaoAPIReservasItemEstoque,
    VisaoAPIItensEstoque,
    VisaoAPIMovimentacoesEstoque,
    VisaoAPIDetalheReservaEstoque,
    VisaoAPIReservasEstoque,
)


urlpatterns = [
    path("items/", VisaoAPIItensEstoque.as_view(), name="api-inventory-items"),
    path("items/<int:pk>/", VisaoAPIDetalheItemEstoque.as_view(), name="api-inventory-item-detail"),
    path("items/<int:pk>/movements/", VisaoAPIMovimentacaoItemEstoque.as_view(), name="api-inventory-item-movements"),
    path("items/<int:pk>/reservations/", VisaoAPIReservasItemEstoque.as_view(), name="api-inventory-item-reservations"),
    path("movements/", VisaoAPIMovimentacoesEstoque.as_view(), name="api-inventory-movements"),
    path("reservations/", VisaoAPIReservasEstoque.as_view(), name="api-inventory-reservations"),
    path("reservations/<int:pk>/", VisaoAPIDetalheReservaEstoque.as_view(), name="api-inventory-reservation-detail"),
]
