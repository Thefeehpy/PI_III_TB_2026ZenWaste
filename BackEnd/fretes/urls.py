from django.urls import path

from empresas.models import PapelEmpresa
from fretes.servicos import COMANDOS
from fretes.views import (
    VisaoComandoFrete, VisaoDemandasTransporte, VisaoDetalheFrete,
    VisaoDiretorioEmpresas, VisaoListaFretes, VisaoPedidosDisponiveis,
)


urlpatterns = [
    path("", VisaoListaFretes.as_view(), name="fretes-lista"),
    path("pedidos-disponiveis/", VisaoPedidosDisponiveis.as_view(), name="fretes-pedidos"),
    path("compradoras/", VisaoDiretorioEmpresas.as_view(), {"papel": PapelEmpresa.Codigo.COMPRADORA}, name="fretes-compradoras"),
    path("transportadoras/", VisaoDiretorioEmpresas.as_view(), {"papel": PapelEmpresa.Codigo.TRANSPORTADORA}, name="fretes-transportadoras"),
    path("demandas/", VisaoDemandasTransporte.as_view(), name="fretes-demandas"),
    path("<uuid:pk>/", VisaoDetalheFrete.as_view(), name="fretes-detalhe"),
] + [
    path(f"<uuid:pk>/{acao}/", VisaoComandoFrete.as_view(), {"acao": acao}, name=f"fretes-{acao}")
    for acao in COMANDOS
]
