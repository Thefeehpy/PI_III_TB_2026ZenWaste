import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from assistente_ia.providers import IAServiceManager
from market.pricing import get_market_insight, material_metrics, suggested_price_for_type


def _decimal(value, default="0"):
    try:
        return Decimal(str(value if value not in (None, "") else default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def build_ad_context(data):
    name = str(data.get("name") or "").strip()
    waste_type = str(data.get("type") or "").strip()
    quantity = data.get("quantity")
    unit = str(data.get("unit") or "kg").strip() or "kg"
    location = str(data.get("location") or "").strip()
    parts = [
        f"Nome: {name}" if name else "",
        f"Tipo: {waste_type}" if waste_type else "",
        f"Quantidade: {quantity} {unit}" if quantity else f"Unidade: {unit}",
        f"Localização: {location}" if location else "",
    ]
    return "; ".join(part for part in parts if part)


def parse_price(value):
    if not value:
        return None
    match = re.search(r"(\d+(?:[.,]\d{1,4})?)", str(value))
    if not match:
        return None
    try:
        return Decimal(match.group(1).replace(",", "."))
    except InvalidOperation:
        return None


def fallback_description(data):
    name = str(data.get("name") or "Material industrial").strip()
    waste_type = str(data.get("type") or "resíduo industrial").strip()
    quantity = data.get("quantity")
    unit = str(data.get("unit") or "kg").strip() or "kg"
    quantity_text = f" em lote de {quantity} {unit}" if quantity else ""
    return (
        f"{name}, classificado como {waste_type}{quantity_text}. "
        "Material disponível para negociação no marketplace ZenWaste."
    )[:300]


def suggest_ad_description(data, ai_manager=None):
    manager = ai_manager or IAServiceManager()
    context = build_ad_context(data)
    description = manager.get_anounce_ai_description(context) if context else None
    ai_status = manager.get_ai_status()
    return {
        "description": (description or fallback_description(data))[:300],
        "source": "ai" if description else "fallback",
        "aiAvailable": ai_status["available"],
        "message": "" if description else ai_status["message"],
    }


def suggest_ad_price(data, ai_manager=None, price_resolver=suggested_price_for_type):
    manager = ai_manager or IAServiceManager()
    context = build_ad_context(data)
    ai_text = manager.get_anounce_price_ai_description(context) if context else None
    ai_price = parse_price(ai_text)
    fallback_price = price_resolver(data.get("type", ""))
    price = ai_price if ai_price and ai_price > 0 else fallback_price
    ai_status = manager.get_ai_status()
    return {
        "suggestedPrice": float(round(price, 2)),
        "insight": (
            "Sugestão gerada por IA com base no contexto do anúncio."
            if ai_price
            else "Sugestão baseada em histórico de mercado e anúncios ativos similares."
        ),
        "source": "ai" if ai_price else "fallback",
        "aiAvailable": ai_status["available"],
        "message": "" if ai_price else ai_status["message"],
    }


def analyze_market(data=None):
    data = data or {}
    material_type = str(data.get("type") or "").strip().lower()
    materials = material_metrics()
    matching = next((item for item in materials if material_type and material_type in item["name"].lower()), None)
    return {"materials": materials, "selectedMaterial": matching, "insight": get_market_insight()}


def _vehicle_for(weight_ton, cubic_meters):
    if weight_ton > 12 or cubic_meters > 55:
        return "Carreta"
    if weight_ton > 6 or cubic_meters > 30:
        return "Truck"
    if weight_ton > 3 or cubic_meters > 16:
        return "Baú médio"
    return "VUC"


def recommend_freight(data, ai_manager=None):
    material = str(data.get("material") or data.get("type") or "outros").lower()
    distance = max(_decimal(data.get("distanceKm")), Decimal("0"))
    weight = max(_decimal(data.get("weightTon")), _decimal(data.get("quantity")) / Decimal("1000"))
    cubic = max(_decimal(data.get("cubicMeters")), Decimal("0"))
    cost_by_material = {
        "papel": Decimal("4.80"),
        "papelão": Decimal("4.80"),
        "plastico": Decimal("5.20"),
        "plástico": Decimal("5.20"),
        "metal": Decimal("6.40"),
        "vidro": Decimal("7.10"),
    }
    cost_per_km = next((value for key, value in cost_by_material.items() if key in material), Decimal("5.50"))
    suggested_value = max(Decimal("150"), distance * cost_per_km + weight * Decimal("30"))
    suggested_value = suggested_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    vehicle = _vehicle_for(weight, cubic)
    context = (
        f"material={material}; distância={distance} km; peso={weight} t; "
        f"cubagem={cubic} m³; veículo calculado={vehicle}"
    )
    manager = ai_manager or IAServiceManager()
    ai_text = manager.get_freight_recommendation(context)
    ai_status = manager.get_ai_status()
    fallback = f"Recomenda-se {vehicle} para a carga informada. Confirme rota, capacidade e licenças antes da coleta."
    return {
        "suggestedValue": float(suggested_value),
        "vehicleType": vehicle,
        "recommendation": (ai_text or fallback)[:500],
        "costPerKm": float(cost_per_km),
        "source": "ai" if ai_text else "fallback",
        "aiAvailable": ai_status["available"],
        "message": "" if ai_text else ai_status["message"],
    }
