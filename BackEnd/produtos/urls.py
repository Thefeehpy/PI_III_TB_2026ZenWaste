from django.urls import path
from produtos.views import ProdutoCreateListView, ProdutoCreate, ProdutoUpdate, ProdutoDestroy, ProdutoRetrieve


urlpatterns = [
    path('produtos/', views.ProdutoCreateListView.as_view(), name='Listar-Produtos'),
    path('produtos/<int:pk>', views.ProdutoUpdate.as_view(), name='Atualizar-cadastro'),
    path()

]