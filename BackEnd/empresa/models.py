import json
from django.db import models
from localflavor.br.models import BRCNPJField

class Empresa(models.Model):
    id_empresa = models.CharField(primary_key=True)
    cnpj = BRCNPJField(unique = True, verbose_name="CNPJ")
    
    #Verificar se precisa adicionar help_text dentro do parênteses    
    #Caso tenha: help_text="Digite apenas números ou o formato 00.000.000/0000-00"help_text="Digite apenas números ou o formato 00.000.000/0000-00"

    razao_social = models.CharField(max_length=100, blank=False)    
    telefone_whatsapp = models.CharField(max_length=20, blank=False)
    data_cadastro = models.DateField(auto_now_add=True, blank=False)
    descricao_segmento = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return self.razao_social
        


