from django.contrib import admin
from produtos.models import Produto

class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('id_produto', 'tipo_produto', 'data_registro', 'quantidade', 'empresa',)
    search_fields = ('id_produto',)

admin.site.register(Produto, ProdutoAdmin)
    
