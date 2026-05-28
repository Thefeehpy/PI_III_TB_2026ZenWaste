from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from empresas.views import EmpresaCreateListView, EmpresaRetrieveUpdateDestroy
from login.views import LoginView
from produtos.views import ProdutoCreateListView, ProdutoRetrieveUpdateDestroy
from anuncios.views import AnuncioCreateListView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Rotas legadas mantidas para compatibilidade com entregas anteriores.
    path("empresa/", EmpresaCreateListView.as_view(), name="empresas-create-list"),
    path("empresa/<int:pk>", EmpresaRetrieveUpdateDestroy.as_view(), name="empresa-detail-view"),
    path("produto", ProdutoCreateListView.as_view(), name="criar-produto"),
    path("produto/<int:pk>", ProdutoRetrieveUpdateDestroy.as_view(), name="produto-detail-view"),
    path("login", LoginView.as_view(), name="Login"),
    path("auth/login/", LoginView.as_view(), name="legacy-auth-login"),
    path("authentication/token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("authentication/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("authentication/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("anuncio", AnuncioCreateListView.as_view(), name="Criar-anuncio"),
    # API consumida pelo front-end React.
    path("api/auth/", include("login.urls")),
    path("api/inventory/", include("produtos.urls")),
    path("api/marketplace/", include("marketplace.urls")),
    path("api/market/", include("market.urls")),
]
