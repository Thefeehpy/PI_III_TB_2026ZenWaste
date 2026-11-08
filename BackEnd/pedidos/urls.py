from django.urls import path

from pedidos.views import (
	VisaoAPICancelamentoPedido,
	VisaoAPIDetalhePedido,
	VisaoAPIPagamentoCartao,
	VisaoAPIPagamentoPix,
	VisaoAPIPedidos,
	VisaoAPINotificacaoPagamento,
	VisaoAPISimulacaoPagamento,
)


urlpatterns = [
	path("orders/", VisaoAPIPedidos.as_view(), name="api-orders"),
	path("orders/<uuid:pk>/", VisaoAPIDetalhePedido.as_view(), name="api-order-detail"),
	path("orders/<uuid:pk>/payments/", VisaoAPIPagamentoCartao.as_view(), name="api-order-card-payment"),
	path("orders/<uuid:pk>/pix/", VisaoAPIPagamentoPix.as_view(), name="api-order-pix"),
	path("orders/<uuid:pk>/cancel/", VisaoAPICancelamentoPedido.as_view(), name="api-order-cancel"),
	path("orders/<uuid:pk>/sandbox-result/", VisaoAPISimulacaoPagamento.as_view(), name="api-order-sandbox-result"),
	path("payments/webhooks/<slug:provedor>/", VisaoAPINotificacaoPagamento.as_view(), name="api-payment-webhook"),
]
