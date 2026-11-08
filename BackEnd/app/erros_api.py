"""Traduz os erros da aplicação na fronteira HTTP."""

from rest_framework.response import Response
from rest_framework.views import exception_handler as tratar_excecao_drf

from app.excecoes import ErroRegraNegocio


def tratar_excecao(erro, contexto):
    if isinstance(erro, ErroRegraNegocio):
        detalhes = erro.detalhes
        return Response(
            detalhes if isinstance(detalhes, (dict, list)) else {"message": detalhes},
            status=erro.codigo_http,
        )
    return tratar_excecao_drf(erro, contexto)
