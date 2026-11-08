from django.urls import path

from acesso.views import (
    VisaoAPIAcesso,
    VisaoAPISaida,
    VisaoAPIPerfil,
    VisaoAPIRecuperacaoSenha,
    VisaoAPICadastroEmpresa,
)


urlpatterns = [
    path("register/", VisaoAPICadastroEmpresa.as_view(), name="api-auth-register"),
    path("login/", VisaoAPIAcesso.as_view(), name="api-auth-login"),
    path("me/", VisaoAPIPerfil.as_view(), name="api-auth-me"),
    path("recover-password/", VisaoAPIRecuperacaoSenha.as_view(), name="api-auth-recover-password"),
    path("logout/", VisaoAPISaida.as_view(), name="api-auth-logout"),
]
