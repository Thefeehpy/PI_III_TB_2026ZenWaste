"""Catálogo, preparação MTR e despacho controlado de homologação do produto."""

from django.core.exceptions import ValidationError
from django.db import models
from django.conf import settings
import uuid

from mtr.validacoes import validar_codigo_ibama


class VersaoCatalogoIBAMA(models.Model):
    id_versao_catalogo_ibama = models.BigAutoField(primary_key=True)
    fonte = models.CharField(max_length=80)
    versao = models.CharField(max_length=80)
    referencia_fonte = models.CharField(max_length=500)
    sha256_arquivo = models.CharField(max_length=64)
    simulado = models.BooleanField(default=True)
    vigente = models.BooleanField(default=True)
    importado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["fonte", "versao", "simulado"], name="mtr_catalogo_fonte_versao_unica"),
            models.CheckConstraint(condition=~models.Q(fonte="") & ~models.Q(versao="") & ~models.Q(referencia_fonte=""), name="mtr_catalogo_origem_preenchida"),
            models.CheckConstraint(condition=models.Q(sha256_arquivo__regex=r"^[0-9a-f]{64}$"), name="mtr_catalogo_hash_valido"),
        ]


class CodigoResiduoIBAMA(models.Model):
    id_codigo_residuo_ibama = models.BigAutoField(primary_key=True)
    catalogo = models.ForeignKey(VersaoCatalogoIBAMA, on_delete=models.PROTECT, related_name="codigos")
    codigo = models.CharField(max_length=9)
    codigo_busca = models.CharField(max_length=7)
    descricao = models.CharField(max_length=1000)
    perigoso = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["codigo", "id_codigo_residuo_ibama"]
        constraints = [
            models.UniqueConstraint(fields=["catalogo", "codigo_busca"], name="mtr_codigo_unico_por_catalogo"),
            models.CheckConstraint(condition=models.Q(codigo__regex=r"^[0-9]{6}(\*|\(\*\))?$"), name="mtr_codigo_formato_valido"),
            models.CheckConstraint(condition=~models.Q(descricao=""), name="mtr_codigo_descricao_preenchida"),
        ]
        indexes = [models.Index(fields=["codigo_busca"], name="mtr_codigo_busca_idx")]

    def clean(self):
        super().clean()
        try:
            normalizado = validar_codigo_ibama(self.codigo)
        except ValueError as erro:
            raise ValidationError({"codigo": str(erro)}) from erro
        if self.codigo_busca != normalizado:
            raise ValidationError({"codigo_busca": "Chave de pesquisa inconsistente com o código preservado."})
        if "*" in self.codigo and self.perigoso is not True:
            raise ValidationError({"perigoso": "Marcador de perigo exige a indicação correspondente da fonte."})


class OperadorMTR(models.Model):
    """Identidade individual local; não comprova habilitação SIGOR por si só."""
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    empresa = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT)
    ativo = models.BooleanField(default=True)
    pode_revisar = models.BooleanField(default=False)
    pode_autorizar = models.BooleanField(default=False)
    verificado_homologacao = models.BooleanField(default=False)
    evidencia = models.CharField(max_length=500, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['usuario', 'empresa'], name='mtr_operador_empresa_unico')]


class RascunhoMTR(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT)
    frete = models.OneToOneField("fretes.Frete", on_delete=models.PROTECT, related_name='rascunho_mtr', null=True, blank=True)
    versao = models.PositiveIntegerField(default=1)
    estado = models.CharField(max_length=30, default='RASCUNHO')
    ambiente = models.CharField(max_length=20, default='MOCK', editable=False)
    dados = models.JSONField(default=dict)
    contexto = models.JSONField(default=dict)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(versao__gte=1), name='mtr_rascunho_versao_positiva'),
            models.CheckConstraint(condition=(models.Q(ambiente='MOCK',frete__isnull=False) | models.Q(ambiente='HOMOLOGACAO',frete__isnull=True)), name='mtr_origem_ambiente_coerentes'),
            models.CheckConstraint(condition=models.Q(estado__in=['RASCUNHO','APROVADO','PREPARADA','CONFIRMADA_SIMULADA','REJEITADA_SIMULADA','INDETERMINADA']), name='mtr_rascunho_estado_valido'),
        ]


