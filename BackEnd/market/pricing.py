from decimal import Decimal

from django.db import DatabaseError, connection
from django.db.models import Avg

from anuncios.models import Anuncio
from authentication.services import normalize_text


PRICE_HISTORY = [
    {"month": "Nov", "plastico": 2.5, "metal": 7.8, "papel": 0.4, "vidro": 0.28, "borracha": 1.1},
    {"month": "Dez", "plastico": 2.6, "metal": 8.0, "papel": 0.42, "vidro": 0.29, "borracha": 1.15},
    {"month": "Jan", "plastico": 2.7, "metal": 8.2, "papel": 0.43, "vidro": 0.3, "borracha": 1.18},
    {"month": "Fev", "plastico": 2.65, "metal": 8.5, "papel": 0.44, "vidro": 0.3, "borracha": 1.2},
    {"month": "Mar", "plastico": 2.75, "metal": 8.4, "papel": 0.45, "vidro": 0.31, "borracha": 1.22},
    {"month": "Abr", "plastico": 2.8, "metal": 8.5, "papel": 0.45, "vidro": 0.3, "borracha": 1.2},
]

MATERIALS = {
    "plastico": {
        "name": "Plastico Industrial",
        "aliases": ("plastico", "plastic", "pead", "pet"),
        "color": "hsl(152, 55%, 35%)",
    },
    "metal": {
        "name": "Sucata Metalica",
        "aliases": ("metal", "metalica", "aco", "aluminio", "sucata"),
        "color": "hsl(213, 50%, 35%)",
    },
    "papel": {
        "name": "Papel e Papelao",
        "aliases": ("papel", "papelao", "papel e papelao"),
        "color": "hsl(38, 92%, 50%)",
    },
    "vidro": {
        "name": "Vidro Industrial",
        "aliases": ("vidro", "vidro industrial"),
        "color": "hsl(0, 72%, 51%)",
    },
    "borracha": {
        "name": "Borracha",
        "aliases": ("borracha", "sbr"),
        "color": "hsl(270, 50%, 50%)",
    },
}


def material_metrics():
    first = PRICE_HISTORY[0]
    last = PRICE_HISTORY[-1]
    metrics = []

    for key, config in MATERIALS.items():
        initial = Decimal(str(first[key]))
        current = Decimal(str(last[key]))
        change = Decimal("0") if initial == 0 else ((current - initial) / initial) * 100
        metrics.append({
            "key": key,
            "name": config["name"],
            "color": config["color"],
            "current": float(current),
            "change": float(round(change, 1)),
        })

    return metrics


def get_market_insight():
    metrics = material_metrics()
    top = sorted(metrics, key=lambda item: abs(item["change"]), reverse=True)[0]

    if top["change"] > 0:
        return f"O preco de {top['name']} subiu {top['change']}% no periodo analisado. Ha oportunidade de publicar ofertas com melhor margem."
    if top["change"] < 0:
        return f"O preco de {top['name']} caiu {abs(top['change'])}% no periodo analisado. Vale priorizar giro de estoque."

    return "Os precos ficaram estaveis no periodo analisado. Competir por qualidade e confiabilidade tende a gerar melhores negociacoes."


def suggested_price_for_type(waste_type):
    normalized_type = normalize_text(waste_type)
    matched_key = None

    for key, config in MATERIALS.items():
        if any(alias in normalized_type for alias in config["aliases"]):
            matched_key = key
            break

    avg_price = None

    try:
        if Anuncio._meta.db_table in connection.introspection.table_names():
            avg_price = Anuncio.objects.filter(
                produto__tipo_produto__icontains=waste_type,
                status_anuncio="ativo",
            ).aggregate(media=Avg("preco_final"))["media"]
    except DatabaseError:
        avg_price = None

    if avg_price:
        return Decimal(avg_price)
    if matched_key:
        return Decimal(str(PRICE_HISTORY[-1][matched_key]))

    return Decimal("1.00")
