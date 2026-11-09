import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from app.excecoes import ErroRegraNegocio
from fretes.dominio import (
    ConferenciaFrete,
    SituacaoFrete,
    TipoResolucaoDivergencia,
    pode_cancelar_frete,
    pode_confirmar_recebimento,
    pode_registrar_retirada,
)


class ConsultaRegistrosImutaveis(models.QuerySet):
    def update(self, **campos):
        raise ValidationError("Este registro de auditoria é imutável.")

    def delete(self):
        raise ValidationError("Este registro de auditoria não pode ser excluído.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Este registro de auditoria é imutável.")

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        if update_conflicts:
            raise ValidationError("Registros de auditoria não podem ser sobrescritos em lote.")
        return super().bulk_create(
            objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts,
            update_conflicts=False, update_fields=update_fields, unique_fields=unique_fields,
        )


class RegistroImutavel(models.Model):
    objects = ConsultaRegistrosImutaveis.as_manager()

    class Meta:
        abstract = True

    def save(self, *, force_insert=False, force_update=False, using=None, update_fields=None):
        if not self._state.adding or force_update or update_fields is not None:
            raise ValidationError("Este registro de auditoria é imutável.")
        # Uma instância nova com PK já existente também deve falhar, nunca fazer UPDATE.
        return super().save(force_insert=True, using=using)

    def delete(self, *argumentos, **opcoes):
        raise ValidationError("Este registro de auditoria não pode ser excluído.")