class ConsultaImutavelMTR(models.QuerySet):
    def update(self, **kwargs): raise ValidationError('Registro histórico MTR é imutável.')
    def delete(self): raise ValidationError('Registro histórico MTR não pode ser excluído.')


class RegistroImutavelMTR(models.Model):
    objects = ConsultaImutavelMTR.as_manager()
    class Meta:
        abstract = True
    def save(self, *args, **kwargs):
        if not self._state.adding: raise ValidationError('Registro histórico MTR é imutável.')
        return super().save(*args, **kwargs)
    def delete(self, *args, **kwargs): raise ValidationError('Registro histórico MTR não pode ser excluído.')


class RevisaoMTR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rascunho = models.ForeignKey(RascunhoMTR, on_delete=models.PROTECT, related_name='revisoes')
    versao = models.PositiveIntegerField()
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    snapshot = models.JSONField()
    resumo = models.CharField(max_length=64)
    criada_em = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['rascunho','versao'], name='mtr_revisao_versao_unica')]


class IntencaoMTR(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revisao = models.OneToOneField(RevisaoMTR, on_delete=models.PROTECT, related_name='intencao')
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    referencia = models.CharField(max_length=30, unique=True)
    payload = models.JSONField()
    resumo = models.CharField(max_length=64)
    estado = models.CharField(max_length=30, default='PREPARADA')
    cenario = models.CharField(max_length=20, default='sucesso')
    quantidade_envios = models.PositiveSmallIntegerField(default=0)
    resultado = models.JSONField(default=dict)
    autorizada_em = models.DateTimeField(auto_now_add=True)
    enviada_em = models.DateTimeField(null=True)
    atualizada_em = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantidade_envios__lte=1), name='mtr_intencao_um_envio'),
            models.CheckConstraint(condition=models.Q(estado__in=['PREPARADA','EM_ENVIO','CONFIRMADA_SIMULADA','REJEITADA_SIMULADA','INDETERMINADA']), name='mtr_intencao_estado_valido'),
            models.CheckConstraint(condition=models.Q(cenario__in=['sucesso','rejeicao','timeout']), name='mtr_cenario_mock_valido'),
        ]


class EventoMTR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rascunho = models.ForeignKey(RascunhoMTR, on_delete=models.PROTECT, related_name='eventos')
    operador = models.ForeignKey(OperadorMTR, null=True, on_delete=models.PROTECT)
    acao = models.CharField(max_length=40)
    detalhes = models.JSONField(default=dict)
    criado_em = models.DateTimeField(auto_now_add=True)


class ReciboMTR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT)
    chave = models.UUIDField()
    operacao = models.CharField(max_length=150)
    resumo = models.CharField(max_length=64)
    resposta = models.JSONField()
    status_http = models.PositiveSmallIntegerField()
    criado_em = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['empresa','chave'], name='mtr_recibo_chave_empresa_unica')]


