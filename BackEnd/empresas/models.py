from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.db import models
from localflavor.br.models import BRCNPJField

def senha_ja_criptografada(valor):
    try:
        identify_hasher(valor)
        return True
    except (TypeError, ValueError):
        return False


class Empresa(models.Model):
    id_empresa = models.AutoField(primary_key=True)
    cnpj = BRCNPJField(unique=True, verbose_name="CNPJ")
    razao_social = models.CharField(max_length=100, blank=False)
    telefone_whatsapp = models.CharField(unique=True, max_length=20, blank=False)
    data_cadastro = models.DateField(auto_now_add=True, blank=False)
    descricao_segmento = models.CharField(max_length=60, blank=True)
    email = models.CharField(unique=True, max_length=256, blank=False)
    senha = models.CharField(max_length=128, blank=False)
    
    def __str__(self):
        return self.razao_social

    def definir_senha(self, senha_pura):
        self.senha = make_password(senha_pura)

    def validar_senha(self, senha_pura):
        if senha_ja_criptografada(self.senha):
            return check_password(senha_pura, self.senha)

        return self.senha == senha_pura

    