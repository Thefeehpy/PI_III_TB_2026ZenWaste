from django.contrib import admin
from produtos.models import MovimentacaoEstoque, Produto

class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('id_produto', 'descricao_produto', 'tipo_produto', 'quantidade', 'unidade', 'status', 'empresa')
    list_filter = ('status', 'tipo_produto', 'unidade')
    search_fields = ('descricao_produto', 'tipo_produto', 'empresa__razao_social')


class MovimentacaoEstoqueAdmin(admin.ModelAdmin):
    list_display = ('id_movimentacao', 'produto', 'empresa', 'tipo', 'quantidade', 'saldo_resultante', 'criado_em')
    list_filter = ('tipo', 'criado_em')
    search_fields = ('produto__descricao_produto', 'empresa__razao_social')

admin.site.register(Produto, ProdutoAdmin)
admin.site.register(MovimentacaoEstoque, MovimentacaoEstoqueAdmin)
    
