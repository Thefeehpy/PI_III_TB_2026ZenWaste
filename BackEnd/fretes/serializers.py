"""Contratos de entrada da auditoria; regras e autorização pertencem aos serviços."""

from decimal import Decimal

from rest_framework import serializers

from fretes.dominio import SituacaoFrete
from fretes.models import CotacaoFrete, DemandaTransporte, DivergenciaFrete, DocumentoCTe, Frete
from fretes.permissoes import permissoes_frete
from fretes.validacoes import validar_assinatura_canvas
from app.excecoes import ErroRegraNegocio


SITUACOES_AUDITORIA = tuple(SituacaoFrete.values)


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

    def to_internal_value(self, dados):
        if isinstance(dados, dict) and dados.get("previsao_entrega") == "":
            dados = {**dados, "previsao_entrega": None}
        return super().to_internal_value(dados)

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

    def validate_dados_assinatura(self, valor):
        try:
            return validar_assinatura_canvas(valor, campo="dados_assinatura")
        except ErroRegraNegocio as erro:
            raise serializers.ValidationError(erro.detalhes["dados_assinatura"]) from erro

    def validate(self, dados):
        if dados["tipo_recebimento"] == "com_ressalva" and not dados.get("ressalva", "").strip():
            raise serializers.ValidationError({"ressalva": "Descreva a ressalva do recebimento."})
        return dados


class SerializadorPublicacaoDemanda(serializers.Serializer):
    valor_sugerido = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    janela_coleta = serializers.CharField(max_length=120)
    tipo_veiculo = serializers.CharField(max_length=120)
    observacoes = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class SerializadorEmpresaFrete(serializers.Serializer):
    id = serializers.IntegerField(source="pk")
    razao_social = serializers.CharField()


class SerializadorCotacaoFrete(serializers.ModelSerializer):
    transportadora = SerializadorEmpresaFrete()

    class Meta:
        model = CotacaoFrete
        fields = ("id", "transportadora", "valor", "prazo_dias", "observacao", "aprovada")


class SerializadorDocumentoCTe(serializers.ModelSerializer):
    recebido_em = serializers.DateTimeField(source="criado_em")

    class Meta:
        model = DocumentoCTe
        fields = ("id", "numero", "versao", "valor", "nome_arquivo", "arquivo_nfe", "recebido_em")


class SerializadorDivergenciaFrete(serializers.ModelSerializer):
    empresa_resolvedora = SerializadorEmpresaFrete()

    class Meta:
        model = DivergenciaFrete
        fields = (
            "id", "documento_id", "valor_referencia", "valor_cobrado", "diferenca",
            "tipo_resolucao", "documento_correcao_id", "justificativa", "empresa_resolvedora", "resolvida_em",
        )


class SerializadorDemandaTransporte(serializers.ModelSerializer):
    numero_pedido = serializers.CharField(source="frete.numero_pedido")
    material = serializers.CharField(source="frete.material")
    origem = serializers.CharField(source="frete.origem")
    destino = serializers.CharField(source="frete.destino")
    peso_toneladas = serializers.DecimalField(source="frete.peso_toneladas", max_digits=12, decimal_places=3)
    cubagem_m3 = serializers.DecimalField(source="frete.cubagem_m3", max_digits=12, decimal_places=3)
    publicado_em = serializers.DateTimeField(source="publicada_em")
    propostas = serializers.SerializerMethodField()

    def get_propostas(self, demanda):
        return getattr(demanda, "total_propostas", None) if hasattr(demanda, "total_propostas") else demanda.frete.cotacoes.count()

    class Meta:
        model = DemandaTransporte
        fields = (
            "id", "frete_id", "numero_pedido", "material", "origem", "destino", "peso_toneladas",
            "cubagem_m3", "valor_sugerido", "janela_coleta", "tipo_veiculo", "observacoes", "publicado_em", "propostas",
        )


def _pode_ver_financeiro(empresa, frete):
    return empresa.pk in (frete.empresa_vendedora_id, frete.empresa_compradora_id, frete.transportadora_id)


class SerializadorFrete(serializers.ModelSerializer):
    cliente = serializers.CharField(source="empresa_compradora.razao_social")
    empresa_vendedora = SerializadorEmpresaFrete()
    empresa_compradora = SerializadorEmpresaFrete()
    transportadora = SerializadorEmpresaFrete()
    modalidade = serializers.SerializerMethodField()
    valor_cte = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    diferenca = serializers.DecimalField(max_digits=13, decimal_places=2, read_only=True, allow_null=True)
    divergente = serializers.BooleanField(read_only=True)
    divergencia_aberta = serializers.BooleanField(read_only=True)
    permissoes = serializers.SerializerMethodField()
    recebimento_confirmado = serializers.BooleanField(read_only=True)

    def get_modalidade(self, frete):
        return frete.modalidade or None

    def get_permissoes(self, frete):
        return permissoes_frete(self.context["empresa"], frete)

    def to_representation(self, frete):
        dados = super().to_representation(frete)
        if not _pode_ver_financeiro(self.context["empresa"], frete):
            for campo in ("valor_referencia", "valor_cte", "diferenca"):
                dados[campo] = None
        return dados

    class Meta:
        model = Frete
        fields = (
            "id", "pedido_id", "numero_pedido", "cliente", "material", "quantidade", "unidade", "origem", "destino",
            "empresa_vendedora", "empresa_compradora", "transportadora", "peso_toneladas", "cubagem_m3",
            "quantidade_volumes", "data_pedido", "previsao_entrega", "situacao", "modalidade", "valor_referencia",
            "valor_cte", "diferenca", "divergente", "divergencia_aberta", "permissoes", "recebimento_confirmado",
        )


