from django.contrib import admin

from fretes.models import ConfirmacaoEntrega, CotacaoFrete, DemandaTransporte, DivergenciaFrete, DocumentoCTe, Frete, HistoricoFrete


class AdministracaoAuditoriaSomenteLeitura(admin.ModelAdmin):
    def get_readonly_fields(self, requisicao, obj=None):
        return tuple(campo.name for campo in self.model._meta.fields if campo.name != "dados_assinatura")

    def get_fields(self, requisicao, obj=None):
        # A imagem privada não é exposta na administração genérica.
        return tuple(campo.name for campo in self.model._meta.fields if campo.name != "dados_assinatura")

    def has_add_permission(self, requisicao):
        return False

    def has_change_permission(self, requisicao, obj=None):
        return False

    def has_delete_permission(self, requisicao, obj=None):
        return False


@admin.register(Frete)
class AdministracaoFrete(AdministracaoAuditoriaSomenteLeitura):
    list_display = ("numero_pedido", "empresa_vendedora", "empresa_compradora", "situacao", "modalidade", "criado_em")
    list_filter = ("situacao", "modalidade", "origem_cadastro")
    search_fields = ("numero_pedido", "material")


for modelo in (CotacaoFrete, DocumentoCTe, DivergenciaFrete, ConfirmacaoEntrega, HistoricoFrete, DemandaTransporte):
    admin.site.register(modelo, AdministracaoAuditoriaSomenteLeitura)
