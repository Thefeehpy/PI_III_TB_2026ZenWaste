from django.db import models
from django.db.models.functions import Lower

from empresas.models import Empresa


class CategoriaResiduo(models.Model):
    id_categoria = models.AutoField(primary_key=True)
    nome_material = models.CharField(max_length=50, db_column="categoria_nome_material")
    descricao = models.CharField(max_length=255, blank=True, db_column="categoria_descricao")
    ativo = models.BooleanField(default=True, db_column="categoria_ativa")

    class Meta:
        ordering = ["nome_material"]
        constraints = [models.UniqueConstraint(Lower("nome_material"), name="categoria_nome_unico_ci")]

    def __str__(self):
        return self.nome_material


class UnidadeMedida(models.Model):
    id_unidade = models.AutoField(primary_key=True)
    sigla = models.CharField(max_length=12, db_column="unidade_sigla")
    descricao = models.CharField(max_length=100, db_column="unidade_descricao")
    ativo = models.BooleanField(default=True, db_column="unidade_ativa")

    class Meta:
        ordering = ["sigla"]
        constraints = [models.UniqueConstraint(Lower("sigla"), name="unidade_sigla_unica_ci")]

    def __str__(self):
        return self.sigla


class Produto(models.Model):
    id_produto = models.AutoField(primary_key=True)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, related_name="produtos", db_column="produto_empresa_id",
    )
    categoria = models.ForeignKey(
        CategoriaResiduo, on_delete=models.PROTECT, related_name="produtos", db_column="produto_categoria_id",
    )
    unidade_medida = models.ForeignKey(
        UnidadeMedida, on_delete=models.PROTECT, related_name="produtos", db_column="produto_unidade_id",
    )
    nome_residuo = models.CharField(max_length=256, db_column="produto_nome_residuo")
    descricao_produto = models.CharField(max_length=256, blank=True, db_column="produto_descricao")
    quantidade = models.DecimalField(max_digits=12, decimal_places=3, db_column="produto_saldo_fisico")
    ativo = models.BooleanField(default=True, db_column="produto_ativo")
    situacao = models.CharField(max_length=20, default="sem_saldo", db_column="produto_situacao")
    data_registro = models.DateField(auto_now_add=True, db_column="produto_cadastrado_em")
    atualizado_em = models.DateTimeField(auto_now=True, db_column="produto_atualizado_em")

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantidade__gte=0), name="produto_saldo_nao_negativo"),
        ]

    @property
    def tipo_produto(self):
        """Compatibilidade de leitura; a categoria e a fonte de verdade."""
        return self.categoria.nome_material

    @property
    def unidade(self):
        return self.unidade_medida.sigla

    def __str__(self):
        return self.nome_residuo

    def atualizar_situacao(self):
        if not self.ativo:
            self.situacao = "inativo"
        else:
            self.situacao = "disponivel" if self.quantidade > 0 else "sem_saldo"


class MovimentacaoEstoque(models.Model):
    class Tipo(models.TextChoices):
        ENTRADA = "entrada", "Entrada"
        SAIDA = "saida", "Saida"

    OPCOES_TIPO = Tipo.choices
    id_movimentacao = models.AutoField(primary_key=True)
    produto = models.ForeignKey(
        Produto, on_delete=models.PROTECT, related_name="movimentacoes", db_column="movimentacao_produto_id",
    )
    tipo = models.CharField(max_length=8, choices=Tipo.choices, db_column="movimentacao_tipo")
    quantidade = models.DecimalField(max_digits=12, decimal_places=3, db_column="movimentacao_quantidade")
    observacao = models.CharField(max_length=255, blank=True, db_column="movimentacao_observacao")
    saldo_resultante = models.DecimalField(max_digits=12, decimal_places=3, db_column="movimentacao_saldo_resultante")
    criado_em = models.DateTimeField(auto_now_add=True, db_column="movimentacao_registrada_em")

    class Meta:
        ordering = ["-criado_em"]
        constraints = [
            models.CheckConstraint(condition=models.Q(quantidade__gt=0), name="movimentacao_quantidade_positiva"),
            models.CheckConstraint(condition=models.Q(saldo_resultante__gte=0), name="movimentacao_saldo_nao_negativo"),
            models.CheckConstraint(condition=models.Q(tipo__in=("entrada", "saida")), name="movimentacao_tipo_valido"),
        ]

    @property
    def empresa(self):
        return self.produto.empresa

    @property
    def empresa_id(self):
        return self.produto.empresa_id

    def __str__(self):
        return f"{self.tipo} - {self.produto}"
