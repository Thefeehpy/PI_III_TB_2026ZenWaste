import re
from decimal import Decimal, InvalidOperation

from mercado.integracao_ia import IntegracaoIA, obter_integracao_ia
from mercado.precificacao import preco_sugerido_categoria


def montar_contexto_anuncio(dados):
    nome = str(dados.get("name") or "").strip()
    categoria_residuo = str(dados.get("type") or "").strip()
    quantidade = dados.get("quantity")
    unidade = str(dados.get("unit") or "kg").strip() or "kg"
    localizacao = str(dados.get("location") or "").strip()

    partes = [
        f"Nome: {nome}" if nome else "",
        f"Tipo: {categoria_residuo}" if categoria_residuo else "",
        f"Quantidade: {quantidade} {unidade}" if quantidade else f"Unidade: {unidade}",
        f"Localizacao: {localizacao}" if localizacao else "",
    ]
    return "; ".join(parte for parte in partes if parte)


def interpretar_preco(valor):
    if not valor:
        return None

    correspondencia = re.search(r"(\d+(?:[.,]\d{1,4})?)", str(valor))
    if not correspondencia:
        return None

    try:
        return Decimal(correspondencia.group(1).replace(",", "."))
    except InvalidOperation:
        return None


def descricao_alternativa(dados):
    nome = str(dados.get("name") or "Material industrial").strip()
    categoria_residuo = str(dados.get("type") or "residuo industrial").strip()
    quantidade = dados.get("quantity")
    unidade = str(dados.get("unit") or "kg").strip() or "kg"

    texto_quantidade = f" em lote de {quantidade} {unidade}" if quantidade else ""
    return (
        f"{nome}, classificado como {categoria_residuo}{texto_quantidade}. "
        "Material disponivel para negociacao no marketplace ZenWaste."
    )[:300]


def sugerir_descricao_anuncio(dados, *, integracao: IntegracaoIA | None = None):
    integracao = integracao if integracao is not None else obter_integracao_ia()
    contexto = montar_contexto_anuncio(dados)
    descricao = integracao.descricao(contexto) if contexto else None
    situacao_ia = integracao.situacao()

    return {
        "description": (descricao or descricao_alternativa(dados))[:300],
        "source": "ai" if descricao else "fallback",
        "aiAvailable": situacao_ia["available"],
        "message": "" if descricao else situacao_ia["message"],
    }


def sugerir_preco_anuncio(dados, *, integracao: IntegracaoIA | None = None):
    integracao = integracao if integracao is not None else obter_integracao_ia()
    contexto = montar_contexto_anuncio(dados)
    texto_ia = integracao.preco(contexto) if contexto else None
    preco_ia = interpretar_preco(texto_ia)
    preco_alternativo = preco_sugerido_categoria(dados.get("type", ""))
    preco_ia_valido = preco_ia is not None and preco_ia > 0
    preco = preco_ia if preco_ia_valido else preco_alternativo
    situacao_ia = integracao.situacao()

    return {
        "suggestedPrice": float(round(preco, 2)),
        "insight": (
            "Sugestao gerada por IA com base no contexto do anuncio."
            if preco_ia_valido
            else "Sugestao baseada em historico de mercado e anuncios ativos similares."
        ),
        "source": "ai" if preco_ia_valido else "fallback",
        "aiAvailable": situacao_ia["available"],
        "message": "" if preco_ia_valido else situacao_ia["message"],
    }
