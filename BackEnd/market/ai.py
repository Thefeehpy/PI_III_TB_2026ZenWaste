import re
from decimal import Decimal, InvalidOperation

from gemini_api.cliente import (
    get_ai_status,
    get_anounce_ai_description,
    get_anounce_price_ai_description,
)
from market.pricing import suggested_price_for_type


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
        f"Localizacao: {location}" if location else "",
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
    waste_type = str(data.get("type") or "residuo industrial").strip()
    quantity = data.get("quantity")
    unit = str(data.get("unit") or "kg").strip() or "kg"

    quantity_text = f" em lote de {quantity} {unit}" if quantity else ""
    return (
        f"{name}, classificado como {waste_type}{quantity_text}. "
        "Material disponivel para negociacao no marketplace ZenWaste."
    )[:300]


def suggest_ad_description(data):
    context = build_ad_context(data)
    description = get_anounce_ai_description(context) if context else None
    ai_status = get_ai_status()

    return {
        "description": (description or fallback_description(data))[:300],
        "source": "ai" if description else "fallback",
        "aiAvailable": ai_status["available"],
        "message": "" if description else ai_status["message"],
    }


def suggest_ad_price(data):
    context = build_ad_context(data)
    ai_text = get_anounce_price_ai_description(context) if context else None
    ai_price = parse_price(ai_text)
    fallback_price = suggested_price_for_type(data.get("type", ""))
    price = ai_price if ai_price and ai_price > 0 else fallback_price
    ai_status = get_ai_status()

    return {
        "suggestedPrice": float(round(price, 2)),
        "insight": (
            "Sugestao gerada por IA com base no contexto do anuncio."
            if ai_price
            else "Sugestao baseada em historico de mercado e anuncios ativos similares."
        ),
        "source": "ai" if ai_price else "fallback",
        "aiAvailable": ai_status["available"],
        "message": "" if ai_price else ai_status["message"],
    }
