from rest_framework import generics, status as codigos_http
from rest_framework.exceptions import NotAuthenticated
from rest_framework.response import Response

from autenticacao.servicos import VisaoAPIZenWaste, obter_empresa_da_requisicao, exigir_empresa
from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto
from produtos.consultas import carregar_saldos
from produtos.serializers import (
    SerializadorEntradaItemEstoque,
    SerializadorItemEstoque,
    SerializadorAtualizacaoItemEstoque,
    SerializadorEntradaMovimentacaoEstoque,
    SerializadorMovimentacaoEstoque,
    SerializadorProduto,
    SerializadorEntradaReserva,
    SerializadorReserva,
    SerializadorAtualizacaoSituacaoReserva,
)
from produtos.servicos import (
    criar_item_estoque,
    criar_reserva_produto,
    desativar_item_estoque,
    registrar_movimentacao_estoque,
    atualizar_item_estoque,
    atualizar_reserva_produto,
)


class MixinProdutoDaEmpresa:
    authentication_classes = []
    permission_classes = []
    serializer_class = SerializadorProduto

    def obter_empresa(self):
        empresa = obter_empresa_da_requisicao(self.request)
        if empresa is None:
            raise NotAuthenticated("Autenticacao obrigatoria.")
        return empresa

    def get_queryset(self):
        return Produto.objects.filter(empresa=self.obter_empresa(), ativo=True).select_related("categoria", "unidade_medida")

    def perform_create(self, serializador):
        serializador.save(empresa=self.obter_empresa())

    def perform_update(self, serializador):
        serializador.save(empresa=self.obter_empresa())

    def perform_destroy(self, instancia):
        desativar_item_estoque(instancia)


class VisaoCriacaoListagemProduto(MixinProdutoDaEmpresa, generics.ListCreateAPIView):
    pass


class VisaoDetalheAtualizacaoDesativacaoProduto(MixinProdutoDaEmpresa, generics.RetrieveUpdateDestroyAPIView):
    pass


class VisaoCriacaoProduto(MixinProdutoDaEmpresa, generics.CreateAPIView):
    pass


class VisaoAtualizacaoProduto(MixinProdutoDaEmpresa, generics.UpdateAPIView):
    pass


class VisaoDesativacaoProduto(MixinProdutoDaEmpresa, generics.DestroyAPIView):
    pass


class VisaoDetalheProduto(MixinProdutoDaEmpresa, generics.RetrieveAPIView):
    pass


class VisaoAPIItensEstoque(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        itens = carregar_saldos(
            Produto.objects.filter(empresa=empresa, ativo=True)
            .select_related("categoria", "unidade_medida").order_by("-atualizado_em")
        )
        return Response({"items": SerializadorItemEstoque(itens, many=True).data})

    def post(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        serializador = SerializadorEntradaItemEstoque(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        produto = criar_item_estoque(empresa, serializador.validated_data)

        return Response({"item": SerializadorItemEstoque(produto).data}, status=codigos_http.HTTP_201_CREATED)


class VisaoAPIDetalheItemEstoque(VisaoAPIZenWaste):
    def patch(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            produto = Produto.objects.select_related("categoria", "unidade_medida").get(id_produto=pk, empresa=empresa, ativo=True)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=codigos_http.HTTP_404_NOT_FOUND)

        serializador = SerializadorAtualizacaoItemEstoque(data=requisicao.data, partial=True)
        serializador.is_valid(raise_exception=True)
        produto = atualizar_item_estoque(produto, serializador.validated_data)

        return Response({"item": SerializadorItemEstoque(produto).data})

    def delete(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            produto = Produto.objects.select_related("categoria", "unidade_medida").get(id_produto=pk, empresa=empresa, ativo=True)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=codigos_http.HTTP_404_NOT_FOUND)

        anuncios_inativados = desativar_item_estoque(produto)
        return Response({"message": "Item desativado com sucesso.", "closedAds": anuncios_inativados})


class VisaoAPIMovimentacoesEstoque(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        movimentacoes = MovimentacaoEstoque.objects.filter(produto__empresa=empresa).select_related("produto", "produto__categoria", "produto__unidade_medida")
        return Response({"movements": SerializadorMovimentacaoEstoque(movimentacoes, many=True).data})


class VisaoAPIMovimentacaoItemEstoque(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            produto = Produto.objects.select_related("categoria", "unidade_medida").get(id_produto=pk, empresa=empresa, ativo=True)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=codigos_http.HTTP_404_NOT_FOUND)

        serializador = SerializadorEntradaMovimentacaoEstoque(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        movimento = registrar_movimentacao_estoque(produto, empresa, serializador.validated_data)

        return Response({
            "item": SerializadorItemEstoque(produto).data,
            "movement": SerializadorMovimentacaoEstoque(movimento).data,
        })


class VisaoAPIReservasEstoque(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        reservas = Reserva.objects.filter(produto__empresa=empresa).select_related("produto", "produto__categoria", "produto__unidade_medida")
        return Response({"items": SerializadorReserva(reservas, many=True).data})


class VisaoAPIReservasItemEstoque(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            produto = Produto.objects.select_related("categoria", "unidade_medida").get(id_produto=pk, empresa=empresa, ativo=True)
        except Produto.DoesNotExist:
            return Response({"message": "Item de estoque nao encontrado."}, status=codigos_http.HTTP_404_NOT_FOUND)

        serializador = SerializadorEntradaReserva(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        reserva = criar_reserva_produto(produto, serializador.validated_data)

        return Response({"reservation": SerializadorReserva(reserva).data}, status=codigos_http.HTTP_201_CREATED)


class VisaoAPIDetalheReservaEstoque(VisaoAPIZenWaste):
    def patch(self, requisicao, pk):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        try:
            reserva = Reserva.objects.select_related("produto").get(id_reserva=pk, produto__empresa=empresa)
        except Reserva.DoesNotExist:
            return Response({"message": "Reserva nao encontrada."}, status=codigos_http.HTTP_404_NOT_FOUND)

        serializador = SerializadorAtualizacaoSituacaoReserva(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        reserva = atualizar_reserva_produto(reserva, serializador.validated_data["status"])

        return Response({"reservation": SerializadorReserva(reserva).data})
