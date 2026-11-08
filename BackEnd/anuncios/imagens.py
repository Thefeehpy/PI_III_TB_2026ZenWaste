"""Validacao de imagens compartilhada pelos adaptadores HTTP e servicos."""
import base64
import binascii
import re

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from app.excecoes import ErroRegraNegocio

TAMANHO_MAXIMO_VALOR_IMAGEM = 8 * 1024 * 1024
QUANTIDADE_MAXIMA_IMAGENS_ANUNCIO = 10
EXPRESSAO_IMAGEM_DADOS = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,(?P<data>[A-Za-z0-9+/]+={0,2})$")


def validar_valor_imagem(valor):
    valor_imagem = str(valor or "").strip()
    if not valor_imagem:
        return ""
    if len(valor_imagem) > TAMANHO_MAXIMO_VALOR_IMAGEM:
        raise ErroRegraNegocio("A imagem enviada e muito grande. Use uma imagem menor ou mais comprimida.")
    if valor_imagem.startswith("data:image/"):
        correspondencia = EXPRESSAO_IMAGEM_DADOS.match(valor_imagem)
        if not correspondencia:
            raise ErroRegraNegocio("Envie uma imagem em base64 valida.")
        try:
            base64.b64decode(correspondencia.group("data"), validate=True)
        except (binascii.Error, ValueError) as erro:
            raise ErroRegraNegocio("Envie uma imagem em base64 valida.") from erro
        return valor_imagem
    try:
        URLValidator(schemes=("http", "https"))(valor_imagem)
    except ValidationError as erro:
        raise ErroRegraNegocio("Informe uma URL http(s) ou uma imagem anexada pelo formulario.") from erro
    return valor_imagem


def normalizar_imagens(imagens):
    if not isinstance(imagens, list) or len(imagens) > QUANTIDADE_MAXIMA_IMAGENS_ANUNCIO:
        raise ErroRegraNegocio(f"Envie uma lista com no maximo {QUANTIDADE_MAXIMA_IMAGENS_ANUNCIO} imagens.")
    resultado = []
    ordens = set()
    capas = 0
    for indice, imagem in enumerate(imagens):
        if not isinstance(imagem, dict):
            raise ErroRegraNegocio("Cada imagem deve conter url, isCover e order.")
        endereco = validar_valor_imagem(imagem.get("url"))
        if not endereco:
            raise ErroRegraNegocio("Informe a URL ou o conteudo da imagem.")
        ordem = imagem.get("order", indice)
        if isinstance(ordem, bool) or not isinstance(ordem, int) or ordem < 0:
            raise ErroRegraNegocio("A ordem da imagem deve ser um inteiro nao negativo.")
        if ordem in ordens:
            raise ErroRegraNegocio("As imagens de um anuncio devem ter ordens distintas.")
        capa = imagem.get("isCover", False)
        if not isinstance(capa, bool):
            raise ErroRegraNegocio("isCover deve ser verdadeiro ou falso.")
        ordens.add(ordem)
        capas += int(capa)
        resultado.append({"url": endereco, "order": ordem, "isCover": capa})
    if capas > 1:
        raise ErroRegraNegocio("Um anuncio pode ter no maximo uma imagem de capa.")
    return resultado
