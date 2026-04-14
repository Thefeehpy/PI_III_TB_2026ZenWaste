from django.contrib import admin

from .models import CategoriaResiduo, MvtoProduto, Produto, Reserva, UnidadeMedida


@admin.register(CategoriaResiduo)
class CategoriaResiduoAdmin(admin.ModelAdmin):
    list_display = ("id_categoria", "nome_material")
    search_fields = ("nome_material",)


@admin.register(UnidadeMedida)
class UnidadeMedidaAdmin(admin.ModelAdmin):
    list_display = ("id_unidade", "sigla_unidade", "descricao_unidade")
    search_fields = ("sigla_unidade", "descricao_unidade")


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("id_reserva", "status_meta", "qntd_reserva", "venda")
    list_filter = ("status_meta",)


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = (
        "id_produto",
        "nome_residuo",
        "empresa",
        "categoria_residuo",
        "quantidade_total",
        "unidade",
        "status",
        "data_registro",
    )
    list_filter = ("status", "categoria_residuo", "unidade")
    search_fields = ("nome_residuo", "empresa__razao_social", "categoria_residuo__nome_material")


@admin.register(MvtoProduto)
class MvtoProdutoAdmin(admin.ModelAdmin):
    list_display = ("id_estoque", "produto", "dt_entrada", "nr_qntd")
    search_fields = ("produto__nome_residuo", "produto__empresa__razao_social")
