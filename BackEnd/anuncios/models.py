from django.db import models
from django.utils import timezone
from produtos.models import Produto

class Anuncio(models.Model):
    """Entidade de domínio que representa a publicação de um produto no marketplace."""

    id_anuncio = models.AutoField(primary_key=True)
    preco_final = models.DecimalField(max_digits=10, decimal_places=2)
    status_anuncio = models.CharField(max_length=20, blank=False, default='ativo')
    data_publicacao = models.DateTimeField(auto_now_add=True, blank=False)
    descricao_especifica = models.CharField(max_length=500, blank=True)
    nr_qtd = models.DecimalField(max_digits=10, decimal_places=2)
    data_final = models.DateField(null=True, blank=True)
    localizacao = models.CharField(max_length=120, blank=True)
    imagem_url = models.TextField(blank=True)

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name='anuncios', null=False)

    def __str__(self):
        return str(self.id_anuncio)

    def publicar(self):
        self.status_anuncio = "ativo"
        self.save(force_insert=True)
        return True

    def editar_anuncio(self, **dados):
        campos_atualizaveis = {
            "descricao_especifica",
            "nr_qtd",
            "localizacao",
            "imagem_url",
        }
        houve_alteracao = False

        for campo, valor in dados.items():
            if campo in campos_atualizaveis:
                setattr(self, campo, valor)
                houve_alteracao = True

        if houve_alteracao:
            self.save()
        return True

    def alterar_preco(self, preco):
        self.preco_final = preco
        self.save(update_fields=["preco_final"])
        return True

    def finalizar_venda(self):
        self.status_anuncio = "vendido"
        self.data_final = timezone.localdate()
        self.save(update_fields=["status_anuncio", "data_final"])
        return True

    def cancelar(self):
        self.status_anuncio = "inativo"
        self.data_final = timezone.localdate()
        self.save(update_fields=["status_anuncio", "data_final"])
        return True


class Reserva(models.Model):
    """Entidade de domínio da reserva de produto para um comprador."""

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

    def _status_calculado(self):
        if self.produto.quantidade >= self.quantidade_reservada:
            return "pronta"
        return "em_captacao"

    def criar_reserva(self):
        self.status = self._status_calculado()
        self.save(force_insert=True)
        return True

    def atualizar_status(self):
        if self.status in ("finalizada", "cancelada"):
            return False

        status_calculado = self._status_calculado()
        if self.status != status_calculado:
            self.status = status_calculado
            self.save(update_fields=["status"])
        return True

    def finalizar_reserva(self):
        if self.status in ("finalizada", "cancelada"):
            return False

        self.status = "finalizada"
        self.data_finalizacao = timezone.now()
        self.save(update_fields=["status", "data_finalizacao"])
        return True

    def cancelar_reserva(self):
        if self.status in ("finalizada", "cancelada"):
            return False

        self.status = "cancelada"
        self.data_finalizacao = timezone.now()
        self.save(update_fields=["status", "data_finalizacao"])
        return True
