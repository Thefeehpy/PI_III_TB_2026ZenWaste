from rest_framework.response import Response

from assistente_ia.services import run_description_suggestion, run_price_suggestion
from authentication.services import ZenWasteAPIView, empresa_from_request
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
            return Response(run_price_suggestion(data, empresa_from_request(request)))

        waste_type = data.get("type", "")
        price = suggested_price_for_type(waste_type)

        return Response({
            "suggestedPrice": float(round(price, 2)),
            "insight": "Sugestao baseada em historico de mercado e anuncios ativos similares.",
            "source": "fallback",
            "aiAvailable": False,
        })

    def post(self, request):
        return Response(run_price_suggestion(request.data, empresa_from_request(request)))


class SuggestedDescriptionAPIView(ZenWasteAPIView):
    def get(self, request):
        return Response(run_description_suggestion(request.query_params, empresa_from_request(request)))

    def post(self, request):
        return Response(run_description_suggestion(request.data, empresa_from_request(request)))