class SerializadorDetalheFrete(SerializadorFrete):
    cotacoes = serializers.SerializerMethodField()
    documento = serializers.SerializerMethodField()
    documentos = serializers.SerializerMethodField()
    divergencias = serializers.SerializerMethodField()
    historico = serializers.SerializerMethodField()
    tratativas = serializers.SerializerMethodField()
    demandas = SerializadorDemandaTransporte(many=True)
    retirada = serializers.SerializerMethodField()
    entrega = serializers.SerializerMethodField()

    def get_cotacoes(self, frete):
        empresa = self.context["empresa"]
        cotacoes = list(frete.cotacoes.all())
        if empresa.pk not in (frete.empresa_vendedora_id, frete.empresa_compradora_id):
            cotacoes = [cotacao for cotacao in cotacoes if cotacao.transportadora_id == empresa.pk]
        return SerializadorCotacaoFrete(cotacoes, many=True).data

    def get_documento(self, frete):
        documento = frete.documento_atual
        return SerializadorDocumentoCTe(documento).data if documento and _pode_ver_financeiro(self.context["empresa"], frete) else None

    def get_documentos(self, frete):
        return SerializadorDocumentoCTe(frete.documentos.all(), many=True).data if _pode_ver_financeiro(self.context["empresa"], frete) else []

    def get_divergencias(self, frete):
        return SerializadorDivergenciaFrete(frete.divergencias.all(), many=True).data if _pode_ver_financeiro(self.context["empresa"], frete) else []

    def _eventos_visiveis(self, frete):
        empresa = self.context["empresa"]
        gestao_comercial = empresa.pk in (frete.empresa_vendedora_id, frete.empresa_compradora_id)
        for evento in frete.historico.all():
            if not gestao_comercial and evento.acao in ("cotacoes", "aprovar-cotacao"):
                if evento.detalhes.get("transportadora_id") != empresa.pk:
                    continue
            if not _pode_ver_financeiro(empresa, frete) and evento.acao in ("registrar-cte", "resolver-divergencia", "tratativas"):
                continue
            yield evento

    def get_historico(self, frete):
        return [{
            "id": str(evento.pk), "tipo": evento.acao, "situacao_anterior": evento.situacao_anterior or None,
            "situacao_nova": evento.situacao_nova, "autor": SerializadorEmpresaFrete(evento.autora).data,
            "registrado_em": evento.criado_em.isoformat(), "detalhes": evento.detalhes,
        } for evento in self._eventos_visiveis(frete)]

    def get_tratativas(self, frete):
        return [{
            "id": str(evento.pk), "observacao": evento.detalhes.get("observacao", ""),
            "autor": SerializadorEmpresaFrete(evento.autora).data, "registrado_em": evento.criado_em.isoformat(),
        } for evento in self._eventos_visiveis(frete) if evento.acao == "tratativas"]

    def get_retirada(self, frete):
        return {"nome_foto": frete.nome_foto_retirada, "registrada_em": frete.retirado_em.isoformat()} if frete.retirado_em else None

    def get_entrega(self, frete):
        if not frete.recebimento_confirmado:
            return None
        entrega = frete.entrega
        return {
            "nome_recebedor": entrega.nome_recebedor, "confirmado_em": entrega.confirmado_em.isoformat(),
            "tipo_recebimento": entrega.tipo_recebimento, "ressalva": entrega.ressalva,
            "assinatura_registrada": bool(entrega.dados_assinatura),
        }

    class Meta(SerializadorFrete.Meta):
        fields = SerializadorFrete.Meta.fields + (
            "cotacoes", "documento", "documentos", "divergencias", "historico", "tratativas", "demandas", "retirada", "entrega",
        )


class SerializadorPedidoDisponivel(serializers.Serializer):
    id = serializers.UUIDField()
    numero = serializers.CharField()
    material = serializers.CharField(source="nome_material_negociado")
    cliente = serializers.CharField(source="empresa_compradora.razao_social")
    origem = serializers.CharField(source="localizacao_material_negociado")
    data_pedido = serializers.SerializerMethodField()
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=3)
    quantidade_restante = serializers.DecimalField(source="quantidade_disponivel_frete", max_digits=12, decimal_places=3)
    unidade = serializers.CharField(source="unidade_material_negociado")

    def get_data_pedido(self, pedido):
        return pedido.criado_em.date().isoformat()
