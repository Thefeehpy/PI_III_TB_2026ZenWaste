from django.urls import path
from transportes import views

urlpatterns = [
    # Transportadoras
    path('transportadoras/', views.TransportadoraListCreateView.as_view(), name='transportadora-list'),
    path('transportadoras/<int:pk>/', views.TransportadoraDetailView.as_view(), name='transportadora-detail'),

    # Caminhões
    path('caminhoes/', views.CaminhaoListCreateView.as_view(), name='caminhao-list'),
    path('caminhoes/<int:pk>/', views.CaminhaoDetailView.as_view(), name='caminhao-detail'),

    # Motoristas
    path('motoristas/', views.MotoristaListCreateView.as_view(), name='motorista-list'),
    path('motoristas/<int:pk>/', views.MotoristaDetailView.as_view(), name='motorista-detail'),
]