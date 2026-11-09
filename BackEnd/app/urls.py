from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from empresas.views import VisaoListagemCriacaoEmpresa, VisaoDetalheEmpresa
from acesso.views import VisaoAcessoLegado
from produtos.views import VisaoCriacaoListagemProduto, VisaoDetalheAtualizacaoDesativacaoProduto
from anuncios.views import VisaoCriacaoListagemAnuncioLegado

urlpatterns = [
    path("admin/", admin.site.urls),

    # Rotas legadas mantidas para compatibilidade com entregas anteriores.
    path("empresa/", VisaoListagemCriacaoEmpresa.as_view(), name="empresas-create-list"),
    path("empresa/<int:pk>", VisaoDetalheEmpresa.as_view(), name="empresa-detail-view"),
    path("produto", VisaoCriacaoListagemProduto.as_view(), name="criar-produto"),
    path("produto/<int:pk>", VisaoDetalheAtualizacaoDesativacaoProduto.as_view(), name="produto-detail-view"),
    path("login", VisaoAcessoLegado.as_view(), name="Login"),
    path("auth/login/", VisaoAcessoLegado.as_view(), name="legacy-auth-login"),
    path("authentication/token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("authentication/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("authentication/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("anuncio", VisaoCriacaoListagemAnuncioLegado.as_view(), name="Criar-anuncio"),
    # API consumida pelo front-end React.
    path("api/auth/", include('acesso.urls')),
    path("api/inventory/", include("produtos.urls")),
    path("api/marketplace/", include('comercializacao.urls')),
    path("api/market/", include('mercado.urls')),
    path("api/fretes/", include("fretes.urls")),
    path("api/", include("pedidos.urls")),
]
