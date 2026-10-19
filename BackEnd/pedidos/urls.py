from django.urls import path

from pedidos.views import (
	OrderCancelAPIView,
	OrderDetailAPIView,
	OrderPaymentAPIView,
	OrderPixAPIView,
	OrdersAPIView,
	PaymentWebhookAPIView,
	SandboxPaymentResultAPIView,
)


urlpatterns = [
	path("orders/", OrdersAPIView.as_view(), name="api-orders"),
	path("orders/<uuid:pk>/", OrderDetailAPIView.as_view(), name="api-order-detail"),
	path("orders/<uuid:pk>/payments/", OrderPaymentAPIView.as_view(), name="api-order-card-payment"),
	path("orders/<uuid:pk>/pix/", OrderPixAPIView.as_view(), name="api-order-pix"),
	path("orders/<uuid:pk>/cancel/", OrderCancelAPIView.as_view(), name="api-order-cancel"),
	path("orders/<uuid:pk>/sandbox-result/", SandboxPaymentResultAPIView.as_view(), name="api-order-sandbox-result"),
	path("payments/webhooks/<slug:provider>/", PaymentWebhookAPIView.as_view(), name="api-payment-webhook"),
]
