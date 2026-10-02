from decimal import Decimal, InvalidOperation
import unicodedata

from django.core import signing
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from empresas.models import Empresa


TOKEN_SALT = "zenwaste.empresa.auth"
TOKEN_MAX_AGE = 60 * 60 * 24 * 7


class ZenWasteAPIView(APIView):
    authentication_classes = []
    permission_classes = []


def user_payload(empresa):
    return {
        "id": str(empresa.id_empresa),
        "razaoSocial": empresa.razao_social,
        "cnpj": empresa.cnpj,
        "segmento": empresa.descricao_segmento,
        "email": empresa.email,
        "telefone": empresa.telefone_whatsapp,
    }


def make_token(empresa):
    return signing.dumps({"empresa_id": empresa.id_empresa}, salt=TOKEN_SALT)


def empresa_from_request(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None

    token = header.replace("Bearer ", "", 1).strip()
    try:
        payload = signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
        return Empresa.objects.get(id_empresa=payload["empresa_id"])
    except (signing.BadSignature, signing.SignatureExpired, Empresa.DoesNotExist, KeyError):
        return None


def require_empresa(request):
    empresa = empresa_from_request(request)
    if empresa is None:
        return None, Response({"message": "Autenticacao obrigatoria."}, status=status.HTTP_401_UNAUTHORIZED)

    return empresa, None


def decimal_from_request(value, field_name, minimum=None):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValueError(f"{field_name} deve ser um numero valido.")

    if minimum is not None and number < Decimal(str(minimum)):
        raise ValueError(f"{field_name} nao pode ser negativo.")

    return number


def normalize_text(value):
    normalized = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    replacements = {
        "plstico": "plastico",
        "metlica": "metalica",
        "papelo": "papelao",
        "resduo": "residuo",
    }

    for source, target in replacements.items():
        ascii_text = ascii_text.replace(source, target)

    return ascii_text
