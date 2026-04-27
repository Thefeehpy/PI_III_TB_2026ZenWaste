from django.db import models
from produtos.models import Produto
class Anuncio(models.Model):
    id_anuncio = models.AutoField(primary_key=True)
    preco_final = models.DecimalField(max_digits=10, decimal_places=2, blank=True)
    status_anuncio = models.CharField(max_length=1, blank=False, default='')
    data_publicacao = models.DateTimeField(auto_now_add=True, blank=False)
    descricao_especifica = models.CharField(max_length=500, blank=True)
    nr_qtd = models.DecimalField(max_digits=10, decimal_places=2)
    data_final = models.DateField(blank=True)

    produto = models.ForeignKey(Produto, on_delete=models.SET_DEFAULT, related_name='produto', null=False, blank=True, default='')

def __str__(self):
    return self.id_anuncio