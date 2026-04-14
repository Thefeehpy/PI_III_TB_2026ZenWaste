from functools import wraps
from typing import Callable

from django.http import HttpRequest, JsonResponse
from django.utils import timezone

from apps.common.http import ApiError, api_error_response

from .models import Empresa, SessionToken


def authenticate_request(request: HttpRequest):
    auth_header = request.headers.get("Authorization", "")
    prefix = "Bearer "

    if not auth_header.startswith(prefix):
        raise ApiError("Autenticacao obrigatoria.", status=401)

    raw_token = auth_header.removeprefix(prefix).strip()
    if not raw_token:
        raise ApiError("Token ausente.", status=401)

    token_hash = SessionToken.hash_token(raw_token)
    token = (
        SessionToken.objects.select_related("user", "user__company_profile")
        .filter(token_hash=token_hash)
        .first()
    )

    if not token:
        raise ApiError("Token invalido.", status=401)

    if token.is_expired:
        token.delete()
        raise ApiError("Sessao expirada. Faca login novamente.", status=401)

    token.last_used_at = timezone.now()
    token.save(update_fields=["last_used_at"])
    request.current_user = token.user
    request.auth_token = token
    return token.user


def login_required(view: Callable) -> Callable:
    @wraps(view)
    def wrapper(request: HttpRequest, *args, **kwargs) -> JsonResponse:
        try:
            authenticate_request(request)
        except ApiError as exc:
            return api_error_response(exc)

        return view(request, *args, **kwargs)

    return wrapper


def get_company(request: HttpRequest) -> Empresa:
    user = getattr(request, "current_user", None)
    if not user:
        user = authenticate_request(request)

    try:
        return user.company_profile
    except Empresa.DoesNotExist as exc:
        raise ApiError("Perfil da empresa nao encontrado.", status=403) from exc
