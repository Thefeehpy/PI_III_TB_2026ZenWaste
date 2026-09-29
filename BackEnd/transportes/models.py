from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

from empresas.models import Empresa, Funcionario


class Transportadora(models.Model):
    id_transportadora = models.AutoField(primary_key=True)
    empresa = models.OneToOneField(
        Empresa, 
        on_delete=models.CASCADE, 
        related_name="dados_transportadora"
    )
    codigo_unidade_sigor = models.CharField(
        max_length=50, 
        blank=False, 
        help_text="Código da Unidade no SIGOR/CETESB"
    )
    is_homologada = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Transportadora: {self.empresa.razao_social}"


class Caminhao(models.Model):
    id_caminhao = models.AutoField(primary_key=True)
    transportadora = models.ForeignKey(
        Transportadora, 
        on_delete=models.CASCADE, 
        related_name="caminhoes"
    )
    placa = models.CharField(
        max_length=7, 
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9]{7}$', 
                message='A placa deve conter exatamente 7 caracteres alfanuméricos, sem hífen.'
            )
        ]
    )
    capacidade_carga_kg = models.DecimalField(max_digits=10, decimal_places=2)
    is_ativo = models.BooleanField(default=True)

    def clean(self):
        if self.placa:
            self.placa = self.placa.upper().replace("-", "").strip()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Caminhão {self.placa}"


class Motorista(models.Model):
    id_motorista = models.AutoField(primary_key=True)
    transportadora = models.ForeignKey(
        Transportadora, 
        on_delete=models.CASCADE, 
        related_name="motoristas"
    )
    funcionario = models.OneToOneField(
        Funcionario, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="dados_motorista"
    )
    nome_completo = models.CharField(
        max_length=150, 
        help_text="Nome exato conforme documento (Regra SIGOR)"
    )
    cpf = models.CharField(max_length=14, unique=True)
    cnh = models.CharField(max_length=20, unique=True)
    is_ativo = models.BooleanField(default=True)

    def clean(self):
        if self.nome_completo and len(self.nome_completo.strip().split()) < 2:
            raise ValidationError("O nome do motorista deve ser completo (nome e sobrenome).")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome_completo