class Frete(models.Model):
    Situacao = SituacaoFrete

    class Modalidade(models.TextChoices):
        COTAR = "cotar", "Cotar o frete"
        CONTRATADO = "contratado", "Frete já contratado"
        RETIRADA_CLIENTE = "retirada_cliente", "Retirada pelo cliente"

    class OrigemCadastro(models.TextChoices):
        PEDIDO = "pedido", "Pedido comercial"
        AVULSO = "avulso", "Frete avulso"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_frete")
    pedido = models.ForeignKey(
        "pedidos.Pedido", on_delete=models.PROTECT, null=True, blank=True,
        related_name="fretes", db_column="frete_pedido_id",
    )
    empresa_vendedora = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="fretes_como_vendedora",
        db_column="frete_empresa_vendedora_id",
    )
    empresa_compradora = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="fretes_como_compradora",
        db_column="frete_empresa_compradora_id",
    )
    transportadora = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, null=True, blank=True,
        related_name="fretes_atribuidos", db_column="frete_transportadora_id",
    )
    numero_pedido = models.CharField(max_length=60, db_column="frete_numero_referencia")
    origem_cadastro = models.CharField(max_length=12, choices=OrigemCadastro.choices, db_column="frete_origem_cadastro")
    material = models.CharField(max_length=256, db_column="frete_material")
    unidade = models.CharField(max_length=12, db_column="frete_unidade")
    quantidade = models.DecimalField(max_digits=12, decimal_places=3, db_column="frete_quantidade_remessa")
    origem = models.CharField(max_length=255, db_column="frete_local_origem")
    destino = models.CharField(max_length=255, db_column="frete_local_destino")
    peso_toneladas = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True, db_column="frete_peso_toneladas",
    )
    cubagem_m3 = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True, db_column="frete_cubagem_m3")
    quantidade_volumes = models.PositiveIntegerField(null=True, blank=True, db_column="frete_quantidade_volumes")
    data_pedido = models.DateField(default=timezone.localdate, db_column="frete_data_referencia")
    previsao_entrega = models.DateField(null=True, blank=True, db_column="frete_previsao_entrega")
    situacao = models.CharField(
        max_length=30, choices=Situacao.choices, default=Situacao.AGUARDANDO_CLASSIFICACAO,
        db_index=True, db_column="frete_situacao_auditoria",
    )
    modalidade = models.CharField(max_length=24, choices=Modalidade.choices, blank=True, default="", db_column="frete_modalidade")
    valor_referencia = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, db_column="frete_valor_referencia",
    )
    retirado_em = models.DateTimeField(null=True, blank=True, db_column="frete_retirado_em")
    nome_foto_retirada = models.CharField(max_length=255, blank=True, default="", db_column="frete_foto_retirada_nome")
    cancelado_em = models.DateTimeField(null=True, blank=True, db_column="frete_cancelado_em")
    justificativa_cancelamento = models.CharField(max_length=1000, blank=True, default="", db_column="frete_cancelamento_justificativa")
    criado_em = models.DateTimeField(auto_now_add=True, db_column="frete_criado_em")
    atualizado_em = models.DateTimeField(auto_now=True, db_column="frete_atualizado_em")

    class Meta:
        ordering = ["-criado_em", "-id"]
        constraints = [
            models.CheckConstraint(condition=Q(quantidade__gt=0), name="frete_quantidade_positiva"),
            models.CheckConstraint(condition=Q(peso_toneladas__isnull=True) | Q(peso_toneladas__gte=0), name="frete_peso_nao_negativo"),
            models.CheckConstraint(condition=Q(cubagem_m3__isnull=True) | Q(cubagem_m3__gte=0), name="frete_cubagem_nao_negativa"),
            models.CheckConstraint(condition=Q(valor_referencia__isnull=True) | Q(valor_referencia__gte=0), name="frete_referencia_nao_negativa"),
            models.CheckConstraint(condition=~Q(empresa_vendedora=F("empresa_compradora")), name="frete_partes_distintas"),
            models.CheckConstraint(
                condition=Q(pedido__isnull=False, origem_cadastro="pedido") | Q(pedido__isnull=True, origem_cadastro="avulso"),
                name="frete_origem_compativel",
            ),
            models.CheckConstraint(
                condition=Q(situacao__in=("aguardando_classificacao", "em_cotacao", "aguardando_conferencia", "com_divergencia", "aguardando_entrega", "concluido", "cancelado")),
                name="frete_situacao_valida",
            ),
            models.CheckConstraint(condition=Q(modalidade__in=("", "cotar", "contratado", "retirada_cliente")), name="frete_modalidade_valida"),
            models.CheckConstraint(
                condition=(
                    Q(situacao="cancelado", retirado_em__isnull=True, cancelado_em__isnull=False)
                    & ~Q(justificativa_cancelamento="")
                ) | (
                    ~Q(situacao="cancelado") & Q(cancelado_em__isnull=True, justificativa_cancelamento="")
                ),
                name="frete_cancelamento_consistente",
            ),
        ]

    def clean(self):
        super().clean()
        erros = {}
        if self.situacao == self.Situacao.CANCELADO:
            if self.retirado_em is not None:
                erros["retirado_em"] = "Um frete retirado não pode ser cancelado."
            if self.recebimento_confirmado:
                erros["situacao"] = "Um frete recebido não pode ser cancelado."
            if self.cancelado_em is None:
                erros["cancelado_em"] = "Registre o instante do cancelamento."
            if not (self.justificativa_cancelamento or "").strip():
                erros["justificativa_cancelamento"] = "Justifique o cancelamento do frete."
        elif self.cancelado_em is not None or self.justificativa_cancelamento:
            erros["situacao"] = "Dados de cancelamento exigem a situação cancelado."
        if erros:
            raise ValidationError(erros)

    @property
    def pode_cancelar(self):
        return pode_cancelar_frete(
            self.situacao, self.retirado_em, recebimento_confirmado=self.recebimento_confirmado,
        )

    @property
    def recebimento_confirmado(self):
        # Uma instância ainda não salva não possui entrega no banco. Uma relação
        # já carregada (inclusive por select_related) dispensa nova consulta.
        if self._state.adding and "entrega" not in self._state.fields_cache:
            return False
        try:
            return self.entrega.confirmado_em is not None
        except ConfirmacaoEntrega.DoesNotExist:
            return False

    @property
    def pode_registrar_retirada(self):
        return pode_registrar_retirada(
            self.situacao, self.retirado_em, recebimento_confirmado=self.recebimento_confirmado,
        )

    @property
    def pode_confirmar_entrega(self):
        return pode_confirmar_recebimento(
            self.situacao, recebimento_confirmado=self.recebimento_confirmado,
        )

    @property
    def documento_atual(self):
        documentos = list(self.documentos.all())
        return max(documentos, key=lambda documento: documento.versao, default=None)

    @property
    def valor_cte(self):
        documento = self.documento_atual
        return documento.valor if documento else None

    @property
    def diferenca(self):
        cobrado = self.valor_cte
        if cobrado is None or self.valor_referencia is None:
            return None
        return ConferenciaFrete(self.valor_referencia, cobrado).diferenca

    @property
    def divergencia_aberta(self):
        return any(divergencia.resolvida_em is None for divergencia in self.divergencias.all())

    @property
    def divergente(self):
        cobrado = self.valor_cte
        if cobrado is None or self.valor_referencia is None:
            return False
        return ConferenciaFrete(self.valor_referencia, cobrado).divergente

    def __str__(self):
        return f"Frete {self.id} — {self.numero_pedido}"


