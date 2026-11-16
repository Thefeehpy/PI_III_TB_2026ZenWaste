from django.urls import path
from mtr.sigor import http as v

urlpatterns=[
    path('rascunhos/<uuid:id>/diagnostico/',v.DiagnosticoCenarioSIGOR.as_view()),
    path('contratos/',v.ContratosSIGOR.as_view()),
    path('vinculos/',v.VinculosSIGOR.as_view()),
    path('vinculos/<uuid:id>/revogacao/',v.RevogacaoSIGOR.as_view()),
    path('catalogos/referencia-operador/',v.ReferenciaOperadorSIGOR.as_view()),
    path('leituras/<slug:operacao>/',v.ConsultaSIGOR.as_view()),
    path('capturas/<uuid:id>/',v.CapturasSIGOR.as_view()),
    path('rascunhos/<uuid:id>/revisoes/',v.RevisaoSIGOR.as_view()),
    path('rascunhos/<uuid:id>/preparacoes/',v.PreparacaoSIGOR.as_view()),
    path('despachos/<uuid:id>/',v.DetalheDespachoSIGOR.as_view()),
    path('despachos/<uuid:id>/executar-simulacao/',v.ExecutarSimulacaoSIGOR.as_view()),
    path('despachos/<uuid:id>/reconciliacoes/',v.ReconciliacaoSIGOR.as_view()),
    path('despachos/<uuid:id>/solicitacoes-emissao/',v.SolicitacaoEmissaoSIGOR.as_view()),
    path('despachos/<uuid:id>/emitir/',v.EmissaoGovernamentalSIGOR.as_view()),
]
