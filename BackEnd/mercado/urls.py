from django.urls import path

from mercado.views import VisaoPrecosMercado, VisaoSugestaoDescricao, VisaoSugestaoPreco


urlpatterns = [
    path("prices/", VisaoPrecosMercado.as_view(), name="api-market-prices"),
    path("suggest-price/", VisaoSugestaoPreco.as_view(), name="api-market-suggest-price"),
    path("suggest-description/", VisaoSugestaoDescricao.as_view(), name="api-market-suggest-description"),
]
