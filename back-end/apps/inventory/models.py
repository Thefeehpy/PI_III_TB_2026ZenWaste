from decimal import Decimal

from django.db import models

from apps.accounts.models import Empresa


class CategoriaResiduo(models.Model):
    id_categoria = models.AutoField(primary_key=True)
    nome_material = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = "CATEGORIA_RESIDUO"
        ordering = ["nome_material"]

    def __str__(self) -> str:
        return self.nome_material


class UnidadeMedida(models.Model):
    id_unidade = models.AutoField(primary_key=True)
    sigla_unidade = models.CharField(max_length=10, unique=True)
    descricao_unidade = models.CharField(max_length=10)

    class Meta:
        db_table = "UNIDADE_MEDIDA"
        ordering = ["sigla_unidade"]

    def __str__(self) -> str:
        return self.sigla_unidade


class Reserva(models.Model):
    id_reserva = models.AutoField(primary_key=True)
    status_meta = models.CharField(max_length=20, default="em_aberto")
    venda = models.ForeignKey(
        "marketplace.Anuncio",
        db_column="FK_id_venda",
        on_delete=models.SET_NULL,
        related_name="reservas",
        null=True,
        blank=True,
    )
    qntd_reserva = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "RESERVA"

    def __str__(self) -> str:
        return f"{self.status_meta} - {self.qntd_reserva}"


class Produto(models.Model):
    STATUS_SEM_SALDO = "S"
    STATUS_EM_PRODUCAO = "P"
    STATUS_CONCLUIDO = "C"

    id_produto = models.AutoField(primary_key=True)
    quantidade_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=1, default=STATUS_SEM_SALDO)
    data_registro = models.DateField(auto_now_add=True)
    empresa = models.ForeignKey(Empresa, db_column="FK_id_empresa", on_delete=models.CASCADE, related_name="produtos")
    categoria_residuo = models.ForeignKey(
        CategoriaResiduo,
        db_column="FK_id_categoria_residuo",
        on_delete=models.PROTECT,
        related_name="produtos",
    )
    unidade = models.ForeignKey(
        UnidadeMedida,
        db_column="FK_id_unidade",
        on_delete=models.PROTECT,
        related_name="produtos",
    )
    nome_residuo = models.CharField(max_length=100)
    reserva = models.ForeignKey(
        Reserva,
        db_column="FK_id_reserva",
        on_delete=models.SET_NULL,
        related_name="produtos",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "PRODUTO"
        ordering = ["-data_registro", "-id_produto"]
        indexes = [
            models.Index(fields=["empresa", "-data_registro"]),
            models.Index(fields=["categoria_residuo"]),
        ]

    def __str__(self) -> str:
        return self.nome_residuo

    @property
    def api_status(self) -> str:
        if self.quantidade_total <= 0:
            return "em_estoque"
        if self.reserva and self.quantidade_total >= self.reserva.qntd_reserva:
            return "concluido"
        return "em_producao"

    @property
    def meta_quantidade(self) -> Decimal:
        if self.reserva:
            return self.reserva.qntd_reserva
        return Decimal("1.00")

    def atualizar_status(self) -> None:
        if self.quantidade_total <= 0:
            self.status = self.STATUS_SEM_SALDO
        elif self.reserva and self.quantidade_total >= self.reserva.qntd_reserva:
            self.status = self.STATUS_CONCLUIDO
        else:
            self.status = self.STATUS_EM_PRODUCAO


class MvtoProduto(models.Model):
    id_estoque = models.AutoField(primary_key=True)
    dt_entrada = models.DateField(auto_now_add=True)
    produto = models.ForeignKey(Produto, db_column="FK_id_produto", on_delete=models.CASCADE, related_name="movimentos")
    nr_qntd = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "MVTO_PRODUTO"
        ordering = ["-dt_entrada", "-id_estoque"]
        indexes = [
            models.Index(fields=["produto", "-dt_entrada"]),
        ]

    def __str__(self) -> str:
        return f"{self.produto} - {self.nr_qntd}"
