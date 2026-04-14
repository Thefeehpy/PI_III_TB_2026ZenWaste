from django.http import HttpRequest

from .http import method_not_allowed, ok


def endpoint_index(title: str, endpoints: list[dict]):
    def view(request: HttpRequest):
        if request.method != "GET":
            return method_not_allowed(["GET"])

        return ok({"name": title, "endpoints": endpoints})

    return view


api_root = endpoint_index(
    "ZenWaste API",
    [
        {"method": "GET", "path": "/api/marketplace/ads/", "description": "Lista anuncios publicos."},
        {"method": "GET", "path": "/api/market/prices/", "description": "Consulta historico e metricas de mercado."},
        {"method": "GET", "path": "/api/market/suggest-price/?type=Plastico%20Industrial", "description": "Sugere preco por tipo de residuo."},
        {"method": "POST", "path": "/api/auth/register/", "description": "Cadastra uma empresa."},
        {"method": "POST", "path": "/api/auth/login/", "description": "Autentica e retorna token Bearer."},
        {"method": "GET", "path": "/api/auth/me/", "description": "Retorna a empresa autenticada."},
        {"method": "GET", "path": "/api/inventory/items/", "description": "Lista estoque privado autenticado."},
        {"method": "POST", "path": "/api/inventory/items/", "description": "Cria item privado de estoque."},
    ],
)
