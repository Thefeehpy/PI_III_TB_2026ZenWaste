from django.db import models
from empresas.models import Empresa

class Produto(models.Model):
    id_produto = models.AutoField(primary_key=True) 
    tipo_produto = models.CharField(unique=True, max_length=50, blank=False)
    status = models.CharField(max_length=1)
    data_registro = models.DateField(auto_now_add=True, blank=False)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    descricao_produto = models.CharField(max_length=256, blank=False)

    empresa = models.ForeignKey(Empresa, on_delete=models.SET_DEFAULT, related_name="empresa", null=True, blank=True, default='')

    def __str__(self):
        return self.tipo_produto