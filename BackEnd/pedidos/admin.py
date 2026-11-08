from django.contrib import admin

from pedidos.models import Pedido, TentativaPagamento, EventoWebhook


class AdministracaoHistoricoSomenteLeitura(admin.ModelAdmin):
    def get_readonly_fields(self, requisicao, obj=None):
        return tuple(campo.name for campo in self.model._meta.fields)

    def has_add_permission(self, requisicao):
        return False

    def has_change_permission(self, requisicao, obj=None):
        return False

    def has_delete_permission(self, requisicao, obj=None):
        return False


@admin.register(Pedido)
class AdministracaoPedido(AdministracaoHistoricoSomenteLeitura):
    list_display = ('numero', 'empresa_compradora', 'situacao', 'valor_total', 'criado_em')
    list_filter = ('situacao', 'metodo', 'criado_em')
    search_fields = ('numero', 'nome_comprador', 'email_comprador', 'documento_comprador')
    readonly_fields = ("id", 'criado_em', 'atualizado_em', 'pago_em')


@admin.register(TentativaPagamento)
class AdministracaoTentativaPagamento(AdministracaoHistoricoSomenteLeitura):
    list_display = ('pedido', 'provedor', 'metodo', 'situacao', 'valor_centavos', 'criado_em')
    list_filter = ('provedor', 'metodo', 'situacao')
    search_fields = ('pedido__numero', 'referencia_provedor')
    readonly_fields = tuple(campo.name for campo in TentativaPagamento._meta.fields)


@admin.register(EventoWebhook)
class AdministracaoEventoWebhook(AdministracaoHistoricoSomenteLeitura):
    list_display = ('provedor', 'identificador_externo', 'pagamento', 'processado', 'recebido_em')
    list_filter = ('provedor', 'processado')
    readonly_fields = tuple(campo.name for campo in EventoWebhook._meta.fields)
