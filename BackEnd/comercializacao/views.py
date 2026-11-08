from rest_framework import status
from rest_framework.response import Response

from anuncios.models import Anuncio
from autenticacao.servicos import VisaoAPIZenWaste, exigir_empresa
from comercializacao.serializers import (
    SerializadorFinalizacaoAnuncio,
    SerializadorEntradaAnuncio,
    SerializadorAnuncioComercial,
    SerializadorAtualizacaoAnuncio,
    SerializadorAnuncioVendedor,
)
from produtos.serializers import SerializadorItemEstoque, SerializadorMovimentacaoEstoque, SerializadorReserva
from comercializacao.servicos import criar_anuncio, inativar_anuncio, finalizar_venda_anuncio, listar_anuncios_ativos, listar_anuncios_vendedor, atualizar_anuncio


class VisaoAnunciosComerciais(VisaoAPIZenWaste):
    def get(self, requisicao):
        anuncios = listar_anuncios_ativos(requisicao.query_params)
        return Response({"items": SerializadorAnuncioComercial(anuncios, many=True).data})

    def post(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        serializador = SerializadorEntradaAnuncio(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        anuncio = criar_anuncio(empresa, serializador.validated_data)

        return Response({"item": SerializadorAnuncioComercial(anuncio).data}, status=status.HTTP_201_CREATED)


class VisaoDetalheAnuncioComercial(VisaoAPIZenWaste):
    def patch(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            anuncio = Anuncio.objects.select_related("produto", "produto__empresa", "produto__categoria", "produto__unidade_medida").prefetch_related("imagens").get(
                id_anuncio=pk,
                produto__empresa=empresa,
            )
        except Anuncio.DoesNotExist:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializador = SerializadorAtualizacaoAnuncio(data=requisicao.data, partial=True)
        serializador.is_valid(raise_exception=True)
        anuncio = atualizar_anuncio(anuncio, serializador.validated_data)

        return Response({"item": SerializadorAnuncioComercial(anuncio).data})

    def delete(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            anuncio = Anuncio.objects.get(id_anuncio=pk, produto__empresa=empresa)
        except Anuncio.DoesNotExist:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)
        inativar_anuncio(anuncio)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VisaoAnunciosVendedor(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        anuncios = listar_anuncios_vendedor(empresa)
        return Response({"items": SerializadorAnuncioVendedor(anuncios, many=True).data})


class VisaoFinalizacaoAnuncio(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            anuncio = Anuncio.objects.select_related("produto", "produto__empresa", "produto__categoria", "produto__unidade_medida").prefetch_related("imagens").get(
                id_anuncio=pk,
                produto__empresa=empresa,
            )
        except Anuncio.DoesNotExist:
            return Response({"message": "Anuncio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializador = SerializadorFinalizacaoAnuncio(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        resultado = finalizar_venda_anuncio(anuncio, serializador.validated_data)

        resposta = {
            "ad": SerializadorAnuncioVendedor(resultado["ad"]).data,
            "item": SerializadorItemEstoque(resultado["ad"].produto).data,
            "movement": SerializadorMovimentacaoEstoque(resultado["movement"]).data,
        }

        if resultado["reservation"]:
            resposta["reservation"] = SerializadorReserva(resultado["reservation"]).data

        return Response(resposta)
