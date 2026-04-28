from django.contrib import admin

from accounts.models import Empresa, SessionToken


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ("razao_social", "cnpj", "tipo_perfil", "telefone_whatsapp", "data_cadastro")
    search_fields = ("razao_social", "cnpj", "user__email")


@admin.register(SessionToken)
class SessionTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "last_used_at")
    search_fields = ("user__email", "user__username")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
