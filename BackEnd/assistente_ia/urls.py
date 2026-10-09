from django.urls import path

from assistente_ia import views


urlpatterns = [
    path("history/", views.AssistantHistoryAPIView.as_view(), name="assistant-history"),
    path("analyze-market/", views.MarketAnalysisAPIView.as_view(), name="assistant-market-analysis"),
    path("suggest-price/", views.PriceSuggestionAPIView.as_view(), name="assistant-price"),
    path("suggest-description/", views.DescriptionSuggestionAPIView.as_view(), name="assistant-description"),
    path("recommend-freight/", views.FreightRecommendationAPIView.as_view(), name="assistant-freight"),
]
