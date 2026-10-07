from django.conf import settings
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
    """Entidade de domínio que representa a empresa usuária do sistema."""

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
        """Define a senha usando hash; a senha em texto puro nunca é persistida."""
        self.senha = make_password(senha_pura)

    def validar_senha(self, senha_pura):
        """Valida a senha informada, inclusive para registros legados sem hash."""
        if senha_ja_criptografada(self.senha):
            return check_password(senha_pura, self.senha)

        return self.senha == senha_pura

    def cadastrar_empresa(self):
        """Persiste uma nova empresa já validada."""
        self.save(force_insert=True)
        return True

    def realizar_login(self, senha_pura):
        """Autentica a empresa e migra senhas legadas para hash."""
        if not self.validar_senha(senha_pura):
            return False

        if not senha_ja_criptografada(self.senha):
            self.definir_senha(senha_pura)
            self.save(update_fields=["senha"])

        return True

    def atualizar_dados(self, **dados):
        """Atualiza somente os dados cadastrais permitidos pela entidade."""
        campos_atualizaveis = {
            "cnpj",
            "razao_social",
            "telefone_whatsapp",
            "descricao_segmento",
            "email",
        }
        campos_alterados = []

        for campo, valor in dados.items():
            if campo not in campos_atualizaveis:
                continue
            setattr(self, campo, valor)
            campos_alterados.append(campo)

        senha = dados.get("senha")
        if senha:
            self.definir_senha(senha)
            campos_alterados.append("senha")

        if campos_alterados:
            self.save(update_fields=campos_alterados)

        return True


class PapelFuncionario(models.TextChoices):
    ADMIN = 'admin', 'Administrador'
    GESTOR_LOGISTICA = 'gestor_logistica', 'Gestor de Logística'
    ENTREGADOR = 'entregador', 'Entregador (Motorista)'
    OPERADOR = 'operador', 'Operador de Pátio'


class Funcionario(models.Model):
    id_funcionario = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="perfil_funcionario"
    )
    empresa = models.ForeignKey(
        Empresa, 
        on_delete=models.CASCADE, 
        related_name="funcionarios"
    )
    papel = models.CharField(
        max_length=20, 
        choices=PapelFuncionario.choices, 
        default=PapelFuncionario.OPERADOR
    )
    is_ativo = models.BooleanField(default=True)

    class Meta:
        unique_together = ('usuario', 'empresa')

    def __str__(self):
        # Utiliza o método get_full_name do User, caso exista, ou retorna a string base do usuário
        nome = getattr(self.usuario, 'get_full_name', lambda: str(self.usuario))()
        return f"{nome} - {self.get_papel_display()}"
