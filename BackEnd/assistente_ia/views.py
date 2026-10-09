from rest_framework import status
from rest_framework.response import Response

from authentication.services import ZenWasteAPIView, empresa_from_request, require_empresa
from assistente_ia.models import AssistenteIA
from assistente_ia.serializers import AdSuggestionInputSerializer, FreightRecommendationInputSerializer
from assistente_ia.services import (
    run_description_suggestion,
    run_freight_recommendation,
    run_market_analysis,
    run_price_suggestion,
)


class AssistantHistoryAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error
        history = AssistenteIA.objects.filter(empresa=empresa).values(
            "id_assistente_ia", "sugestao_preco", "sugestao_descricao", "recomendacao_frete",
            "status_ia", "fonte", "mensagem", "criado_em",
        )[:50]
        return Response({"items": list(history)})


class MarketAnalysisAPIView(ZenWasteAPIView):
    def post(self, request):
        return Response(run_market_analysis(request.data, empresa_from_request(request)))


class PriceSuggestionAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = AdSuggestionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(run_price_suggestion(serializer.validated_data, empresa_from_request(request)))


class DescriptionSuggestionAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = AdSuggestionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(run_description_suggestion(serializer.validated_data, empresa_from_request(request)))


class FreightRecommendationAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = FreightRecommendationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            run_freight_recommendation(serializer.validated_data, empresa_from_request(request)),
            status=status.HTTP_200_OK,
        )
