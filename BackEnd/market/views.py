from rest_framework.response import Response

from authentication.services import ZenWasteAPIView
from market.ai import suggest_ad_description, suggest_ad_price
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
        data = request.query_params

        if data.get("name") or data.get("quantity") or data.get("location"):
            return Response(suggest_ad_price(data))

        waste_type = data.get("type", "")
        price = suggested_price_for_type(waste_type)

        return Response({
            "suggestedPrice": float(round(price, 2)),
            "insight": "Sugestao baseada em historico de mercado e anuncios ativos similares.",
            "source": "fallback",
            "aiAvailable": False,
        })

    def post(self, request):
        return Response(suggest_ad_price(request.data))


class SuggestedDescriptionAPIView(ZenWasteAPIView):
    def get(self, request):
        return Response(suggest_ad_description(request.query_params))

    def post(self, request):
        return Response(suggest_ad_description(request.data))
