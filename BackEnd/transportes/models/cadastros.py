from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from empresas.models import Empresa, Funcionario


class Transportadora(models.Model):
    class StatusSigor(models.TextChoices):
        NAO_VALIDADO = "nao_validado", "Não validado"
        VALIDANDO = "validando", "Em validação"
        VALIDADO = "validado", "Validado"
        INVALIDO = "invalido", "Inválido"

    class TipoTransporte(models.TextChoices):
        FRACIONADO = "fracionado", "Fracionado"
        CARGA_FECHADA = "carga_fechada", "Carga fechada"
        ROLL_ON = "roll_on", "Roll-on / caçamba"
        DEDICADO = "dedicado", "Dedicado"

    id_transportadora = models.AutoField(primary_key=True)
    empresa = models.OneToOneField(Empresa, on_delete=models.CASCADE, related_name="dados_transportadora")
    codigo_unidade_sigor = models.CharField(
        max_length=50,
        blank=True,
        help_text="Código da unidade no SIGOR/CETESB",
    )
    registro_antt = models.CharField(max_length=40, blank=True)
    tipo_transporte = models.CharField(max_length=24, choices=TipoTransporte.choices, blank=True)
    regioes_atendidas = models.CharField(max_length=300, blank=True)
    tamanho_frota = models.PositiveIntegerField(default=0)
    custos_por_km = models.JSONField(default=dict, blank=True)
    is_homologada = models.BooleanField(default=False)
    status_sigor = models.CharField(max_length=20, choices=StatusSigor.choices, default=StatusSigor.NAO_VALIDADO)
    transportadora_sugerida = models.CharField(max_length=300, blank=True)
    validado_em = models.DateTimeField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["empresa__razao_social"]

    def __str__(self):
        return f"Transportadora: {self.empresa.razao_social}"

    def cadastrar_motorista(self, **dados):
        motorista = self.motoristas.create(**dados)
        return motorista

    def cadastrar_caminhao(self, **dados):
        caminhao = self.caminhoes.create(**dados)
        return caminhao

    def validar_credenciais_sigor(self, validator=None):
        """Valida formato localmente ou usa um adaptador SIGOR injetado."""
        codigo = self.codigo_unidade_sigor.strip()
        valido = bool(validator(codigo, self)) if validator else len(codigo) >= 4
        self.is_homologada = valido
        self.status_sigor = self.StatusSigor.VALIDADO if valido else self.StatusSigor.INVALIDO
        self.validado_em = timezone.now() if valido else None
        self.save(update_fields=["is_homologada", "status_sigor", "validado_em", "atualizado_em"])
        return valido

    def custo_por_km(self, material):
        chave = str(material or "outros").strip().lower()
        for nome, valor in self.custos_por_km.items():
            if nome.lower() in chave or chave in nome.lower():
                try:
                    return Decimal(str(valor))
                except (InvalidOperation, TypeError, ValueError):
                    break
        return Decimal("0")


class Caminhao(models.Model):
    id_caminhao = models.AutoField(primary_key=True)
    transportadora = models.ForeignKey(Transportadora, on_delete=models.CASCADE, related_name="caminhoes")
    placa = models.CharField(
        max_length=7,
        unique=True,
        validators=[RegexValidator(regex=r"^[a-zA-Z0-9]{7}$", message="A placa deve ter 7 caracteres alfanuméricos.")],
    )
    tipo_veiculo = models.CharField(max_length=80, blank=True)
    capacidade_carga_kg = models.DecimalField(max_digits=10, decimal_places=2)
    capacidade_volume_m3 = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    is_ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["placa"]

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
    transportadora = models.ForeignKey(Transportadora, on_delete=models.CASCADE, related_name="motoristas")
    funcionario = models.OneToOneField(
        Funcionario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dados_motorista",
    )
    nome_completo = models.CharField(max_length=150, help_text="Nome exato conforme documento")
    cpf = models.CharField(max_length=14, unique=True)
    cnh = models.CharField(max_length=20, unique=True)
    categoria_cnh = models.CharField(max_length=5, blank=True)
    validade_cnh = models.DateField(null=True, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    is_ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nome_completo"]

    def clean(self):
        self.nome_completo = self.nome_completo.strip()
        if self.nome_completo and len(self.nome_completo.split()) < 2:
            raise ValidationError("O nome do motorista deve conter nome e sobrenome.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome_completo
