from django.db import models

from apps.inventory.models import Produto


class Anuncio(models.Model):
    STATUS_ATIVO = "A"
    STATUS_INATIVO = "I"

    id_anuncio = models.AutoField(primary_key=True)
    preco_sugerido_ia = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    preco_final = models.DecimalField(max_digits=10, decimal_places=2)
    status_anuncio = models.CharField(max_length=1, default=STATUS_ATIVO)
    data_publicacao = models.DateField(auto_now_add=True)
    produto = models.ForeignKey(Produto, db_column="FK_id_produto", on_delete=models.CASCADE, related_name="anuncios")
    descricao_especifico = models.CharField(max_length=500)
    nr_qntd = models.DecimalField(max_digits=10, decimal_places=2)
    data_final = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "ANUNCIO"
        ordering = ["-data_publicacao", "-id_anuncio"]
        indexes = [
            models.Index(fields=["status_anuncio", "-data_publicacao"]),
            models.Index(fields=["produto"]),
        ]

    def __str__(self) -> str:
        return self.produto.nome_residuo


class ImagemAnuncio(models.Model):
    id_imagem = models.AutoField(primary_key=True)
    url_arquivo = models.URLField(max_length=255)
    eh_capa = models.BooleanField(default=False)
    produto = models.ForeignKey(Produto, db_column="FK_id_produto", on_delete=models.CASCADE, related_name="imagens")

    class Meta:
        db_table = "IMAGEM_ANUNCIO"
        ordering = ["-eh_capa", "id_imagem"]

    def __str__(self) -> str:
        return self.url_arquivo
