from django.http import HttpRequest

from apps.common.http import method_not_allowed, ok

from .pricing import PRICE_HISTORY, market_insight, material_metrics, suggest_price


def prices(request: HttpRequest):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    return ok(
        {
            "priceHistory": PRICE_HISTORY,
            "materials": material_metrics(),
            "insight": market_insight(),
        }
    )


def suggest(request: HttpRequest):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    waste_type = request.GET.get("type", "")
    return ok(
        {
            "type": waste_type,
            "suggestedPrice": suggest_price(waste_type),
            "insight": market_insight(),
        }
    )
