from django.urls import path

from marketplace.views import (
    MarketplaceAdDetailAPIView,
    MarketplaceAdFinalizeAPIView,
    MarketplaceAdsAPIView,
    SellerMarketplaceAdsAPIView,
)


urlpatterns = [
    path("ads/", MarketplaceAdsAPIView.as_view(), name="api-marketplace-ads"),
    path("ads/mine/", SellerMarketplaceAdsAPIView.as_view(), name="api-marketplace-seller-ads"),
    path("ads/<int:pk>/", MarketplaceAdDetailAPIView.as_view(), name="api-marketplace-ad-detail"),
    path("ads/<int:pk>/finalize/", MarketplaceAdFinalizeAPIView.as_view(), name="api-marketplace-ad-finalize"),
]
