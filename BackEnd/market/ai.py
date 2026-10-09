"""Compatibilidade das rotas antigas com o novo domínio ``assistente_ia``."""

from assistente_ia.engine import (
    build_ad_context,
    fallback_description,
    parse_price,
    suggest_ad_description as _suggest_ad_description,
    suggest_ad_price as _suggest_ad_price,
)
from assistente_ia.providers import IAServiceManager
from market.pricing import suggested_price_for_type


def suggest_ad_description(data):
    return _suggest_ad_description(data, ai_manager=IAServiceManager())


def suggest_ad_price(data):
    return _suggest_ad_price(
        data,
        ai_manager=IAServiceManager(),
        price_resolver=suggested_price_for_type,
    )


__all__ = [
    "build_ad_context",
    "fallback_description",
    "parse_price",
    "suggest_ad_description",
    "suggest_ad_price",
]
