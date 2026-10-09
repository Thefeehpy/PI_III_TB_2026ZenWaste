import hashlib
import hmac
import secrets
import unicodedata

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def gerar_token_entrega():
    return secrets.token_urlsafe(32)


def somente_digitos(value):
    return "".join(character for character in str(value or "") if character.isdigit())


def normalizar_nome(value):
    normalized = unicodedata.normalize("NFKD", str(value or "").strip().casefold())
    without_accents = "".join(character for character in normalized if not unicodedata.combining(character))
    return " ".join(without_accents.split())


class ProcessoFrete(models.Model):
    class Status(models.TextChoices):
        AGUARDANDO_COTACAO = "awaiting_quote", "Aguardando cotação"
        EM_COTACAO = "quoting", "Em cotação"
        AGUARDANDO_DOCUMENTO = "awaiting_document", "Aguardando documento"
        EM_TRANSPORTE = "transport", "Em transporte"
        DIVERGENTE = "divergent", "Divergente"
        ENTREGUE = "delivered", "Entregue"
        CANCELADO = "cancelled", "Cancelado"

    class Origem(models.TextChoices):
        ERP = "erp", "ERP"
        MANUAL = "manual", "Manual"
        MARKETPLACE = "marketplace", "Marketplace"

    class Modalidade(models.TextChoices):
        COTACAO = "quote", "Cotação"
        CONTRATADO = "contracted", "Transportadora contratada"
        RETIRADA_CLIENTE = "customer_pickup", "Retirada pelo cliente"

    id_processo_frete = models.BigAutoField(primary_key=True)
    empresa_solicitante = models.ForeignKey(
        "empresas.Empresa", on_delete=models.CASCADE, related_name="processos_frete"
    )
    anuncio = models.ForeignKey(
        "anuncios.Anuncio", on_delete=models.SET_NULL, related_name="processos_frete", null=True, blank=True
    )
    numero_pedido = models.CharField(max_length=50, unique=True)
    cliente = models.CharField(max_length=150)
    material = models.CharField(max_length=120)
    origem = models.CharField(max_length=180)
    destino = models.CharField(max_length=180)
    cubagem_m3 = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    peso_ton = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    data_pedido = models.DateField(default=timezone.localdate)
    previsao_entrega = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.AGUARDANDO_COTACAO)
    fonte = models.CharField(max_length=15, choices=Origem.choices, default=Origem.MANUAL)
    modalidade = models.CharField(max_length=20, choices=Modalidade.choices, default=Modalidade.COTACAO)
    motivo_sem_cotacao = models.CharField(max_length=300, blank=True)
    quantidade_embalagens = models.PositiveIntegerField(default=0)
    dimensoes_caixa_cm = models.JSONField(default=dict, blank=True)
    arquivo_nfe = models.CharField(max_length=255, blank=True)
    registro_coleta = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Frete {self.numero_pedido}"

    def atualizar_status(self, status):
        if status not in self.Status.values:
            raise ValidationError("Status de frete inválido.")
        self.status = status
        self.save(update_fields=["status", "atualizado_em"])
        return True


class OportunidadeFrete(models.Model):
    class Status(models.TextChoices):
        ABERTA = "open", "Aberta"
        COM_PROPOSTAS = "sent", "Com propostas"
        RECOMENDADA = "recommended", "Recomendada"
        ENCERRADA = "closed", "Encerrada"
        CANCELADA = "cancelled", "Cancelada"

    id_oportunidade = models.BigAutoField(primary_key=True)
    processo = models.OneToOneField(ProcessoFrete, on_delete=models.CASCADE, related_name="oportunidade")
    valor_sugerido = models.DecimalField(max_digits=12, decimal_places=2)
    janela_coleta = models.CharField(max_length=180)
    tipo_veiculo = models.CharField(max_length=100)
    observacoes = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ABERTA)
    score_ambiental = models.PositiveSmallIntegerField(default=0)
    publicada_em = models.DateTimeField(auto_now_add=True)
    encerrada_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-publicada_em"]

    def cancelar(self):
        if self.status in (self.Status.ENCERRADA, self.Status.CANCELADA):
            return False
        self.status = self.Status.CANCELADA
        self.encerrada_em = timezone.now()
        self.save(update_fields=["status", "encerrada_em"])
        return True


class PropostaFrete(models.Model):
    class Status(models.TextChoices):
        ENVIADA = "sent", "Enviada"
        APROVADA = "approved", "Aprovada"
        RECUSADA = "rejected", "Recusada"
        CANCELADA = "cancelled", "Cancelada"

    id_proposta = models.BigAutoField(primary_key=True)
    oportunidade = models.ForeignKey(OportunidadeFrete, on_delete=models.CASCADE, related_name="propostas")
    transportadora = models.ForeignKey(
        "transportes.Transportadora", on_delete=models.CASCADE, related_name="propostas_frete"
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    prazo_entrega_dias = models.PositiveIntegerField(default=1)
    observacao = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ENVIADA)
    enviada_em = models.DateTimeField(auto_now_add=True)
    respondida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["valor", "prazo_entrega_dias"]
        constraints = [
            models.UniqueConstraint(fields=["oportunidade", "transportadora"], name="unique_carrier_freight_bid")
        ]


