"""Adaptadores HTTP: autenticação explícita, contratos e paginação."""

from django.core.paginator import InvalidPage, Paginator
from django.db.models import Count, Q
from rest_framework.response import Response

from app.excecoes import ErroRegraNegocio
from autenticacao.servicos import VisaoAPIZenWaste, exigir_empresa
from empresas.models import Empresa, PapelEmpresa
from fretes.consultas import listar_fretes_empresa, listar_pedidos_disponiveis, obter_frete_empresa
from fretes.models import DemandaTransporte, Frete
from fretes.serializers import (
    SerializadorConsultaFretes, SerializadorDemandaTransporte, SerializadorDetalheFrete,
    SerializadorEmpresaFrete, SerializadorFrete, SerializadorPedidoDisponivel,
)
from fretes.servicos import criar_frete, executar_comando_frete


class ErroAutenticacaoFrete(ErroRegraNegocio):
    codigo_http = 401


class VisaoFretes(VisaoAPIZenWaste):
    def initial(self, requisicao, *argumentos, **opcoes):
        super().initial(requisicao, *argumentos, **opcoes)
        self.empresa, erro = exigir_empresa(requisicao)
        if erro is not None:
            raise ErroAutenticacaoFrete("Autenticação de empresa obrigatória.")

    def consulta(self):
        contrato = SerializadorConsultaFretes(data=self.request.query_params)
        contrato.is_valid(raise_exception=True)
        return contrato.validated_data

    def detalhe(self, frete):
        return SerializadorDetalheFrete(frete, context={"empresa": self.empresa}).data


def _filtrar(consulta, dados):
    if dados.get("situacao"):
        consulta = consulta.filter(situacao=dados["situacao"])
    if dados.get("transportadora_id"):
        consulta = consulta.filter(transportadora_id=dados["transportadora_id"])
    if dados.get("data_inicio"):
        consulta = consulta.filter(data_pedido__gte=dados["data_inicio"])
    if dados.get("data_fim"):
        consulta = consulta.filter(data_pedido__lte=dados["data_fim"])
    if dados.get("busca"):
        busca = dados["busca"]
        consulta = consulta.filter(
            Q(numero_pedido__icontains=busca) | Q(material__icontains=busca)
            | Q(empresa_compradora__razao_social__icontains=busca),
        )
    return consulta


def _pagina(consulta, dados, tipo, *, contexto=None):
    paginador = Paginator(consulta, dados["tamanho_pagina"])
    try:
        pagina = paginador.page(dados["pagina"])
    except InvalidPage as erro:
        raise ErroRegraNegocio({"pagina": "Página fora do intervalo disponível."}) from erro
    return {
        "resultados": tipo(pagina.object_list, many=True, context=contexto or {}).data,
        "paginacao": {
            "pagina": pagina.number, "tamanho_pagina": paginador.per_page,
            "total": paginador.count, "total_paginas": paginador.num_pages,
        },
    }


class VisaoListaFretes(VisaoFretes):
    def get(self, requisicao):
        permitidos = listar_fretes_empresa(self.empresa)
        dados = self.consulta()
        resposta = _pagina(_filtrar(permitidos, dados), dados, SerializadorFrete, contexto={"empresa": self.empresa})
        # Os indicadores abrangem os processos permitidos, independentemente da
        # página e dos filtros escolhidos. Nenhuma página é reconstruída em memória.
        resposta["indicadores"] = permitidos.aggregate(**{
            nome: Count("pk", filter=Q(situacao__in=situacoes), distinct=True)
            for nome, situacoes in {
                "aguardando_classificacao": [Frete.Situacao.AGUARDANDO_CLASSIFICACAO],
                "aguardando_cotacao": [Frete.Situacao.EM_COTACAO],
                "em_andamento": [Frete.Situacao.AGUARDANDO_CONFERENCIA, Frete.Situacao.AGUARDANDO_ENTREGA],
                "divergentes": [Frete.Situacao.COM_DIVERGENCIA],
                "concluidos": [Frete.Situacao.CONCLUIDO],
                "cancelados": [Frete.Situacao.CANCELADO],
            }.items()
        })
        return Response(resposta)

    def post(self, requisicao):
        frete = criar_frete(self.empresa, requisicao.data, requisicao.headers.get("Idempotency-Key"))
        return Response(self.detalhe(frete), status=201)


class VisaoDetalheFrete(VisaoFretes):
    def get(self, requisicao, pk):
        return Response(self.detalhe(obter_frete_empresa(self.empresa, pk)))


class VisaoComandoFrete(VisaoFretes):
    def post(self, requisicao, pk, acao):
        frete = executar_comando_frete(
            self.empresa, pk, acao, requisicao.data, requisicao.headers.get("Idempotency-Key"),
        )
        return Response(self.detalhe(frete))


class VisaoPedidosDisponiveis(VisaoFretes):
    def get(self, requisicao):
        dados = self.consulta()
        consulta = listar_pedidos_disponiveis(self.empresa)
        if dados.get("busca"):
            consulta = consulta.filter(Q(numero__icontains=dados["busca"]) | Q(nome_material_negociado__icontains=dados["busca"]))
        return Response(_pagina(consulta, dados, SerializadorPedidoDisponivel))


class VisaoDiretorioEmpresas(VisaoFretes):
    def get(self, requisicao, papel):
        dados = self.consulta()
        consulta = Empresa.objects.filter(ativo=True, papeis__codigo=papel).only("id_empresa", "razao_social").distinct().order_by("razao_social", "pk")
        if dados.get("busca"):
            consulta = consulta.filter(razao_social__icontains=dados["busca"])
        return Response(_pagina(consulta, dados, SerializadorEmpresaFrete))


class VisaoDemandasTransporte(VisaoFretes):
    def get(self, requisicao):
        dados = self.consulta()
        permitidos = _filtrar(listar_fretes_empresa(self.empresa), dados)
        consulta = DemandaTransporte.objects.filter(frete__in=permitidos.values("pk")).select_related("frete").annotate(
            total_propostas=Count("frete__cotacoes", distinct=True),
        ).order_by("-publicada_em", "-pk")
        return Response(_pagina(consulta, dados, SerializadorDemandaTransporte))
