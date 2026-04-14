import unicodedata


PRICE_HISTORY = [
    {"month": "Nov", "plastico": 2.50, "metal": 7.80, "papel": 0.40, "vidro": 0.28, "borracha": 1.10},
    {"month": "Dez", "plastico": 2.60, "metal": 8.00, "papel": 0.42, "vidro": 0.29, "borracha": 1.15},
    {"month": "Jan", "plastico": 2.70, "metal": 8.20, "papel": 0.43, "vidro": 0.30, "borracha": 1.18},
    {"month": "Fev", "plastico": 2.65, "metal": 8.50, "papel": 0.44, "vidro": 0.30, "borracha": 1.20},
    {"month": "Mar", "plastico": 2.75, "metal": 8.40, "papel": 0.45, "vidro": 0.31, "borracha": 1.22},
    {"month": "Abr", "plastico": 2.80, "metal": 8.50, "papel": 0.45, "vidro": 0.30, "borracha": 1.20},
]

MATERIALS = {
    "plastico": {"name": "Plastico Industrial", "color": "hsl(152, 55%, 35%)", "aliases": ["plast", "stico"]},
    "metal": {"name": "Sucata Metalica", "color": "hsl(213, 50%, 35%)", "aliases": ["metal", "aco", "sucata"]},
    "papel": {"name": "Papel e Papelao", "color": "hsl(38, 92%, 50%)", "aliases": ["papel", "papelao"]},
    "vidro": {"name": "Vidro Industrial", "color": "hsl(0, 72%, 51%)", "aliases": ["vidro"]},
    "borracha": {"name": "Borracha", "color": "hsl(270, 50%, 50%)", "aliases": ["borracha"]},
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


def resolve_material_key(waste_type: str) -> str | None:
    normalized = normalize_text(waste_type)
    for key, material in MATERIALS.items():
        if any(alias in normalized for alias in material["aliases"]):
            return key
    return None


def suggest_price(waste_type: str) -> float:
    key = resolve_material_key(waste_type)
    if not key:
        return 1.0
    return float(PRICE_HISTORY[-1][key])


def material_metrics() -> list[dict]:
    first = PRICE_HISTORY[0]
    last = PRICE_HISTORY[-1]
    metrics = []

    for key, material in MATERIALS.items():
        initial_price = float(first[key])
        current_price = float(last[key])
        change = 0.0 if initial_price == 0 else round(((current_price - initial_price) / initial_price) * 100, 1)
        metrics.append(
            {
                "key": key,
                "name": material["name"],
                "color": material["color"],
                "current": current_price,
                "change": change,
            }
        )

    return metrics


def market_insight() -> str:
    metrics = sorted(material_metrics(), key=lambda item: abs(item["change"]), reverse=True)
    if not metrics:
        return "Sem dados suficientes para gerar insights de mercado."

    top = metrics[0]
    if top["change"] > 0:
        return (
            f"O preco de {top['name']} subiu {top['change']}% no periodo analisado. "
            "Ha um bom momento para publicar ofertas deste material com foco em margem."
        )
    if top["change"] < 0:
        return (
            f"O preco de {top['name']} caiu {abs(top['change'])}% no periodo analisado. "
            "Vale priorizar giro de estoque e negociacoes mais rapidas."
        )
    return (
        f"O preco de {top['name']} ficou estavel no periodo analisado. "
        "A recomendacao e competir por qualidade do material e confiabilidade de entrega."
    )
