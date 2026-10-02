from django.db import models
from empresas.models import Empresa

class Produto(models.Model):
    """Entidade de domínio do item de estoque de uma empresa."""

    id_produto = models.AutoField(primary_key=True) 
    tipo_produto = models.CharField(max_length=50, blank=False)
    status = models.CharField(max_length=20, default="em_estoque")
    data_registro = models.DateField(auto_now_add=True, blank=False)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    descricao_produto = models.CharField(max_length=256, blank=False)
    unidade = models.CharField(max_length=12, default="kg")
    atualizado_em = models.DateTimeField(auto_now=True)

    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, related_name="produtos", null=True, blank=True)

    def __str__(self):
        return self.tipo_produto

    def cadastrar_produto(self):
        self.atualizar_status()
        self.save(force_insert=True)
        return True

    def atualizar_produto(self, **dados):
        campos_atualizaveis = {
            "tipo_produto",
            "descricao_produto",
            "quantidade",
            "unidade",
        }

        for campo, valor in dados.items():
            if campo in campos_atualizaveis:
                setattr(self, campo, valor)

        self.atualizar_status()
        self.save()
        return True

    def atualizar_status(self):
        quantidade = self.quantidade or 0

        if quantidade <= 0:
            self.status = "sem_saldo"
        else:
            self.status = "disponivel"

    def excluir_produto(self):
        self.delete()
        return True


class MovimentacaoEstoque(models.Model):
    TIPO_CHOICES = (
        ("entrada", "Entrada"),
        ("saida", "Saida"),
    )

    id_movimentacao = models.AutoField(primary_key=True)
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="movimentacoes")
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="movimentacoes_estoque")
    tipo = models.CharField(max_length=8, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    observacao = models.CharField(max_length=255, blank=True)
    saldo_resultante = models.DecimalField(max_digits=10, decimal_places=3)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.tipo} - {self.produto}"
