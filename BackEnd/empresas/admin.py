from django.contrib import admin
from empresas.models import Empresa

class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('id_empresa', 'cnpj', 'email',)
    search_fields = ('id_empresa',)

admin.site.register(Empresa, EmpresaAdmin)