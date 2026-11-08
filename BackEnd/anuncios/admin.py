from django.contrib import admin

from anuncios.models import Anuncio, ImagemAnuncio, Reserva


class ImagensAnuncioEmLinha(admin.TabularInline):
    model = ImagemAnuncio
    extra = 0


@admin.register(Anuncio)
class AdministracaoAnuncio(admin.ModelAdmin):
    list_display = ("id_anuncio", "produto", "preco_final", "nr_qtd", "localizacao", "situacao_anuncio", "data_publicacao")
    list_filter = ("situacao_anuncio", "data_publicacao", "localizacao")
    search_fields = ("produto__nome_residuo", "produto__categoria__nome_material", "produto__empresa__razao_social")
    inlines = [ImagensAnuncioEmLinha]
    # Alteracoes financeiras e de estoque devem usar o servico correspondente.
    readonly_fields = ("nr_qtd", "preco_final", "produto", "situacao_anuncio")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Reserva)
class AdministracaoReserva(admin.ModelAdmin):
    list_display = (
        "id_reserva", "produto", "empresa_compradora", "modalidade", "quantidade_reservada",
        "situacao", "data_reserva", "data_finalizacao",
    )
    list_filter = ("situacao", "modalidade", "data_reserva", "data_finalizacao")
    search_fields = ("produto__nome_residuo", "nome_comprador", "numero_comprador")
    readonly_fields = (
        "produto", "pedido", "empresa_compradora", "modalidade", "quantidade_reservada",
        "preco_unitario", "situacao", "data_reserva", "data_finalizacao",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
