"""Casos de uso de empresas compartilhados pela API e pela administracao."""

from django.db import IntegrityError, transaction

from app.excecoes import ErroRegraNegocio
from empresas.models import Empresa, EmpresaPapel, PapelEmpresa


PAPEIS_PADRAO_EMPRESA = (PapelEmpresa.Codigo.VENDEDORA, PapelEmpresa.Codigo.COMPRADORA)
CAMPOS_EDITAVEIS_EMPRESA = frozenset({
    "cnpj", "razao_social", "telefone_whatsapp", "descricao_segmento", "email",
})
EMAIL_JA_CADASTRADO = "Ja existe uma empresa cadastrada com este e-mail."


def validar_email_empresa(valor, *, empresa_atual=None):
    email = valor.strip().lower()
    existentes = Empresa.objects.filter(email__iexact=email)
    if empresa_atual is not None and empresa_atual.pk is not None:
        existentes = existentes.exclude(pk=empresa_atual.pk)
    if existentes.exists():
        raise ErroRegraNegocio({"email": EMAIL_JA_CADASTRADO})
    return email


def _salvar_empresa(empresa, **opcoes_salvamento):
    try:
        # Isola a concorrencia de unicidade em um ponto de salvamento proprio.
        with transaction.atomic():
            empresa.save(**opcoes_salvamento)
    except IntegrityError as erro:
        restricao = getattr(getattr(erro.__cause__, "diag", None), "constraint_name", None)
        restricoes_email_conhecidas = {
            "unique_empresa_email_lower",
            "empresas_empresa_email_key",
            "empresas_empresa_empresa_email_key",
        }
        if restricao in restricoes_email_conhecidas:
            raise ErroRegraNegocio({"email": EMAIL_JA_CADASTRADO}) from erro
        raise


@transaction.atomic
def atribuir_papeis_empresa(empresa, codigos_papeis, *, substituir=False):
    """Atribui papeis conhecidos sem duplicar o cadastro da empresa."""
    if isinstance(codigos_papeis, str):
        codigos_papeis = (codigos_papeis,)
    codigos = tuple(dict.fromkeys(codigos_papeis))
    codigos_validos = dict(PapelEmpresa.Codigo.choices)
    if not codigos or any(codigo not in codigos_validos for codigo in codigos):
        raise ErroRegraNegocio("Informe papeis de empresa validos.")

    papeis = []
    for codigo in codigos:
        papel, _ = PapelEmpresa.objects.get_or_create(
            codigo=codigo,
            defaults={"descricao": codigos_validos[codigo]},
        )
        EmpresaPapel.objects.get_or_create(empresa=empresa, papel=papel)
        papeis.append(papel)
    if substituir:
        empresa.vinculos_papeis.exclude(papel__in=papeis).delete()
    return papeis


@transaction.atomic
def cadastrar_empresa(dados, *, codigos_papeis=None):
    """Persiste empresa, resumo criptografico da senha e papeis juntos."""
    dados_recebidos = dict(dados)
    senha = dados_recebidos.pop("senha", None)
    if not senha or len(senha) < 6:
        raise ErroRegraNegocio("Senha deve conter ao menos seis caracteres.")

    atributos = {nome: valor for nome, valor in dados_recebidos.items() if nome in CAMPOS_EDITAVEIS_EMPRESA}
    if "email" in atributos:
        atributos["email"] = validar_email_empresa(atributos["email"])
    empresa = Empresa(**atributos)
    empresa.definir_senha(senha)
    _salvar_empresa(empresa)
    atribuir_papeis_empresa(empresa, PAPEIS_PADRAO_EMPRESA if codigos_papeis is None else codigos_papeis)
    return empresa


@transaction.atomic
def atualizar_empresa(empresa, dados):
    dados_recebidos = dict(dados)
    senha = dados_recebidos.pop("senha", None)
    if senha is not None and len(senha) < 6:
        raise ErroRegraNegocio("Senha deve conter ao menos seis caracteres.")
    if "email" in dados_recebidos:
        dados_recebidos["email"] = validar_email_empresa(dados_recebidos["email"], empresa_atual=empresa)

    for nome, valor in dados_recebidos.items():
        if nome in CAMPOS_EDITAVEIS_EMPRESA:
            setattr(empresa, nome, valor)
    if senha is not None:
        empresa.definir_senha(senha)
    _salvar_empresa(empresa)
    return empresa


@transaction.atomic
def desativar_empresa(empresa):
    """Desativa o acesso e preserva a empresa e seu historico comercial."""
    empresa.ativo = False
    empresa.save(update_fields=["ativo"])
    return empresa


def autenticar_empresa(email, senha):
    empresa = Empresa.objects.filter(email__iexact=email.strip(), ativo=True).first()
    if empresa is None or not empresa.validar_senha(senha):
        return None
    if empresa.senha == senha:
        empresa.definir_senha(senha)
        empresa.save(update_fields=["senha"])
    return empresa
