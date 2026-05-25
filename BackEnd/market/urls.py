from django.urls import path

from market.views import MarketPricesAPIView, SuggestedPriceAPIView


urlpatterns = [
    path("prices/", MarketPricesAPIView.as_view(), name="api-market-prices"),
    path("suggest-price/", SuggestedPriceAPIView.as_view(), name="api-market-suggest-price"),
]
