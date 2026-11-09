"""Somente catálogo. Não existem modelos de manifesto, operador ou unidade SIGOR."""

from django.core.exceptions import ValidationError
from django.db import models

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
