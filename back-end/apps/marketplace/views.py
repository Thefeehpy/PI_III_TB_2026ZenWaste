from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest

from apps.accounts.auth import authenticate_request, get_company
from apps.common.http import ApiError, api_error_response, method_not_allowed, ok, parse_json
from apps.inventory.models import Produto
from apps.inventory.views import get_or_create_category, get_or_create_unit
from apps.market.pricing import suggest_price

from .models import Anuncio, ImagemAnuncio
from .serializers import build_whatsapp_url, serialize_ad


def decimal_from_payload(value, field: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise ApiError(f"Informe um valor numerico valido para {field}.", status=400) from exc
    return number.quantize(Decimal("0.01"))


def ads(request: HttpRequest):
    if request.method == "GET":
        try:
            queryset = (
                Anuncio.objects.select_related(
                    "produto",
                    "produto__empresa",
                    "produto__categoria_residuo",
                    "produto__unidade",
                )
                .prefetch_related("produto__imagens")
                .filter(status_anuncio=Anuncio.STATUS_ATIVO)
            )
            search = request.GET.get("search", "").strip()
            waste_type = request.GET.get("type", "").strip()
            min_price = request.GET.get("minPrice", "").strip()
            max_price = request.GET.get("maxPrice", "").strip()

            if search:
                queryset = queryset.filter(
                    Q(produto__nome_residuo__icontains=search)
                    | Q(produto__categoria_residuo__nome_material__icontains=search)
                )
            if waste_type and waste_type != "all":
                queryset = queryset.filter(produto__categoria_residuo__nome_material=waste_type)
            if min_price:
                queryset = queryset.filter(preco_final__gte=decimal_from_payload(min_price, "preco minimo"))
            if max_price:
                queryset = queryset.filter(preco_final__lte=decimal_from_payload(max_price, "preco maximo"))
        except ApiError as exc:
            return api_error_response(exc)

        return ok({"items": [serialize_ad(ad) for ad in queryset]})

    if request.method != "POST":
        return method_not_allowed(["GET", "POST"])

    try:
        authenticate_request(request)
        company = get_company(request)
        data = parse_json(request)

        name = str(data.get("name", "")).strip()
        description = str(data.get("description", "")).strip()
        unit_sigla = str(data.get("unit", "kg")).strip() or "kg"
        quantity = decimal_from_payload(data.get("quantity", 0), "quantidade")
        final_price = decimal_from_payload(data.get("price", 0), "preco")
        image_url = str(data.get("imageUrl", "")).strip()
        inventory_id = str(data.get("inventoryId", "")).strip()
        waste_type = str(data.get("type", "")).strip()
        product = None

        if inventory_id:
            product = Produto.objects.filter(pk=inventory_id, empresa=company).first()
            if product is None:
                raise ApiError("Item de estoque nao encontrado.", status=404)
            waste_type = product.categoria_residuo.nome_material
            unit_sigla = product.unidade.sigla_unidade
            if quantity > product.quantidade_total:
                raise ApiError("A quantidade anunciada nao pode ultrapassar o saldo do estoque.", status=400)

        if not all([name, waste_type]):
            raise ApiError("Titulo e tipo sao obrigatorios.", status=400)
        if quantity <= 0:
            raise ApiError("A quantidade disponivel deve ser maior que zero.", status=400)
        if final_price < 0:
            raise ApiError("O preco sugerido nao pode ser negativo.", status=400)

        suggested_price = Decimal(str(suggest_price(waste_type))).quantize(Decimal("0.01"))
        if final_price == 0:
            final_price = suggested_price
        if not description:
            description = f"Material disponivel no estoque da {company.razao_social}."

        with transaction.atomic():
            if product is None:
                product = Produto.objects.create(
                    empresa=company,
                    nome_residuo=name[:100],
                    categoria_residuo=get_or_create_category(waste_type),
                    unidade=get_or_create_unit(unit_sigla),
                    quantidade_total=quantity,
                )
                product.atualizar_status()
                product.save(update_fields=["status"])

            ad = Anuncio.objects.create(
                produto=product,
                preco_sugerido_ia=suggested_price,
                preco_final=final_price,
                descricao_especifico=description[:500],
                nr_qntd=quantity,
            )
            if image_url:
                ImagemAnuncio.objects.create(produto=product, url_arquivo=image_url, eh_capa=True)
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"item": serialize_ad(ad)}, status=201)


def ad_detail(request: HttpRequest, ad_id):
    ad = (
        Anuncio.objects.select_related("produto", "produto__empresa", "produto__categoria_residuo", "produto__unidade")
        .prefetch_related("produto__imagens")
        .filter(pk=ad_id, status_anuncio=Anuncio.STATUS_ATIVO)
        .first()
    )
    if ad is None:
        return ok({"message": "Anuncio nao encontrado."}, status=404)

    if request.method == "GET":
        return ok({"item": serialize_ad(ad)})

    if request.method not in ["PATCH", "DELETE"]:
        return method_not_allowed(["GET", "PATCH", "DELETE"])

    try:
        authenticate_request(request)
        company = get_company(request)
        if ad.produto.empresa_id != company.pk:
            raise ApiError("Voce so pode editar anuncios da sua propria empresa.", status=403)

        if request.method == "DELETE":
            ad.status_anuncio = Anuncio.STATUS_INATIVO
            ad.save(update_fields=["status_anuncio"])
            return ok({"message": "Anuncio inativado."})

        data = parse_json(request)
        if "name" in data:
            ad.produto.nome_residuo = (str(data["name"]).strip() or ad.produto.nome_residuo)[:100]
        if "description" in data:
            ad.descricao_especifico = (str(data["description"]).strip() or ad.descricao_especifico)[:500]
        if "price" in data:
            price = decimal_from_payload(data["price"], "preco")
            if price < 0:
                raise ApiError("O preco sugerido nao pode ser negativo.", status=400)
            ad.preco_final = price
        if "quantity" in data:
            quantity = decimal_from_payload(data["quantity"], "quantidade")
            if quantity <= 0:
                raise ApiError("A quantidade disponivel deve ser maior que zero.", status=400)
            ad.nr_qntd = quantity
        ad.produto.save(update_fields=["nome_residuo"])
        ad.save()
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"item": serialize_ad(ad)})


def ad_whatsapp(request: HttpRequest, ad_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    ad = (
        Anuncio.objects.select_related("produto", "produto__empresa")
        .filter(pk=ad_id, status_anuncio=Anuncio.STATUS_ATIVO)
        .first()
    )
    if ad is None:
        return ok({"message": "Anuncio nao encontrado."}, status=404)

    return ok({"url": build_whatsapp_url(ad)})
