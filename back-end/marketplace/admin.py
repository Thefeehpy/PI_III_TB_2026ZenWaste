from django.contrib import admin

from marketplace.models import Anuncio, ImagemAnuncio


@admin.register(Anuncio)
class AnuncioAdmin(admin.ModelAdmin):
    list_display = ("id_anuncio", "produto", "preco_final", "nr_qntd", "localizacao", "status_anuncio", "data_publicacao")
    list_filter = ("status_anuncio", "localizacao", "produto__categoria_residuo")
    search_fields = ("produto__nome_residuo", "produto__empresa__razao_social")


@admin.register(ImagemAnuncio)
class ImagemAnuncioAdmin(admin.ModelAdmin):
    list_display = ("id_imagem", "produto", "eh_capa", "url_arquivo")
    list_filter = ("eh_capa",)
    search_fields = ("produto__nome_residuo", "url_arquivo")
