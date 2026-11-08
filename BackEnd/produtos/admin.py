from django.contrib import admin

from produtos.models import CategoriaResiduo, MovimentacaoEstoque, Produto, UnidadeMedida


@admin.register(CategoriaResiduo)
class AdministracaoCategoriaResiduo(admin.ModelAdmin):
    list_display = ("id_categoria", "nome_material", "ativo")
    list_filter = ("ativo",)
    search_fields = ("nome_material",)


@admin.register(UnidadeMedida)
class AdministracaoUnidadeMedida(admin.ModelAdmin):
    list_display = ("id_unidade", "sigla", "descricao", "ativo")
    list_filter = ("ativo",)
    search_fields = ("sigla", "descricao")


@admin.register(Produto)
class AdministracaoProduto(admin.ModelAdmin):
    list_display = ("id_produto", "nome_residuo", "categoria", "quantidade", "unidade_medida", "situacao", "ativo", "empresa")
    list_filter = ("ativo", "situacao", "categoria", "unidade_medida")
    search_fields = ("nome_residuo", "categoria__nome_material", "empresa__razao_social")
    readonly_fields = ("quantidade", "situacao", "data_registro", "atualizado_em")

    def has_add_permission(self, requisicao):
        return False

    def has_change_permission(self, requisicao, obj=None):
        # Alteracoes no estoque devem passar pelo mesmo servico transacional.
        return False

    def has_delete_permission(self, requisicao, obj=None):
        return False


@admin.register(MovimentacaoEstoque)
class AdministracaoMovimentacaoEstoque(admin.ModelAdmin):
    list_display = ("id_movimentacao", "produto", "empresa", "tipo", "quantidade", "saldo_resultante", "criado_em")
    list_filter = ("tipo", "criado_em")
    search_fields = ("produto__nome_residuo", "produto__empresa__razao_social")
    readonly_fields = ("produto", "tipo", "quantidade", "observacao", "saldo_resultante", "criado_em")

    def has_add_permission(self, requisicao):
        return False

    def has_change_permission(self, requisicao, obj=None):
        return False

    def has_delete_permission(self, requisicao, obj=None):
        return False
