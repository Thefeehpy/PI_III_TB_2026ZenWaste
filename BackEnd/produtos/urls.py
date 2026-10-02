from django.urls import path

from produtos.views import (
    InventoryItemDetailAPIView,
    InventoryItemMovementAPIView,
    InventoryItemReservationsAPIView,
    InventoryItemsAPIView,
    InventoryMovementsAPIView,
    InventoryReservationDetailAPIView,
    InventoryReservationsAPIView,
)


urlpatterns = [
    path("items/", InventoryItemsAPIView.as_view(), name="api-inventory-items"),
    path("items/<int:pk>/", InventoryItemDetailAPIView.as_view(), name="api-inventory-item-detail"),
    path("items/<int:pk>/movements/", InventoryItemMovementAPIView.as_view(), name="api-inventory-item-movements"),
    path("items/<int:pk>/reservations/", InventoryItemReservationsAPIView.as_view(), name="api-inventory-item-reservations"),
    path("movements/", InventoryMovementsAPIView.as_view(), name="api-inventory-movements"),
    path("reservations/", InventoryReservationsAPIView.as_view(), name="api-inventory-reservations"),
    path("reservations/<int:pk>/", InventoryReservationDetailAPIView.as_view(), name="api-inventory-reservation-detail"),
]
