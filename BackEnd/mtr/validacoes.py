"""Validações técnicas locais; não declaram enquadramento ambiental ou validade SIGOR."""

from decimal import Decimal, InvalidOperation
import re

from mtr.dominio import ErroValidacaoMTR


def validar_texto(valor, campo, *, limite, permitir_vazio=False):
    if not isinstance(valor, str) or len(valor) > limite or any(ord(c) < 32 for c in valor):
        raise ErroValidacaoMTR("texto_invalido", "Texto inválido ou acima do limite interno.", campo=campo)
    valor = valor.strip()
    if not valor and not permitir_vazio:
        raise ErroValidacaoMTR("campo_ausente", "Preencha o campo.", campo=campo)
    return valor


def validar_codigo_ibama(codigo):
    """Formato do catálogo IBAMA canônico, não de todos os catálogos SIGOR.

    Retorna chave de pesquisa sem perder o código exato recebido.
    Marcadores '*' e '(*)' têm a mesma chave de pesquisa.
    """
    if not isinstance(codigo, str) or not re.fullmatch(r"[0-9]{6}(?:\*|\(\*\))?", codigo):
        raise ErroValidacaoMTR("codigo_invalido", "Informe código textual com seis dígitos e marcador opcional.", campo="codigo")
    return codigo[:6] + ("*" if "*" in codigo else "")


def validar_quantidade_comercial(valor, *, permitir_zero=False):
    if isinstance(valor, bool) or not isinstance(valor, (str, int, Decimal)):
        raise ErroValidacaoMTR("quantidade_invalida", "Use quantidade decimal, inteira ou textual.")
    try:
        numero = Decimal(valor)
        if not numero.is_finite() or numero < 0 or (numero == 0 and not permitir_zero):
            raise ValueError
        if numero >= Decimal("1000000000") or numero != numero.quantize(Decimal("0.001")):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ErroValidacaoMTR("quantidade_invalida", "Quantidade fora da precisão comercial de até três casas decimais.") from None
    return numero


def unidade_comercial_reconhecida(sigla, siglas_cadastradas):
    sigla = validar_texto(sigla, "unidade", limite=12)
    return sigla.casefold() in {s.casefold() for s in siglas_cadastradas}
