from decimal import Decimal

from django.db import DatabaseError, connection
from django.db.models import Avg

from anuncios.models import Anuncio
from autenticacao.servicos import normalizar_texto


HISTORICO_PRECOS = [
    {"month": "Nov", "plastico": 2.5, "metal": 7.8, "papel": 0.4, "vidro": 0.28, "borracha": 1.1},
    {"month": "Dez", "plastico": 2.6, "metal": 8.0, "papel": 0.42, "vidro": 0.29, "borracha": 1.15},
    {"month": "Jan", "plastico": 2.7, "metal": 8.2, "papel": 0.43, "vidro": 0.3, "borracha": 1.18},
    {"month": "Fev", "plastico": 2.65, "metal": 8.5, "papel": 0.44, "vidro": 0.3, "borracha": 1.2},
    {"month": "Mar", "plastico": 2.75, "metal": 8.4, "papel": 0.45, "vidro": 0.31, "borracha": 1.22},
    {"month": "Abr", "plastico": 2.8, "metal": 8.5, "papel": 0.45, "vidro": 0.3, "borracha": 1.2},
]

MATERIAIS = {
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


def metricas_materiais():
    primeiro = HISTORICO_PRECOS[0]
    ultimo = HISTORICO_PRECOS[-1]
    metricas = []

    for chave, configuracao in MATERIAIS.items():
        inicial = Decimal(str(primeiro[chave]))
        atual = Decimal(str(ultimo[chave]))
        variacao = Decimal("0") if inicial == 0 else ((atual - inicial) / inicial) * 100
        metricas.append({
            "key": chave,
            "name": configuracao["name"],
            "color": configuracao["color"],
            "current": float(atual),
            "change": float(round(variacao, 1)),
        })

    return metricas


def obter_analise_mercado():
    metricas = metricas_materiais()
    maior_variacao = sorted(metricas, key=lambda item: abs(item["change"]), reverse=True)[0]

    if maior_variacao["change"] > 0:
        return f"O preco de {maior_variacao['name']} subiu {maior_variacao['change']}% no periodo analisado. Ha oportunidade de publicar ofertas com melhor margem."
    if maior_variacao["change"] < 0:
        return f"O preco de {maior_variacao['name']} caiu {abs(maior_variacao['change'])}% no periodo analisado. Vale priorizar giro de estoque."

    return "Os precos ficaram estaveis no periodo analisado. Competir por qualidade e confiabilidade tende a gerar melhores negociacoes."


def preco_sugerido_categoria(categoria_residuo):
    categoria_normalizada = normalizar_texto(categoria_residuo)
    chave_encontrada = None

    for chave, configuracao in MATERIAIS.items():
        if any(alias in categoria_normalizada for alias in configuracao["aliases"]):
            chave_encontrada = chave
            break

    preco_medio = None

    try:
        if Anuncio._meta.db_table in connection.introspection.table_names():
            preco_medio = Anuncio.objects.filter(
                produto__categoria__nome_material__icontains=categoria_residuo,
                situacao_anuncio="ativo",
            ).aggregate(media=Avg("preco_final"))["media"]
    except DatabaseError:
        preco_medio = None

    if preco_medio:
        return Decimal(preco_medio)
    if chave_encontrada:
        return Decimal(str(HISTORICO_PRECOS[-1][chave_encontrada]))

    return Decimal("1.00")
