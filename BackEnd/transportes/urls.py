from django.urls import path

from transportes import views


urlpatterns = [
    path("transportadoras/", views.TransportadoraListCreateView.as_view(), name="transportadora-list"),
    path("transportadoras/<int:pk>/", views.TransportadoraDetailView.as_view(), name="transportadora-detail"),
    path("transportadoras/<int:pk>/validar-sigor/", views.ValidarSigorView.as_view(), name="transportadora-sigor"),
    path("caminhoes/", views.CaminhaoListCreateView.as_view(), name="caminhao-list"),
    path("caminhoes/<int:pk>/", views.CaminhaoDetailView.as_view(), name="caminhao-detail"),
    path("motoristas/", views.MotoristaListCreateView.as_view(), name="motorista-list"),
    path("motoristas/<int:pk>/", views.MotoristaDetailView.as_view(), name="motorista-detail"),
    path("fretes/", views.ProcessoFreteListCreateView.as_view(), name="frete-list"),
    path("fretes/<int:pk>/", views.ProcessoFreteDetailView.as_view(), name="frete-detail"),
    path("fretes/<int:pk>/publicar/", views.PublicarOportunidadeView.as_view(), name="frete-publicar"),
    path("fretes/<int:pk>/documento/", views.DocumentoFreteView.as_view(), name="frete-documento"),
    path("fretes/<int:pk>/historico/", views.HistoricoFreteView.as_view(), name="frete-historico"),
    path("oportunidades/", views.OportunidadeListView.as_view(), name="oportunidade-list"),
    path("oportunidades/<int:pk>/propostas/", views.PropostaListCreateView.as_view(), name="proposta-list"),
    path("propostas/<int:pk>/aprovar/", views.AprovarPropostaView.as_view(), name="proposta-aprovar"),
    path("entregas/", views.EntregaListCreateView.as_view(), name="entrega-list"),
    path("entregas/<int:pk>/iniciar/", views.IniciarEntregaView.as_view(), name="entrega-iniciar"),
    path("entregas/pedido/<str:order_number>/", views.EntregaPublicaView.as_view(), name="entrega-publica"),
    path("entregas/pedido/<str:order_number>/validar/", views.ValidarIdentidadeEntregaView.as_view(), name="entrega-validar"),
    path("entregas/pedido/<str:order_number>/confirmar/", views.ConfirmarEntregaView.as_view(), name="entrega-confirmar"),
]
