from django.contrib import admin

from transportes.models import (
    Caminhao,
    DocumentoFrete,
    Entrega,
    HistoricoFrete,
    Motorista,
    OportunidadeFrete,
    ProcessoFrete,
    PropostaFrete,
    Transportadora,
)


@admin.register(Transportadora)
class TransportadoraAdmin(admin.ModelAdmin):
    list_display = ("id_transportadora", "empresa", "tipo_transporte", "is_homologada", "status_sigor")
    search_fields = ("empresa__razao_social", "empresa__cnpj", "registro_antt", "codigo_unidade_sigor")
    list_filter = ("is_homologada", "status_sigor", "tipo_transporte")


@admin.register(Caminhao)
class CaminhaoAdmin(admin.ModelAdmin):
    list_display = ("placa", "transportadora", "tipo_veiculo", "capacidade_carga_kg", "is_ativo")
    list_filter = ("is_ativo", "tipo_veiculo")


@admin.register(Motorista)
class MotoristaAdmin(admin.ModelAdmin):
    list_display = ("nome_completo", "transportadora", "cnh", "categoria_cnh", "is_ativo")
    search_fields = ("nome_completo", "cpf", "cnh")
    list_filter = ("is_ativo", "categoria_cnh")


@admin.register(ProcessoFrete)
class ProcessoFreteAdmin(admin.ModelAdmin):
    list_display = ("numero_pedido", "empresa_solicitante", "material", "status", "previsao_entrega")
    search_fields = ("numero_pedido", "cliente", "material", "origem", "destino")
    list_filter = ("status", "fonte", "modalidade")


admin.site.register(OportunidadeFrete)
admin.site.register(PropostaFrete)
admin.site.register(DocumentoFrete)
admin.site.register(HistoricoFrete)
admin.site.register(Entrega)
