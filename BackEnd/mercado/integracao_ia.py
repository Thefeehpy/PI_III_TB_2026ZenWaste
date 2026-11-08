"""Interface de IA especifica; adaptadores atendem ao contrato de sugestoes."""

from functools import lru_cache
from importlib import import_module
from typing import Protocol, TypedDict


class SituacaoIA(TypedDict):
    available: bool
    message: str


class IntegracaoIA(Protocol):
    def descricao(self, contexto: str) -> str | None: ...

    def preco(self, contexto: str) -> str | None: ...

    def situacao(self) -> SituacaoIA: ...


class AdaptadorGemini:
    """Carrega o cliente existente sob demanda sem alterar sua configuracao."""

    def descricao(self, contexto: str) -> str | None:
        cliente = import_module("gemini_api.cliente")
        return cliente.gerar_descricao_anuncio_ia(contexto)

    def preco(self, contexto: str) -> str | None:
        cliente = import_module("gemini_api.cliente")
        return cliente.gerar_preco_anuncio_ia(contexto)

    def situacao(self) -> SituacaoIA:
        cliente = import_module("gemini_api.cliente")
        return cliente.obter_situacao_ia()


@lru_cache(maxsize=1)
def obter_integracao_ia() -> IntegracaoIA:
    """Reutiliza o adaptador por processo; chamadores podem injetar outra integracao."""
    return AdaptadorGemini()