class DocumentoFrete(models.Model):
    id_documento = models.BigAutoField(primary_key=True)
    processo = models.OneToOneField(ProcessoFrete, on_delete=models.CASCADE, related_name="documento")
    nome_arquivo = models.CharField(max_length=255)
    numero_cte = models.CharField(max_length=80, unique=True)
    valor_cte = models.DecimalField(max_digits=12, decimal_places=2)
    recebido_em = models.DateTimeField(auto_now_add=True)


class HistoricoFrete(models.Model):
    id_historico = models.BigAutoField(primary_key=True)
    processo = models.ForeignKey(ProcessoFrete, on_delete=models.CASCADE, related_name="historico")
    autor = models.CharField(max_length=150)
    evento = models.CharField(max_length=80, default="observacao")
    observacao = models.CharField(max_length=1000)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]


class Entrega(models.Model):
    class Status(models.TextChoices):
        PENDENTE = "pending", "Aguardando saída"
        EM_ROTA = "route", "Em rota"
        ENTREGUE = "delivered", "Entregue"
        CANCELADA = "cancelled", "Cancelada"

    class TipoRecebimento(models.TextChoices):
        COMPLETO = "complete", "Completo"
        COM_RESSALVA = "with_reservation", "Com ressalva"

    id_entrega = models.BigAutoField(primary_key=True)
    processo = models.OneToOneField(ProcessoFrete, on_delete=models.CASCADE, related_name="entrega")
    transportadora = models.ForeignKey(
        "transportes.Transportadora", on_delete=models.PROTECT, related_name="entregas"
    )
    motorista = models.ForeignKey(
        "transportes.Motorista", on_delete=models.SET_NULL, related_name="entregas", null=True, blank=True
    )
    caminhao = models.ForeignKey(
        "transportes.Caminhao", on_delete=models.SET_NULL, related_name="entregas", null=True, blank=True
    )
    endereco = models.CharField(max_length=250)
    cidade = models.CharField(max_length=120)
    previsao = models.DateTimeField(null=True, blank=True)
    numero_nfe = models.CharField(max_length=80, blank=True)
    token_qr = models.CharField(max_length=64, unique=True, default=gerar_token_entrega, editable=False)
    nome_recebedor_autorizado = models.CharField(max_length=150)
    cpf_recebedor_autorizado = models.CharField(max_length=14)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDENTE)
    nome_recebedor = models.CharField(max_length=150, blank=True)
    cpf_recebedor = models.CharField(max_length=14, blank=True)
    assinatura = models.TextField(blank=True)
    tipo_recebimento = models.CharField(
        max_length=20, choices=TipoRecebimento.choices, default=TipoRecebimento.COMPLETO
    )
    ressalva = models.CharField(max_length=1000, blank=True)
    confirmada_em = models.DateTimeField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["previsao", "id_entrega"]

    def validar_token(self, token):
        return hmac.compare_digest(self.token_qr, str(token or ""))

    def validar_identidade(self, nome, cpf):
        nome_esperado = hashlib.sha256(normalizar_nome(self.nome_recebedor_autorizado).encode()).digest()
        nome_recebido = hashlib.sha256(normalizar_nome(nome).encode()).digest()
        cpf_esperado = hashlib.sha256(somente_digitos(self.cpf_recebedor_autorizado).encode()).digest()
        cpf_recebido = hashlib.sha256(somente_digitos(cpf).encode()).digest()
        return hmac.compare_digest(nome_esperado, nome_recebido) and hmac.compare_digest(cpf_esperado, cpf_recebido)

    def iniciar_rota(self):
        if self.status != self.Status.PENDENTE:
            return False
        self.status = self.Status.EM_ROTA
        self.processo.status = ProcessoFrete.Status.EM_TRANSPORTE
        self.processo.save(update_fields=["status", "atualizado_em"])
        self.save(update_fields=["status"])
        return True

    def confirmar_recebimento(self, *, nome, cpf, assinatura, tipo_recebimento, ressalva=""):
        if self.status not in (self.Status.PENDENTE, self.Status.EM_ROTA) or not assinatura:
            return False
        if not self.validar_identidade(nome, cpf):
            raise ValidationError("Nome ou CPF não conferem com o recebedor autorizado.")
        if tipo_recebimento == self.TipoRecebimento.COM_RESSALVA and not str(ressalva).strip():
            raise ValidationError("Descreva a ressalva do recebimento.")
        self.nome_recebedor = str(nome).strip()
        self.cpf_recebedor = str(cpf).strip()
        self.assinatura = assinatura
        self.tipo_recebimento = tipo_recebimento
        self.ressalva = str(ressalva).strip()
        self.status = self.Status.ENTREGUE
        self.confirmada_em = timezone.now()
        self.processo.status = ProcessoFrete.Status.ENTREGUE
        self.processo.save(update_fields=["status", "atualizado_em"])
        self.save()
        return True
