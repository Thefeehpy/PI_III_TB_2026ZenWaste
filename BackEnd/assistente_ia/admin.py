from django.contrib import admin

from assistente_ia.models import AssistenteIA


@admin.register(AssistenteIA)
class AssistenteIAAdmin(admin.ModelAdmin):
    list_display = ("id_assistente_ia", "empresa", "status_ia", "fonte", "criado_em")
    list_filter = ("status_ia", "fonte", "criado_em")
    search_fields = ("empresa__razao_social", "sugestao_descricao", "recomendacao_frete")
    readonly_fields = ("criado_em", "atualizado_em")
