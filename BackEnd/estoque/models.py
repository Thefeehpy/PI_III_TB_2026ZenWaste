from django.db import models
from produtos.models import Produto

class Estoque(models.Model):
    
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name= 'produtos', null=True)
    
    def __str__(self):
        return self.name