class CotacaoFrete(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_cotacao_frete")
    frete = models.ForeignKey(Frete, on_delete=models.PROTECT, related_name="cotacoes", db_column="cotacao_frete_id")
    transportadora = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT, related_name="cotacoes_frete", db_column="cotacao_transportadora_id")
    valor = models.DecimalField(max_digits=12, decimal_places=2, db_column="cotacao_valor")
    prazo_dias = models.PositiveIntegerField(db_column="cotacao_prazo_dias")
    observacao = models.CharField(max_length=1000, blank=True, default="", db_column="cotacao_observacao")
    aprovada = models.BooleanField(default=False, db_column="cotacao_aprovada")
    criada_em = models.DateTimeField(auto_now_add=True, db_column="cotacao_criada_em")

    class Meta:
        ordering = ["criada_em", "id"]
        constraints = [
            models.UniqueConstraint(fields=["frete"], condition=Q(aprovada=True), name="cotacao_unica_aprovada_frete"),
            models.CheckConstraint(condition=Q(valor__gte=0), name="cotacao_valor_nao_negativo"),
            models.CheckConstraint(condition=Q(prazo_dias__gte=1), name="cotacao_prazo_positivo"),
        ]


class DocumentoCTe(RegistroImutavel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_documento_cte")
    frete = models.ForeignKey(Frete, on_delete=models.PROTECT, related_name="documentos", db_column="cte_frete_id")
    versao = models.PositiveIntegerField(default=1, db_column="cte_versao")
    numero = models.CharField(max_length=60, db_column="cte_numero")
    valor = models.DecimalField(max_digits=12, decimal_places=2, db_column="cte_valor")
    nome_arquivo = models.CharField(max_length=255, blank=True, default="", db_column="cte_arquivo_nome")
    arquivo_nfe = models.CharField(max_length=255, blank=True, default="", db_column="cte_nfe_nome")
    criado_em = models.DateTimeField(auto_now_add=True, db_column="cte_registrado_em")

    class Meta:
        ordering = ["versao", "id"]
        constraints = [
            models.UniqueConstraint(fields=["frete", "versao"], name="cte_versao_unica_frete"),
            models.CheckConstraint(condition=Q(valor__gte=0), name="cte_valor_nao_negativo"),
            models.CheckConstraint(condition=Q(versao__gte=1), name="cte_versao_positiva"),
        ]


class DivergenciaFrete(models.Model):
    TipoResolucao = TipoResolucaoDivergencia

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_divergencia_frete")
    frete = models.ForeignKey(Frete, on_delete=models.PROTECT, related_name="divergencias", db_column="divergencia_frete_id")
    documento = models.OneToOneField(DocumentoCTe, on_delete=models.PROTECT, related_name="divergencia", db_column="divergencia_cte_id")
    valor_referencia = models.DecimalField(max_digits=12, decimal_places=2, db_column="divergencia_referencia")
    valor_cobrado = models.DecimalField(max_digits=12, decimal_places=2, db_column="divergencia_cobrado")
    diferenca = models.DecimalField(max_digits=13, decimal_places=2, db_column="divergencia_diferenca")
    justificativa = models.CharField(max_length=1000, blank=True, default="", db_column="divergencia_resolucao_justificativa")
    tipo_resolucao = models.CharField(
        max_length=20, choices=TipoResolucao.choices, blank=True, default="",
        db_column="divergencia_tipo_resolucao",
    )
    documento_correcao = models.ForeignKey(
        DocumentoCTe, on_delete=models.PROTECT, null=True, blank=True,
        related_name="divergencias_corrigidas", db_column="divergencia_cte_correcao_id",
    )
    empresa_resolvedora = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, null=True, blank=True,
        related_name="divergencias_resolvidas", db_column="divergencia_empresa_resolvedora_id",
    )
    criada_em = models.DateTimeField(auto_now_add=True, db_column="divergencia_criada_em")
    resolvida_em = models.DateTimeField(null=True, blank=True, db_column="divergencia_resolvida_em")

    class Meta:
        ordering = ["criada_em", "id"]
        constraints = [
            models.CheckConstraint(condition=Q(valor_referencia__gte=0), name="divergencia_referencia_nao_negativa"),
            models.CheckConstraint(condition=Q(valor_cobrado__gte=0), name="divergencia_cobrado_nao_negativo"),
            models.CheckConstraint(condition=Q(diferenca=F("valor_cobrado") - F("valor_referencia")), name="divergencia_diferenca_consistente"),
            models.CheckConstraint(
                condition=Q(resolvida_em__isnull=True, empresa_resolvedora__isnull=True) | Q(resolvida_em__isnull=False, empresa_resolvedora__isnull=False),
                name="divergencia_autoria_resolucao",
            ),
            models.CheckConstraint(
                condition=Q(diferenca__gt=5) | Q(diferenca__lt=-5),
                name="divergencia_fora_tolerancia",
            ),
            models.CheckConstraint(
                condition=(
                    Q(resolvida_em__isnull=True, tipo_resolucao="", justificativa="", documento_correcao__isnull=True)
                ) | (
                    Q(resolvida_em__isnull=False, tipo_resolucao="aceite_justificado", documento_correcao__isnull=True)
                    & ~Q(justificativa="")
                ) | (
                    Q(resolvida_em__isnull=False, tipo_resolucao="cte_corrigido", documento_correcao__isnull=False)
                ),
                name="divergencia_resolucao_consistente",
            ),
            models.CheckConstraint(
                condition=Q(documento_correcao__isnull=True) | ~Q(documento_correcao=F("documento")),
                name="divergencia_correcao_distinta",
            ),
        ]

    def clean(self):
        super().clean()
        erros = {}
        if self.valor_referencia is not None and self.valor_cobrado is not None:
            try:
                conferencia = ConferenciaFrete(self.valor_referencia, self.valor_cobrado)
            except ErroRegraNegocio as erro:
                erros.update(erro.detalhes)
            else:
                if not conferencia.divergente:
                    erros["valor_cobrado"] = "Uma divergência exige diferença absoluta superior a R$ 5,00."
                if self.diferenca != conferencia.diferenca:
                    erros["diferenca"] = "A diferença deve preservar a cobrança menos a referência."

        if self.resolvida_em is None:
            if self.empresa_resolvedora_id is not None or self.tipo_resolucao or self.justificativa or self.documento_correcao_id:
                erros["tipo_resolucao"] = "Uma divergência aberta não pode conter dados de resolução."
        else:
            if self.empresa_resolvedora_id is None:
                erros["empresa_resolvedora"] = "Identifique a empresa que resolveu a divergência."
            if self.tipo_resolucao == self.TipoResolucao.ACEITE_JUSTIFICADO:
                if not (self.justificativa or "").strip():
                    erros["justificativa"] = "Justifique o aceite da diferença."
                if self.documento_correcao_id is not None:
                    erros["documento_correcao"] = "Um aceite preserva o CT-e original sem indicar correção."
            elif self.tipo_resolucao == self.TipoResolucao.CTE_CORRIGIDO:
                if self.documento_correcao_id is None:
                    erros["documento_correcao"] = "Informe a nova versão do CT-e que substitui a cobrança."
            else:
                erros["tipo_resolucao"] = "Informe aceite justificado ou CT-e corrigido."

        if self.documento_id:
            try:
                documento = self.documento
            except DocumentoCTe.DoesNotExist:
                erros["documento"] = "CT-e não encontrado."
            else:
                if documento.frete_id != self.frete_id:
                    erros["documento"] = "O CT-e deve pertencer ao mesmo frete da divergência."
                if documento.valor != self.valor_cobrado:
                    erros["valor_cobrado"] = "A cobrança deve preservar o valor do CT-e original."
                if self.documento_correcao_id:
                    try:
                        correcao = self.documento_correcao
                    except DocumentoCTe.DoesNotExist:
                        erros["documento_correcao"] = "CT-e corrigido não encontrado."
                    else:
                        if (
                            correcao.pk == documento.pk
                            or correcao.frete_id != self.frete_id
                            or correcao.versao <= documento.versao
                        ):
                            erros["documento_correcao"] = "A correção deve ser uma versão posterior do CT-e do mesmo frete."
        if erros:
            raise ValidationError(erros)

    def preparar_divergencia_da_correcao(self):
        """Prepara o novo snapshot sem gravar ou alterar o CT-e anterior.

        O serviço deverá persistir substituição, documento, eventual nova
        divergência e histórico na mesma transação. A referência é a original.
        """
        self.clean()
        if self.tipo_resolucao != self.TipoResolucao.CTE_CORRIGIDO:
            raise ValidationError({"tipo_resolucao": "Esta operação exige resolução por CT-e corrigido."})
        conferencia = ConferenciaFrete(self.valor_referencia, self.documento_correcao.valor)
        if not conferencia.divergente:
            return None
        return DivergenciaFrete(
            frete_id=self.frete_id,
            documento=self.documento_correcao,
            valor_referencia=conferencia.valor_referencia,
            valor_cobrado=conferencia.valor_cobrado,
            diferenca=conferencia.diferenca,
        )


