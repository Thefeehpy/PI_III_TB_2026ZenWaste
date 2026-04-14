from django.urls import path

from apps.common.views import endpoint_index

from . import views


urlpatterns = [
    path(
        "",
        endpoint_index(
            "ZenWaste Auth API",
            [
                {"method": "POST", "path": "/api/auth/register/", "description": "Cadastro de empresa com CNPJ valido."},
                {"method": "POST", "path": "/api/auth/login/", "description": "Login; retorna token Bearer."},
                {"method": "GET", "path": "/api/auth/me/", "description": "Perfil da empresa autenticada."},
                {"method": "PATCH", "path": "/api/auth/me/", "description": "Atualiza dados cadastrais."},
                {"method": "POST", "path": "/api/auth/logout/", "description": "Encerra o token atual."},
            ],
        ),
        name="auth-index",
    ),
    path("register/", views.register, name="auth-register"),
    path("login/", views.login, name="auth-login"),
    path("me/", views.me, name="auth-me"),
    path("logout/", views.logout, name="auth-logout"),
]
