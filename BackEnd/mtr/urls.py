from django.urls import include,path
from mtr import views as v

urlpatterns=[
    path('sigor/',include('mtr.sigor.urls')),
    path('contexto/',v.ContextoMTR.as_view()), path('operacoes/',v.OperacoesMTR.as_view()),
    path('fretes/<uuid:id>/preenchimento/',v.PreenchimentoMTR.as_view()), path('catalogos/',v.CatalogosMTR.as_view()),
    path('sessoes-operador/',v.SessaoMTR.as_view()), path('rascunhos/',v.ListaRascunhosMTR.as_view()),
    path('rascunhos/<uuid:id>/',v.DetalheRascunhoMTR.as_view()), path('rascunhos/<uuid:id>/validacao/',v.ValidacaoMTR.as_view()),
    path('rascunhos/<uuid:id>/revisoes/',v.RevisaoMTR.as_view()), path('rascunhos/<uuid:id>/intencoes/',v.PreparacaoMTR.as_view()),
    path('intencoes/<uuid:id>/',v.IntencaoMTR.as_view()), path('intencoes/<uuid:id>/enviar/',v.EnvioMTR.as_view()),
    path('intencoes/<uuid:id>/reconciliacoes/',v.ReconciliacaoMTR.as_view()), path('comandos/<uuid:chave>/',v.ConsultaReciboMTR.as_view()),
    path('emissao-real/',v.EmissaoRealBloqueadaMTR.as_view()),
]
