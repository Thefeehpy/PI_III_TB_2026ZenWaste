from rest_framework.response import Response

from authentication.services import ZenWasteAPIView
from market.pricing import PRICE_HISTORY, get_market_insight, material_metrics, suggested_price_for_type


class MarketPricesAPIView(ZenWasteAPIView):
    def get(self, request):
        return Response({
            "priceHistory": PRICE_HISTORY,
            "materials": material_metrics(),
            "insight": get_market_insight(),
        })


class SuggestedPriceAPIView(ZenWasteAPIView):
    def get(self, request):
        waste_type = request.query_params.get("type", "")
        price = suggested_price_for_type(waste_type)

        return Response({
            "suggestedPrice": float(round(price, 2)),
            "insight": "Sugestao baseada em historico de mercado e anuncios ativos similares.",
        })
