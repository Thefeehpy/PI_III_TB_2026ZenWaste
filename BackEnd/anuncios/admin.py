from django.contrib import admin
from anuncios.models import Anuncio, Reserva

class AnuncioAdmin(admin.ModelAdmin):
    list_display = ('id_anuncio', 'produto', 'preco_final', 'nr_qtd', 'localizacao', 'status_anuncio', 'data_publicacao')
    list_filter = ('status_anuncio', 'data_publicacao', 'localizacao')
    search_fields = ('produto__descricao_produto', 'produto__tipo_produto', 'produto__empresa__razao_social')


admin.site.register(Anuncio, AnuncioAdmin)


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = (
        "id_reserva",
        "produto",
        "nome_comprador",
        "numero_comprador",
        "quantidade_reservada",
        "status",
        "data_reserva",
        "data_finalizacao",
    )
    list_filter = ("status", "data_reserva", "data_finalizacao")
    search_fields = (
        "produto__descricao_produto",
        "nome_comprador",
        "numero_comprador",
    )
