from django.core.exceptions import ValidationError
from django.db import models


class Anuncio(models.Model):
    class Situacao(models.TextChoices):
        ATIVO = "ativo", "Ativo"
        INATIVO = "inativo", "Inativo"
        VENDIDO = "vendido", "Vendido"

    id_anuncio = models.AutoField(primary_key=True)
    produto = models.ForeignKey(
        "produtos.Produto", on_delete=models.PROTECT, related_name="anuncios",
        db_column="produto_id",
    )
    preco_final = models.DecimalField(max_digits=12, decimal_places=2, db_column="preco_unitario")
    preco_sugerido_ia = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        db_column="preco_unitario_sugerido_ia",
    )
    situacao_anuncio = models.CharField(
        max_length=20, choices=Situacao.choices, default=Situacao.ATIVO,
        db_column="situacao",
    )
    data_publicacao = models.DateTimeField(auto_now_add=True, db_column="publicado_em")
    descricao_especifica = models.CharField(max_length=500, blank=True, db_column="descricao")
    nr_qtd = models.DecimalField(max_digits=12, decimal_places=3, db_column="quantidade_ofertada")
    data_final = models.DateField(null=True, blank=True, db_column="data_limite")
    localizacao = models.CharField(max_length=120, blank=True, db_column="localizacao")

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(preco_final__gte=0), name="anuncio_preco_nao_negativo"),
            models.CheckConstraint(condition=models.Q(nr_qtd__gte=0), name="anuncio_quantidade_nao_negativa"),
            models.CheckConstraint(
                condition=~models.Q(situacao_anuncio="ativo") | models.Q(nr_qtd__gt=0),
                name="anuncio_ativo_com_quantidade",
            ),
            models.CheckConstraint(
                condition=models.Q(preco_sugerido_ia__isnull=True) | models.Q(preco_sugerido_ia__gte=0),
                name="anuncio_sugestao_nao_negativa",
            ),
        ]

    @property
    def imagem_url(self):
        """Projecao de compatibilidade; as imagens pertencem a ImagemAnuncio."""
        imagens = list(self.imagens.all())
        imagens.sort(key=lambda imagem: (not imagem.eh_capa, imagem.ordem, imagem.pk or 0))
        return imagens[0].url_arquivo if imagens else ""

    def __str__(self):
        return str(self.id_anuncio)


class ImagemAnuncio(models.Model):
    id_imagem_anuncio = models.AutoField(primary_key=True)
    anuncio = models.ForeignKey(
        Anuncio, on_delete=models.CASCADE, related_name="imagens", db_column="anuncio_id",
    )
    url_arquivo = models.TextField(db_column="url_arquivo")
    eh_capa = models.BooleanField(default=False, db_column="eh_capa")
    ordem = models.PositiveIntegerField(default=0, db_column="ordem")

    class Meta:
        ordering = ["ordem", "id_imagem_anuncio"]
        constraints = [
            models.UniqueConstraint(fields=["anuncio"], condition=models.Q(eh_capa=True), name="imagem_uma_capa_por_anuncio"),
            models.UniqueConstraint(fields=["anuncio", "ordem"], name="imagem_ordem_unica_por_anuncio"),
        ]


class Reserva(models.Model):
    class Modalidade(models.TextChoices):
        CAPTACAO = "captacao", "Captacao de material"
        COMPROMISSO = "compromisso", "Compromisso de estoque"

    SITUACOES = (
        ("em_captacao", "Em captacao"), ("pronta", "Pronta"),
        ("finalizada", "Finalizada"), ("cancelada", "Cancelada"),
        ("expirada", "Expirada"),
    )
    id_reserva = models.AutoField(primary_key=True)
    produto = models.ForeignKey(
        "produtos.Produto", on_delete=models.PROTECT, related_name="reservas", db_column="produto_id",
    )
    empresa_compradora = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="reservas_compradas",
        null=True, blank=True, db_column="empresa_compradora_id",
    )
    pedido = models.OneToOneField(
        "pedidos.Pedido", on_delete=models.PROTECT, related_name="reserva",
        null=True, blank=True, db_column="pedido_id",
    )
    modalidade = models.CharField(
        max_length=16, choices=Modalidade.choices, default=Modalidade.CAPTACAO,
        db_column="modalidade",
    )
    quantidade_reservada = models.DecimalField(max_digits=12, decimal_places=3, db_column="quantidade_comprometida")
    preco_unitario = models.DecimalField(max_digits=12, decimal_places=2, db_column="preco_unitario_acordado")
    situacao = models.CharField(max_length=20, choices=SITUACOES, default="em_captacao", db_column="situacao")
    observacao = models.CharField(max_length=500, blank=True, db_column="observacao")
    prazo_reserva = models.DateField(null=True, blank=True, db_column="data_limite")
    data_reserva = models.DateTimeField(auto_now_add=True, db_column="criada_em")
    data_finalizacao = models.DateTimeField(null=True, blank=True, db_column="encerrada_em")
    nome_comprador = models.CharField(max_length=120, db_column="contato_nome")
    numero_comprador = models.CharField(max_length=20, db_column="contato_telefone")

    class Meta:
        ordering = ["-data_reserva"]
        constraints = [
            models.CheckConstraint(condition=models.Q(quantidade_reservada__gt=0), name="reserva_quantidade_positiva"),
            models.CheckConstraint(condition=models.Q(preco_unitario__gte=0), name="reserva_preco_nao_negativo"),
            models.CheckConstraint(
                condition=~models.Q(modalidade="compromisso") | models.Q(empresa_compradora__isnull=False),
                name="reserva_compromisso_com_compradora",
            ),
        ]

    def clean(self):
        super().clean()
        if self.pedido_id:
            if self.produto_id != self.pedido.anuncio.produto_id:
                raise ValidationError({"produto": "O produto deve corresponder ao anuncio do pedido."})
            if self.empresa_compradora_id != self.pedido.empresa_compradora_id:
                raise ValidationError({"empresa_compradora": "A compradora deve corresponder ao pedido."})

    def __str__(self):
        return f"Reserva {self.id_reserva} - {self.produto}"
