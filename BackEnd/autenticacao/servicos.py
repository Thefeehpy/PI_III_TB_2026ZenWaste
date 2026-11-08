from decimal import Decimal, InvalidOperation
import unicodedata

from django.core import signing
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from empresas.models import Empresa


SAL_ASSINATURA_TOKEN = "zenwaste.empresa.auth"
VALIDADE_MAXIMA_TOKEN_SEGUNDOS = 60 * 60 * 24 * 7


class VisaoAPIZenWaste(APIView):
    authentication_classes = []
    permission_classes = []


def dados_empresa(empresa):
    return {
        "id": str(empresa.id_empresa),
        "razaoSocial": empresa.razao_social,
        "cnpj": empresa.cnpj,
        "segmento": empresa.descricao_segmento,
        "email": empresa.email,
        "telefone": empresa.telefone_whatsapp,
        "ativo": empresa.ativo,
        "roles": list(empresa.papeis.order_by("codigo").values_list("codigo", flat=True)),
    }


def gerar_token(empresa):
    return signing.dumps({"empresa_id": empresa.id_empresa}, salt=SAL_ASSINATURA_TOKEN)


def obter_empresa_da_requisicao(requisicao):
    cabecalho = requisicao.headers.get("Authorization", "")
    if not cabecalho.startswith("Bearer "):
        return None

    token = cabecalho.replace("Bearer ", "", 1).strip()
    try:
        dados_recebidos = signing.loads(token, salt=SAL_ASSINATURA_TOKEN, max_age=VALIDADE_MAXIMA_TOKEN_SEGUNDOS)
        return Empresa.objects.get(id_empresa=dados_recebidos["empresa_id"], ativo=True)
    except (signing.BadSignature, signing.SignatureExpired, Empresa.DoesNotExist, KeyError):
        return None


def exigir_empresa(requisicao):
    empresa = obter_empresa_da_requisicao(requisicao)
    if empresa is None:
        return None, Response({"message": "Autenticacao obrigatoria."}, status=status.HTTP_401_UNAUTHORIZED)

    return empresa, None


def decimal_da_requisicao(valor, nome_campo, minimo=None):
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, TypeError):
        raise ValueError(f"{nome_campo} deve ser um numero valido.")

    if minimo is not None and numero < Decimal(str(minimo)):
        raise ValueError(f"{nome_campo} nao pode ser negativo.")

    return numero


def normalizar_texto(valor):
    normalizado = unicodedata.normalize("NFKD", str(valor or "").strip().lower())
    texto_ascii = normalizado.encode("ascii", "ignore").decode("ascii")
    substituicoes = {
        "plstico": "plastico",
        "metlica": "metalica",
        "papelo": "papelao",
        "resduo": "residuo",
    }

    for origem, destino in substituicoes.items():
        texto_ascii = texto_ascii.replace(origem, destino)

    return texto_ascii
