from django.http import JsonResponse
from rest_framework.views import exception_handler


def endpoint_index(title: str, endpoints: list[dict]):
    def view(_request):
        return JsonResponse({"name": title, "endpoints": endpoints})

    return view


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(response.data, dict) and "message" not in response.data:
        response.data = {"message": _first_error_message(response.data)}

    return response


def _first_error_message(data):
    if isinstance(data, dict):
        if "message" in data:
            return _first_error_message(data["message"])
        if "detail" in data:
            return _first_error_message(data["detail"])
        for value in data.values():
            message = _first_error_message(value)
            if message:
                return message
        return "Nao foi possivel concluir a operacao."
    if isinstance(data, list):
        return _first_error_message(data[0]) if data else "Nao foi possivel concluir a operacao."
    return str(data)


api_root = endpoint_index(
    "ZenWaste API",
    [
        {"method": "POST", "path": "/api/auth/register/", "description": "Cadastro de empresa."},
        {"method": "POST", "path": "/api/auth/login/", "description": "Login e token Bearer."},
        {"method": "GET", "path": "/api/auth/me/", "description": "Perfil autenticado."},
        {"method": "GET", "path": "/api/companies/", "description": "Lista empresas cadastradas autenticado."},
        {"method": "GET", "path": "/api/inventory/items/", "description": "Estoque privado autenticado."},
        {"method": "GET", "path": "/api/marketplace/ads/", "description": "Marketplace publico."},
        {"method": "GET", "path": "/api/market/prices/", "description": "Bolsa de residuos."},
    ],
)
