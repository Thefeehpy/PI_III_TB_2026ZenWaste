from decimal import Decimal

from assistente_ia.engine import analyze_market, recommend_freight, suggest_ad_description, suggest_ad_price
from assistente_ia.models import AssistenteIA


def _json_safe(data):
    return {key: float(value) if isinstance(value, Decimal) else value for key, value in dict(data).items()}


def _record(empresa, data, result, **fields):
    if empresa is None:
        return None
    return AssistenteIA.objects.create(
        empresa=empresa,
        contexto=_json_safe(data),
        fonte=result.get("source", AssistenteIA.Fonte.FALLBACK),
        status_ia=(
            AssistenteIA.Status.CONCLUIDA
            if result.get("source") == AssistenteIA.Fonte.IA
            else AssistenteIA.Status.FALLBACK
        ),
        mensagem=result.get("message", "")[:500],
        **fields,
    )


def run_price_suggestion(data, empresa=None):
    result = suggest_ad_price(data)
    execution = _record(empresa, data, result, sugestao_preco=result["suggestedPrice"])
    if execution:
        result["assistantExecutionId"] = str(execution.pk)
    return result


def run_description_suggestion(data, empresa=None):
    result = suggest_ad_description(data)
    execution = _record(empresa, data, result, sugestao_descricao=result["description"])
    if execution:
        result["assistantExecutionId"] = str(execution.pk)
    return result


def run_freight_recommendation(data, empresa=None):
    result = recommend_freight(data)
    execution = _record(empresa, data, result, recomendacao_frete=result["recommendation"])
    if execution:
        result["assistantExecutionId"] = str(execution.pk)
    return result


def run_market_analysis(data, empresa=None):
    result = analyze_market(data)
    execution = _record(empresa, data, {"source": "fallback", "message": ""})
    if execution:
        result["assistantExecutionId"] = str(execution.pk)
    return result
