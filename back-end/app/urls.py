from django.contrib import admin
from django.urls import path

from accounts.views import AuthIndexView, CompanyDetailView, CompanyListView, LoginView, LogoutView, MeView, RegisterView
from app.views import api_root
from inventory.views import (
    InventoryIndexView,
    InventoryItemDetailView,
    InventoryItemListCreateView,
    InventoryItemMovementListCreateView,
    InventoryMovementListView,
)
from market.views import MarketIndexView, MarketPricesView, SuggestedPriceView
from marketplace.views import (
    MarketplaceAdDetailView,
    MarketplaceAdListCreateView,
    MarketplaceAdWhatsappView,
    MarketplaceIndexView,
)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_root, name="api-root"),
    path("api/auth/", AuthIndexView.as_view(), name="auth-index"),
    path("api/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/companies/", CompanyListView.as_view(), name="company-list"),
    path("api/companies/<int:pk>/", CompanyDetailView.as_view(), name="company-detail"),
    path("api/inventory/", InventoryIndexView.as_view(), name="inventory-index"),
    path("api/inventory/items/", InventoryItemListCreateView.as_view(), name="inventory-items"),
    path("api/inventory/items/<int:pk>/", InventoryItemDetailView.as_view(), name="inventory-item-detail"),
    path(
        "api/inventory/items/<int:pk>/movements/",
        InventoryItemMovementListCreateView.as_view(),
        name="inventory-item-movements",
    ),
    path("api/inventory/movements/", InventoryMovementListView.as_view(), name="inventory-movements"),
    path("api/marketplace/", MarketplaceIndexView.as_view(), name="marketplace-index"),
    path("api/marketplace/ads/", MarketplaceAdListCreateView.as_view(), name="marketplace-ads"),
    path("api/marketplace/ads/<int:pk>/", MarketplaceAdDetailView.as_view(), name="marketplace-ad-detail"),
    path("api/marketplace/ads/<int:pk>/whatsapp/", MarketplaceAdWhatsappView.as_view(), name="marketplace-ad-whatsapp"),
    path("api/market/", MarketIndexView.as_view(), name="market-index"),
    path("api/market/prices/", MarketPricesView.as_view(), name="market-prices"),
    path("api/market/suggest-price/", SuggestedPriceView.as_view(), name="market-suggest-price"),
]
