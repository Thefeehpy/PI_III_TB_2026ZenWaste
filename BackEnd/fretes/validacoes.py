"""Validações puras dos dados recebidos pela auditoria de fretes.

A obrigatoriedade de cada campo e a autorização da operação pertencem ao caso de
uso. Estas funções não alteram banco, estoque, pagamentos ou documentos externos.
"""

import base64
import binascii
import struct
import zlib
from decimal import Decimal, InvalidOperation

from app.excecoes import ErroRegraNegocio


VALOR_MONETARIO_MAXIMO = Decimal("9999999999.99")
MEDIDA_MAXIMA = Decimal("999999999.999")
PREFIXO_ASSINATURA = "data:image/png;base64,"
TAMANHO_MAXIMO_ASSINATURA_BYTES = 1024 * 1024
DIMENSAO_MAXIMA_ASSINATURA = 4096
PIXELS_MAXIMOS_ASSINATURA = 4 * 1024 * 1024


def _erro_campo(campo, mensagem):
    raise ErroRegraNegocio({campo: mensagem})


def validar_decimal(valor, *, campo, casas_decimais, minimo=None, maximo=None):
    """Retorna Decimal finito e com precisão válida, sem arredondar a entrada."""
    if isinstance(valor, (bool, float)) or valor is None:
        _erro_campo(campo, "Informe um valor decimal válido como texto ou Decimal.")
    texto = str(valor).strip()
    if not texto or len(texto) > 100:
        _erro_campo(campo, "Informe um valor decimal válido.")
    try:
        numero = Decimal(texto)
        if not numero.is_finite():
            _erro_campo(campo, "Informe um valor decimal finito.")
        if minimo is not None and numero < minimo:
            _erro_campo(campo, f"O valor mínimo permitido é {minimo}.")
        if maximo is not None and numero > maximo:
            _erro_campo(campo, f"O valor máximo permitido é {maximo}.")
        preciso = numero.quantize(Decimal(1).scaleb(-casas_decimais))
    except (InvalidOperation, ValueError, TypeError) as erro:
        raise ErroRegraNegocio({campo: "Informe um valor decimal válido dentro do limite permitido."}) from erro
    if numero != preciso:
        _erro_campo(campo, f"Informe no máximo {casas_decimais} casas decimais.")
    return preciso


def validar_valor_monetario(valor, *, campo, permitir_zero=True):
    return validar_decimal(
        valor, campo=campo, casas_decimais=2,
        minimo=Decimal("0") if permitir_zero else Decimal("0.01"),
        maximo=VALOR_MONETARIO_MAXIMO,
    )


def validar_medida(valor, *, campo, permitir_zero=True):
    return validar_decimal(
        valor, campo=campo, casas_decimais=3,
        minimo=Decimal("0") if permitir_zero else Decimal("0.001"),
        maximo=MEDIDA_MAXIMA,
    )


def _validar_png(conteudo, campo):
    if not conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        _erro_campo(campo, "Envie uma assinatura em PNG válido.")
    posicao = 8
    encontrou_cabecalho = False
    encontrou_imagem = False
    while posicao < len(conteudo):
        if posicao + 12 > len(conteudo):
            _erro_campo(campo, "A imagem da assinatura está incompleta.")
        tamanho = struct.unpack(">I", conteudo[posicao:posicao + 4])[0]
        tipo = conteudo[posicao + 4:posicao + 8]
        fim = posicao + 12 + tamanho
        if fim > len(conteudo):
            _erro_campo(campo, "A imagem da assinatura está incompleta.")
        dados = conteudo[posicao + 8:fim - 4]
        verificacao = struct.unpack(">I", conteudo[fim - 4:fim])[0]
        if zlib.crc32(tipo + dados) & 0xFFFFFFFF != verificacao:
            _erro_campo(campo, "A imagem da assinatura está corrompida.")
        if not encontrou_cabecalho:
            if tipo != b"IHDR" or tamanho != 13:
                _erro_campo(campo, "Envie uma assinatura em PNG válido.")
            largura, altura = struct.unpack(">II", dados[:8])
            if (
                largura < 1 or altura < 1
                or largura > DIMENSAO_MAXIMA_ASSINATURA or altura > DIMENSAO_MAXIMA_ASSINATURA
                or largura * altura > PIXELS_MAXIMOS_ASSINATURA
            ):
                _erro_campo(campo, "As dimensões da assinatura excedem o limite permitido.")
            encontrou_cabecalho = True
        elif tipo == b"IHDR" or tipo in (b"acTL", b"fcTL", b"fdAT"):
            _erro_campo(campo, "Envie uma imagem PNG estática válida para a assinatura.")
        if tipo == b"IDAT":
            encontrou_imagem = True
        if tipo == b"IEND":
            if tamanho != 0 or fim != len(conteudo) or not encontrou_imagem:
                _erro_campo(campo, "Envie uma assinatura em PNG válido.")
            return
        posicao = fim
    _erro_campo(campo, "A imagem da assinatura está incompleta.")


def validar_assinatura_canvas(valor, *, campo="assinatura_imagem"):
    """Valida a imagem desenhada; não atesta identidade ou assinatura criptográfica."""
    if not isinstance(valor, str):
        _erro_campo(campo, "Envie a assinatura desenhada no formato PNG.")
    assinatura = valor.strip()
    tamanho_maximo_base64 = 4 * ((TAMANHO_MAXIMO_ASSINATURA_BYTES + 2) // 3)
    if len(assinatura) > len(PREFIXO_ASSINATURA) + tamanho_maximo_base64:
        _erro_campo(campo, "A assinatura deve ter no máximo 1 MiB.")
    if not assinatura.startswith(PREFIXO_ASSINATURA):
        _erro_campo(campo, "Envie a assinatura desenhada no formato PNG.")
    try:
        conteudo = base64.b64decode(assinatura[len(PREFIXO_ASSINATURA):], validate=True)
    except (binascii.Error, ValueError) as erro:
        raise ErroRegraNegocio({campo: "Envie uma assinatura em base64 válido."}) from erro
    if len(conteudo) > TAMANHO_MAXIMO_ASSINATURA_BYTES:
        _erro_campo(campo, "A assinatura deve ter no máximo 1 MiB.")
    _validar_png(conteudo, campo)
    return assinatura
