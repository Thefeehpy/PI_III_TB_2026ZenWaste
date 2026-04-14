from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.http import HttpRequest

from apps.common.http import ApiError, api_error_response, error, method_not_allowed, ok, parse_json

from .auth import get_company, login_required
from .models import Empresa, SessionToken
from .serializers import serialize_user
from .validators import normalize_cnpj, validate_cnpj


User = get_user_model()


def register(request: HttpRequest):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        data = parse_json(request)
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        razao_social = str(data.get("razaoSocial", "")).strip()
        cnpj = normalize_cnpj(str(data.get("cnpj", "")))
        segmento = str(data.get("segmento", "")).strip()
        telefone = str(data.get("telefone", "")).strip()

        if not all([email, password, razao_social, cnpj, segmento, telefone]):
            raise ApiError("Preencha todos os campos obrigatorios.", status=400)
        if not validate_cnpj(cnpj):
            raise ApiError("CNPJ invalido. Apenas empresas podem se cadastrar.", status=400)
        if User.objects.filter(username__iexact=email).exists() or User.objects.filter(email__iexact=email).exists():
            raise ApiError("Ja existe uma conta com este e-mail.", status=409)
        if Empresa.objects.filter(cnpj=cnpj).exists():
            raise ApiError("Ja existe uma conta com este CNPJ.", status=409)

        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password)
            profile = Empresa.objects.create(
                user=user,
                razao_social=razao_social,
                cnpj=cnpj,
                descricao_segmento=segmento,
                telefone_whatsapp=telefone,
            )
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"user": serialize_user(profile)}, status=201)


def login(request: HttpRequest):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        data = parse_json(request)
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not email or not password:
            raise ApiError("Informe e-mail e senha.", status=400)

        user = authenticate(request, username=email, password=password)
        if user is None:
            raise ApiError("E-mail ou senha invalidos.", status=401)

        raw_token, _token = SessionToken.create_for_user(user)
        profile = user.company_profile
    except ApiError as exc:
        return api_error_response(exc)
    except Empresa.DoesNotExist:
        return error("Perfil da empresa nao encontrado.", status=403)

    return ok({"token": raw_token, "user": serialize_user(profile)})


@login_required
def me(request: HttpRequest):
    if request.method == "GET":
        return ok({"user": serialize_user(get_company(request))})

    if request.method != "PATCH":
        return method_not_allowed(["GET", "PATCH"])

    try:
        data = parse_json(request)
        profile = get_company(request)
        user = profile.user

        email = str(data.get("email", user.email)).strip().lower()
        cnpj = normalize_cnpj(str(data.get("cnpj", profile.cnpj)))

        if email != user.email.lower() and (
            User.objects.filter(username__iexact=email).exclude(pk=user.pk).exists()
            or User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
        ):
            raise ApiError("Ja existe uma conta com este e-mail.", status=409)
        if cnpj != profile.cnpj and Empresa.objects.filter(cnpj=cnpj).exclude(pk=profile.pk).exists():
            raise ApiError("Ja existe uma conta com este CNPJ.", status=409)
        if not validate_cnpj(cnpj):
            raise ApiError("CNPJ invalido.", status=400)

        user.username = email
        user.email = email
        user.save(update_fields=["username", "email"])

        profile.razao_social = str(data.get("razaoSocial", profile.razao_social)).strip() or profile.razao_social
        profile.cnpj = cnpj
        profile.descricao_segmento = (
            str(data.get("segmento", profile.descricao_segmento)).strip() or profile.descricao_segmento
        )
        profile.telefone_whatsapp = (
            str(data.get("telefone", profile.telefone_whatsapp)).strip() or profile.telefone_whatsapp
        )
        profile.save()
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"user": serialize_user(profile)})


@login_required
def logout(request: HttpRequest):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    request.auth_token.delete()
    return ok({"message": "Logout realizado."})
