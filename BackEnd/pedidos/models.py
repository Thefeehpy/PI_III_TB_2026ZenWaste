import uuid

from django.db import models

from anuncios.models import Anuncio
from empresas.models import Empresa


class Pedido(models.Model):
    class Situacao(models.TextChoices):
        AGUARDANDO_PAGAMENTO = "awaiting_payment", "Aguardando pagamento"
        PENDENTE = "pending", "Pagamento pendente"
        PAGO = "paid", "Pago"
        FALHOU = "failed", "Falhou"
        CANCELADO = "canceled", "Cancelado"
        EXPIRADO = "expired", "Expirado"

    id = models.UUIDField(db_column="id_pedido", primary_key=True, default=uuid.uuid4, editable=False)
    numero = models.CharField(db_column="numero", max_length=24, unique=True)
    empresa_compradora = models.ForeignKey(
        Empresa, db_column="empresa_compradora_id",
        on_delete=models.PROTECT,
        related_name='pedidos_como_compradora',
    )
    anuncio = models.ForeignKey(
        Anuncio, db_column="anuncio_id",
        on_delete=models.PROTECT,
        related_name='pedidos',
    )
    situacao = models.CharField(db_column="situacao",
        max_length=24,
        choices=Situacao.choices,
        default=Situacao.AGUARDANDO_PAGAMENTO,
        db_index=True,
    )
    metodo = models.CharField(db_column="metodo_pagamento", max_length=12, blank=True)
    parcelas = models.PositiveSmallIntegerField(db_column="parcelas", default=1)
    quantidade = models.DecimalField(db_column="quantidade_negociada", max_digits=12, decimal_places=3)
    preco_unitario = models.DecimalField(db_column="preco_unitario_acordado", max_digits=12, decimal_places=2)
    valor_total = models.DecimalField(db_column="valor_total", max_digits=14, decimal_places=2)
    modalidade_entrega = models.CharField(db_column="modalidade_entrega", max_length=16, default="pickup")
    nome_comprador = models.CharField(db_column="comprador_nome", max_length=120)
    email_comprador = models.EmailField(db_column="comprador_email", max_length=256)
    documento_comprador = models.CharField(db_column="comprador_cnpj", max_length=14)
    telefone_comprador = models.CharField(db_column="comprador_telefone", max_length=20)
    nome_material_negociado = models.CharField(db_column="item_nome_residuo", max_length=256)
    categoria_material_negociado = models.CharField(db_column="item_categoria", max_length=50)
    descricao_material_negociado = models.CharField(db_column="item_descricao", max_length=500, blank=True)
    unidade_material_negociado = models.CharField(db_column="item_unidade", max_length=12)
    imagem_material_negociado = models.TextField(db_column="item_imagem_url", blank=True)
    localizacao_material_negociado = models.CharField(db_column="item_localizacao", max_length=120, blank=True)
    razao_social_vendedora = models.CharField(db_column="vendedor_razao_social", max_length=100)
    chave_idempotencia_criacao = models.CharField(db_column="chave_criacao", max_length=128)
    resumo_dados_criacao = models.CharField(db_column="resumo_dados_criacao", max_length=64)
    reserva_expira_em = models.DateTimeField(db_column="reserva_expira_em", db_index=True)
    cancelamento_solicitado = models.BooleanField(db_column="cancelamento_solicitado", default=False)
    pago_em = models.DateTimeField(db_column="pago_em", null=True, blank=True)
    criado_em = models.DateTimeField(db_column="criado_em", auto_now_add=True)
    atualizado_em = models.DateTimeField(db_column="atualizado_em", auto_now=True)

    class Meta:
        db_table = "pedidos_order"
        ordering = ['-criado_em']
        constraints = [
            models.UniqueConstraint(
                fields=['empresa_compradora', 'chave_idempotencia_criacao'],
                name='pedido_chave_criacao_unica_por_compradora',
            ),
            models.CheckConstraint(
                condition=models.Q(quantidade__gt=0),
                name='pedido_quantidade_positiva',
            ),
            models.CheckConstraint(
                condition=models.Q(valor_total__gt=0),
                name='pedido_total_positivo',
            ),
        ]

    def __str__(self):
        return self.numero


class TentativaPagamento(models.Model):
    class Situacao(models.TextChoices):
        PROCESSANDO = "processing", "Processando"
        PENDENTE = "pending", "Pendente"
        PAGO = "paid", "Pago"
        FALHOU = "failed", "Falhou"
        CANCELADO = "canceled", "Cancelado"
        EXPIRADO = "expired", "Expirado"

    id = models.UUIDField(db_column="id_tentativa_pagamento", primary_key=True, default=uuid.uuid4, editable=False)
    pedido = models.ForeignKey(
        Pedido, db_column="pedido_id", on_delete=models.PROTECT, related_name='pagamentos')
    provedor = models.CharField(db_column="provedor", max_length=40)
    metodo = models.CharField(db_column="metodo", max_length=12)
    situacao = models.CharField(db_column="situacao", max_length=16, choices=Situacao.choices, db_index=True)
    chave_idempotencia = models.CharField(db_column="chave_idempotencia", max_length=128)
    resumo_dados_requisicao = models.CharField(db_column="resumo_dados_requisicao", max_length=64)
    referencia_provedor = models.CharField(db_column="referencia_provedor", max_length=160, blank=True)
    valor_centavos = models.PositiveBigIntegerField(db_column="valor_centavos")
    parcelas = models.PositiveSmallIntegerField(db_column="parcelas", default=1)
    bandeira_cartao = models.CharField(db_column="cartao_bandeira", max_length=32, blank=True)
    final_cartao = models.CharField(db_column="cartao_final", max_length=4, blank=True)
    pix_copia_cola = models.TextField(db_column="pix_copia_cola", blank=True)
    pix_expira_em = models.DateTimeField(db_column="pix_expira_em", null=True, blank=True)
    criado_em = models.DateTimeField(db_column="criado_em", auto_now_add=True)
    atualizado_em = models.DateTimeField(db_column="atualizado_em", auto_now=True)

    class Meta:
        db_table = "pedidos_paymentattempt"
        ordering = ['-criado_em']
        constraints = [
            models.UniqueConstraint(
                fields=['pedido', 'chave_idempotencia'],
                name='pagamento_chave_unica_por_pedido',
            ),
            models.UniqueConstraint(
                fields=['provedor', 'referencia_provedor'],
                condition=~models.Q(referencia_provedor=""),
                name='pagamento_referencia_unica_por_provedor',
            ),
        ]

    def __str__(self):
        return f"{self.pedido.numero} · {self.metodo} · {self.situacao}"


class EventoWebhook(models.Model):
    id = models.BigAutoField(primary_key=True, db_column="id_evento_webhook")
    provedor = models.CharField(db_column="provedor", max_length=40)
    identificador_externo = models.CharField(db_column="identificador_externo", max_length=160)
    pagamento = models.ForeignKey(
        TentativaPagamento, db_column="pagamento_id",
        on_delete=models.PROTECT,
        related_name='eventos_webhook',
        null=True,
        blank=True,
    )
    processado = models.BooleanField(db_column="processado", default=False)
    recebido_em = models.DateTimeField(db_column="recebido_em", auto_now_add=True)

    class Meta:
        db_table = "pedidos_webhookevent"
        constraints = [
            models.UniqueConstraint(
                fields=['provedor', 'identificador_externo'],
                name='webhook_evento_unico_por_provedor',
            ),
        ]

    def __str__(self):
        return f"{self.provedor}:{self.identificador_externo}"
