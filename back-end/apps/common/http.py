import json
from json import JSONDecodeError
from typing import Any

from django.http import HttpRequest, JsonResponse


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or {}


def parse_json(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, JSONDecodeError) as exc:
        raise ApiError("JSON invalido.", status=400) from exc

    if not isinstance(payload, dict):
        raise ApiError("O corpo da requisicao deve ser um objeto JSON.", status=400)

    return payload


def ok(data: dict[str, Any] | list[Any] | None = None, status: int = 200) -> JsonResponse:
    return JsonResponse(data if data is not None else {}, status=status, safe=not isinstance(data, list))


def error(message: str, status: int = 400, **extra: Any) -> JsonResponse:
    payload: dict[str, Any] = {"message": message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def api_error_response(exc: ApiError) -> JsonResponse:
    return error(exc.message, status=exc.status, **exc.details)


def method_not_allowed(allowed: list[str]) -> JsonResponse:
    return error(f"Metodo nao permitido. Use: {', '.join(allowed)}.", status=405)
