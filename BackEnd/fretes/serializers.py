"""Contratos de entrada da auditoria; regras e autorização pertencem aos serviços."""

from decimal import Decimal

from rest_framework import serializers


SITUACOES_AUDITORIA = (
    "aguardando_classificacao", "em_cotacao", "aguardando_conferencia",
    "com_divergencia", "aguardando_entrega", "concluido", "cancelado",
)


class SerializadorConsultaFretes(serializers.Serializer):
    pagina = serializers.IntegerField(min_value=1, default=1)
    tamanho_pagina = serializers.IntegerField(min_value=1, max_value=100, default=10)
    situacao = serializers.ChoiceField(choices=SITUACOES_AUDITORIA, required=False)
    transportadora_id = serializers.IntegerField(min_value=1, required=False)
    busca = serializers.CharField(max_length=160, required=False, allow_blank=True)
    data_inicio = serializers.DateField(required=False)
    data_fim = serializers.DateField(required=False)

    def validate(self, dados):
        if dados.get("data_inicio") and dados.get("data_fim") and dados["data_inicio"] > dados["data_fim"]:
            raise serializers.ValidationError({"data_fim": "A data final deve ser igual ou posterior à inicial."})
        return dados


class SerializadorCriacaoFrete(serializers.Serializer):
    pedido_id = serializers.UUIDField(required=False, allow_null=True)
    empresa_compradora_id = serializers.IntegerField(min_value=1, required=False)
    material = serializers.CharField(max_length=256, required=False)
    unidade = serializers.CharField(max_length=12, required=False)
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    origem = serializers.CharField(max_length=255)
    destino = serializers.CharField(max_length=255)
    peso_toneladas = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0"))
    cubagem_m3 = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0"))
    quantidade_volumes = serializers.IntegerField(min_value=0)
    previsao_entrega = serializers.DateField(required=False, allow_null=True)

    def validate(self, dados):
        if not dados.get("pedido_id"):
            ausentes = {
                campo: "Informe este campo para cadastrar um frete avulso."
                for campo in ("empresa_compradora_id", "material", "unidade") if not dados.get(campo)
            }
            if ausentes:
                raise serializers.ValidationError(ausentes)
        return dados


class SerializadorClassificacaoFrete(serializers.Serializer):
    modalidade = serializers.ChoiceField(choices=("cotar", "contratado", "retirada_cliente"))
    transportadora_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    valor_referencia = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True,
    )


class SerializadorRegistroCotacao(serializers.Serializer):
    transportadora_id = serializers.IntegerField(min_value=1)
    valor = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    prazo_dias = serializers.IntegerField(min_value=1)
    observacao = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class SerializadorAprovacaoCotacao(serializers.Serializer):
    cotacao_id = serializers.UUIDField()


class SerializadorRegistroCTe(serializers.Serializer):
    numero = serializers.CharField(max_length=60)
    valor = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    nome_arquivo = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    arquivo_nfe = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class SerializadorJustificativaFrete(serializers.Serializer):
    justificativa = serializers.CharField(max_length=1000, allow_blank=False)


class SerializadorTratativaFrete(serializers.Serializer):
    observacao = serializers.CharField(max_length=1000, allow_blank=False)


class SerializadorRetiradaFrete(serializers.Serializer):
    nome_foto = serializers.CharField(max_length=255)


class SerializadorConfirmacaoEntrega(serializers.Serializer):
    nome_recebedor = serializers.CharField(max_length=120)
    dados_assinatura = serializers.CharField(max_length=700000, trim_whitespace=False)
    tipo_recebimento = serializers.ChoiceField(choices=("completo", "com_ressalva"))
    ressalva = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")

    def validate(self, dados):
        if dados["tipo_recebimento"] == "com_ressalva" and not dados.get("ressalva", "").strip():
            raise serializers.ValidationError({"ressalva": "Descreva a ressalva do recebimento."})
        return dados


class SerializadorPublicacaoDemanda(serializers.Serializer):
    valor_sugerido = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    janela_coleta = serializers.CharField(max_length=120)
    tipo_veiculo = serializers.CharField(max_length=120)
    observacoes = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
