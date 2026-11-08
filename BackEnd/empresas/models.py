from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.db import models
from django.db.models.functions import Lower
from localflavor.br.models import BRCNPJField

def senha_ja_criptografada(valor):
    try:
        identify_hasher(valor)
        return True
    except (TypeError, ValueError):
        return False


class Empresa(models.Model):
    id_empresa = models.AutoField(primary_key=True)
    cnpj = BRCNPJField(unique=True, verbose_name="CNPJ", db_column="empresa_cnpj")
    razao_social = models.CharField(max_length=100, db_column="empresa_razao_social")
    telefone_whatsapp = models.CharField(unique=True, max_length=20, db_column="empresa_telefone_whatsapp")
    data_cadastro = models.DateField(auto_now_add=True, db_column="empresa_cadastrada_em")
    descricao_segmento = models.CharField(max_length=60, blank=True, db_column="empresa_segmento_descricao")
    email = models.CharField(unique=True, max_length=256, db_column="empresa_email")
    senha = models.CharField(max_length=128, db_column="empresa_senha_hash")
    ativo = models.BooleanField(default=True, db_column="empresa_ativa")
    papeis = models.ManyToManyField("PapelEmpresa", through="EmpresaPapel", related_name="empresas")

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="unique_empresa_email_lower"),
        ]
    
    def __str__(self):
        return self.razao_social

    def definir_senha(self, senha_pura):
        self.senha = make_password(senha_pura)

    def validar_senha(self, senha_pura):
        if senha_ja_criptografada(self.senha):
            return check_password(senha_pura, self.senha)

        return self.senha == senha_pura


class PapelEmpresa(models.Model):
    class Codigo(models.TextChoices):
        VENDEDORA = "vendedora", "Vendedora"
        COMPRADORA = "compradora", "Compradora"
        TRANSPORTADORA = "transportadora", "Transportadora"

    id_papel_empresa = models.AutoField(primary_key=True)
    codigo = models.CharField(
        max_length=20,
        choices=Codigo.choices,
        unique=True,
        db_column="papel_empresa_codigo",
    )
    descricao = models.CharField(max_length=100, db_column="papel_empresa_descricao")

    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return self.descricao


class EmpresaPapel(models.Model):
    id_empresa_papel = models.AutoField(primary_key=True)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="vinculos_papeis",
        db_column="empresa_papel_empresa_id",
    )
    papel = models.ForeignKey(
        PapelEmpresa,
        on_delete=models.PROTECT,
        related_name="vinculos_empresas",
        db_column="empresa_papel_papel_id",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["empresa", "papel"], name="unique_empresa_papel"),
        ]

    def __str__(self):
        return f"{self.empresa} - {self.papel}"