class ConfirmacaoEntrega(RegistroImutavel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_confirmacao_entrega")
    frete = models.OneToOneField(Frete, on_delete=models.PROTECT, related_name="entrega", db_column="entrega_frete_id")
    empresa_confirmadora = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT, related_name="entregas_confirmadas", db_column="entrega_empresa_confirmadora_id")
    nome_recebedor = models.CharField(max_length=120, db_column="entrega_recebedor_nome")
    dados_assinatura = models.TextField(db_column="entrega_assinatura_imagem")
    tipo_recebimento = models.CharField(max_length=16, choices=(("completo", "Completo"), ("com_ressalva", "Com ressalva")), db_column="entrega_tipo_recebimento")
    ressalva = models.CharField(max_length=1000, blank=True, default="", db_column="entrega_ressalva")
    confirmado_em = models.DateTimeField(auto_now_add=True, db_column="entrega_confirmada_em")

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(tipo_recebimento__in=("completo", "com_ressalva")), name="entrega_tipo_valido"),
            models.CheckConstraint(condition=~Q(tipo_recebimento="com_ressalva") | ~Q(ressalva=""), name="entrega_ressalva_informada"),
        ]


class HistoricoFrete(RegistroImutavel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_historico_frete")
    frete = models.ForeignKey(Frete, on_delete=models.PROTECT, related_name="historico", db_column="historico_frete_id")
    autora = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT, related_name="eventos_frete", db_column="historico_empresa_autora_id")
    acao = models.CharField(max_length=40, db_column="historico_acao")
    situacao_anterior = models.CharField(max_length=30, blank=True, default="", db_column="historico_situacao_anterior")
    situacao_nova = models.CharField(max_length=30, db_column="historico_situacao_nova")
    chave_idempotencia = models.CharField(max_length=128, db_column="historico_chave_idempotencia")
    resumo_dados = models.CharField(max_length=64, db_column="historico_resumo_dados")
    detalhes = models.JSONField(default=dict, db_column="historico_detalhes")
    criado_em = models.DateTimeField(auto_now_add=True, db_column="historico_criado_em")

    class Meta:
        ordering = ["criado_em", "id"]
        constraints = [
            models.UniqueConstraint(fields=["autora", "acao", "chave_idempotencia"], name="historico_comando_idempotente"),
        ]


class DemandaTransporte(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_demanda_transporte")
    frete = models.ForeignKey(Frete, on_delete=models.PROTECT, related_name="demandas", db_column="demanda_frete_id")
    valor_sugerido = models.DecimalField(max_digits=12, decimal_places=2, db_column="demanda_valor_sugerido")
    janela_coleta = models.CharField(max_length=120, db_column="demanda_janela_coleta")
    tipo_veiculo = models.CharField(max_length=120, db_column="demanda_tipo_veiculo")
    observacoes = models.CharField(max_length=1000, blank=True, default="", db_column="demanda_observacoes")
    publicada_em = models.DateTimeField(auto_now_add=True, db_column="demanda_publicada_em")

    class Meta:
        ordering = ["-publicada_em", "-id"]
        constraints = [models.CheckConstraint(condition=Q(valor_sugerido__gte=0), name="demanda_valor_nao_negativo")]