class VinculoAmbientalSIGOR(RegistroImutavelMTR):
    """Declaracao individual com evidencia; autenticacao nao cria habilitacao."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.PROTECT)
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    papel = models.CharField(max_length=15)
    cpf_cnpj = models.CharField(max_length=14)
    unidade = models.PositiveIntegerField()
    simulado = models.BooleanField(default=False)
    evidencia_sha256 = models.CharField(max_length=64)
    valido_ate = models.DateTimeField(null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(papel__in=['GERADOR','TRANSPORTADOR','DESTINADOR']), name='mtr_sig_papel_valido'),
            models.CheckConstraint(condition=models.Q(unidade__gt=0), name='mtr_sig_unidade_positiva'),
            models.CheckConstraint(condition=models.Q(cpf_cnpj__regex=r'^[0-9]{11}([0-9]{3})?$'), name='mtr_sig_documento_formato'),
            models.CheckConstraint(condition=models.Q(evidencia_sha256__regex=r'^[0-9a-f]{64}$'), name='mtr_sig_evidencia_hash'),
        ]


class RevogacaoVinculoSIGOR(RegistroImutavelMTR):
    vinculo = models.OneToOneField(VinculoAmbientalSIGOR, on_delete=models.PROTECT, primary_key=True, related_name='revogacao')
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    criada_em = models.DateTimeField(auto_now_add=True)


class CapturaCatalogoSIGOR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey('empresas.Empresa', on_delete=models.PROTECT)
    operacao = models.CharField(max_length=40)
    parametro = models.CharField(max_length=80, blank=True)
    metodo_http = models.CharField(max_length=4, null=True)
    origem = models.CharField(max_length=30)
    simulado = models.BooleanField(default=True)
    itens = models.JSONField()
    resumo = models.CharField(max_length=64)
    fonte_sha256 = models.CharField(max_length=64)
    versao_oficial = models.CharField(max_length=100, null=True)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(metodo_http__isnull=True) | models.Q(metodo_http__in=['GET','POST']), name='mtr_sig_metodo_catalogo'),
            models.CheckConstraint(condition=models.Q(origem__in=['SIMULACAO','RESPOSTA_API','OPERADOR_REFERENCIA']), name='mtr_sig_fonte_catalogo'),
            models.CheckConstraint(condition=models.Q(simulado=True) | ~models.Q(origem='SIMULACAO'), name='mtr_sig_fonte_nao_promovida'),
        ]


class RevisaoAmbientalSIGOR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rascunho = models.ForeignKey(RascunhoMTR, on_delete=models.PROTECT)
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    snapshot = models.JSONField()
    resumo = models.CharField(max_length=64)
    criada_em = models.DateTimeField(auto_now_add=True)


class DespachoSIGOR(models.Model):
    """Unico por rascunho; nenhuma revisao alternativa contorna uma tentativa incerta."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rascunho = models.OneToOneField(RascunhoMTR, on_delete=models.PROTECT)
    revisao = models.OneToOneField(RevisaoAmbientalSIGOR, on_delete=models.PROTECT)
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    referencia = models.CharField(max_length=30, unique=True)
    payload_wire = models.TextField()
    resumo = models.CharField(max_length=64)
    simulado = models.BooleanField(default=True)
    estado = models.CharField(max_length=25, default='PREPARADA')
    tentativas = models.PositiveSmallIntegerField(default=0)
    trabalhador = models.UUIDField(null=True)
    iniciada_em = models.DateTimeField(null=True)
    limite_trabalhador = models.DateTimeField(null=True)
    resultado = models.JSONField(default=dict)
    criada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(tentativas__lte=1), name='mtr_sig_tentativa_unica'),
            models.CheckConstraint(condition=models.Q(estado__in=['PREPARADA','EM_DESPACHO','INDETERMINADA','CONFIRMADA','REJEITADA']), name='mtr_sig_estado_valido'),
            models.CheckConstraint(condition=(models.Q(estado='PREPARADA',tentativas=0,trabalhador__isnull=True,iniciada_em__isnull=True,limite_trabalhador__isnull=True) | (~models.Q(estado='PREPARADA') & models.Q(tentativas=1,trabalhador__isnull=False,iniciada_em__isnull=False,limite_trabalhador__isnull=False))), name='mtr_sig_estado_tentativa_coerente'),
        ]
        indexes = [models.Index(fields=['estado','limite_trabalhador'], name='mtr_sig_recuperacao_idx')]


class EventoDespachoSIGOR(RegistroImutavelMTR):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    despacho = models.ForeignKey(DespachoSIGOR, on_delete=models.PROTECT, related_name='eventos')
    acao = models.CharField(max_length=40)
    detalhes = models.JSONField(default=dict)
    criado_em = models.DateTimeField(auto_now_add=True)


class SolicitacaoEmissaoSIGOR(RegistroImutavelMTR):
    """Solicitação por intenção/hash; não é concessão ou autorização governamental."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    despacho = models.OneToOneField(DespachoSIGOR, on_delete=models.PROTECT)
    operador = models.ForeignKey(OperadorMTR, on_delete=models.PROTECT)
    escopo = models.JSONField()
    resumo = models.CharField(max_length=64)
    criada_em = models.DateTimeField(auto_now_add=True)


class ConcessaoEmissaoSIGOR(RegistroImutavelMTR):
    """Somente autoridade de servidor API10 pode registrar; sem endpoint de autoaprovação."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitacao = models.OneToOneField(SolicitacaoEmissaoSIGOR, on_delete=models.PROTECT)
    escopo = models.JSONField()
    assinatura_sha256 = models.CharField(max_length=64)
    autoridade_referencia = models.CharField(max_length=120)
    valida_desde = models.DateTimeField()
    valida_ate = models.DateTimeField()
    criada_em = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(valida_ate__gt=models.F('valida_desde')), name='mtr_concessao_janela_valida')]
