from rest_framework.response import Response
from rest_framework.views import APIView

from market.pricing import PRICE_HISTORY, market_insight, material_metrics, suggest_price


class MarketIndexView(APIView):
    def get(self, request):
        return Response(
            {
                "name": "ZenWaste Market API",
                "endpoints": [
                    {"method": "GET", "path": "/api/market/prices/", "description": "Historico e metricas da bolsa de residuos."},
                    {"method": "GET", "path": "/api/market/suggest-price/?type=Plastico%20Industrial", "description": "Sugestao de preco por tipo."},
                ],
            }
        )


class MarketPricesView(APIView):
    def get(self, request):
        return Response(
            {
                "priceHistory": PRICE_HISTORY,
                "materials": material_metrics(),
                "insight": market_insight(),
            }
        )


class SuggestedPriceView(APIView):
    def get(self, request):
        waste_type = request.GET.get("type", "")
        return Response(
            {
                "type": waste_type,
                "suggestedPrice": suggest_price(waste_type),
                "insight": market_insight(),
            }
        )
