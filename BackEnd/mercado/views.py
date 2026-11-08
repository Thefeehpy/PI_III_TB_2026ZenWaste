from rest_framework.response import Response

from autenticacao.servicos import VisaoAPIZenWaste
from mercado.inteligencia_artificial import sugerir_descricao_anuncio, sugerir_preco_anuncio
from mercado.precificacao import HISTORICO_PRECOS, obter_analise_mercado, metricas_materiais, preco_sugerido_categoria


class VisaoPrecosMercado(VisaoAPIZenWaste):
    def get(self, requisicao):
        return Response({
            "priceHistory": HISTORICO_PRECOS,
            "materials": metricas_materiais(),
            "insight": obter_analise_mercado(),
        })


class VisaoSugestaoPreco(VisaoAPIZenWaste):
    def get(self, requisicao):
        dados = requisicao.query_params

        if dados.get("name") or dados.get("quantity") or dados.get("location"):
            return Response(sugerir_preco_anuncio(dados))

        categoria_residuo = dados.get("type", "")
        preco = preco_sugerido_categoria(categoria_residuo)

        return Response({
            "suggestedPrice": float(round(preco, 2)),
            "insight": "Sugestao baseada em historico de mercado e anuncios ativos similares.",
            "source": "fallback",
            "aiAvailable": False,
        })

    def post(self, requisicao):
        return Response(sugerir_preco_anuncio(requisicao.data))


class VisaoSugestaoDescricao(VisaoAPIZenWaste):
    def get(self, requisicao):
        return Response(sugerir_descricao_anuncio(requisicao.query_params))

    def post(self, requisicao):
        return Response(sugerir_descricao_anuncio(requisicao.data))
