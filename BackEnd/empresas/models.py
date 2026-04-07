import json
from django.db import models
from localflavor.br.models import BRCNPJField
from estoque.models import Estoque

class Empresa(models.Model):
    id_empresa = models.AutoField(primary_key=True)
    cnpj = BRCNPJField(unique = True, verbose_name="CNPJ")    
    razao_social = models.CharField(max_length=100, blank=False)    
    telefone_whatsapp = models.CharField(unique=True, max_length=20, blank=False)
    data_cadastro = models.DateField(auto_now_add=True, blank=False)
    descricao_segmento = models.CharField(max_length=60, blank=True)
    email = models.CharField(unique=True, max_length=256, blank=False)
    senha = models.CharField(max_length=20, blank=False)
    
    estoque = models.ForeignKey(Estoque, on_delete=models.RESTRICT, related_name='estoque', null=True)

    def __str__(self):
        return self.id_empresa
        
