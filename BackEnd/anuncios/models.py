from django.db import models
from produtos.models import Produto

class Anuncio(models.Model):
    id_anuncio = models.AutoField(primary_key=True)
    preco_final = models.DecimalField(max_digits=10, decimal_places=2)
    status_anuncio = models.CharField(max_length=20, blank=False, default='ativo')
    data_publicacao = models.DateTimeField(auto_now_add=True, blank=False)
    descricao_especifica = models.CharField(max_length=500, blank=True)
    nr_qtd = models.DecimalField(max_digits=10, decimal_places=2)
    data_final = models.DateField(null=True, blank=True)
    localizacao = models.CharField(max_length=120, blank=True)
    imagem_url = models.URLField(max_length=2000, blank=True)

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name='anuncios', null=False)

    def __str__(self):
        return str(self.id_anuncio)


class Reserva(models.Model):
    STATUS_CHOICES = (
        ("em_captacao", "Em captacao"),
        ("pronta", "Pronta"),
        ("finalizada", "Finalizada"),
        ("cancelada", "Cancelada"),
    )

    id_reserva = models.AutoField(primary_key=True)
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="reservas")
    quantidade_reservada = models.DecimalField(max_digits=10, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="em_captacao")
    observacao = models.CharField(max_length=500, blank=True)
    prazo_reserva = models.DateField(null=True, blank=True)
    data_reserva = models.DateTimeField(auto_now_add=True)
    data_finalizacao = models.DateTimeField(null=True, blank=True)
    nome_comprador = models.CharField(max_length=120, blank=False)
    numero_comprador = models.CharField(max_length=20, blank=False)

    class Meta:
        ordering = ["-data_reserva"]

    def __str__(self):
        return f"Reserva {self.id_reserva} - {self.produto}"
