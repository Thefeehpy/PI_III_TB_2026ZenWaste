from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import HttpRequest

from apps.accounts.auth import get_company, login_required
from apps.common.http import ApiError, api_error_response, method_not_allowed, ok, parse_json

from .models import CategoriaResiduo, MvtoProduto, Produto, Reserva, UnidadeMedida
from .serializers import serialize_item, serialize_movement


def decimal_from_payload(value, field: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise ApiError(f"Informe um valor numerico valido para {field}.", status=400) from exc
    return number.quantize(Decimal("0.01"))


def get_or_create_category(name: str) -> CategoriaResiduo:
    category, _created = CategoriaResiduo.objects.get_or_create(nome_material=name[:50])
    return category


def get_or_create_unit(sigla: str) -> UnidadeMedida:
    unit, _created = UnidadeMedida.objects.get_or_create(
        sigla_unidade=sigla[:10],
        defaults={"descricao_unidade": sigla[:10]},
    )
    return unit


@login_required
def items(request: HttpRequest):
    company = get_company(request)

    if request.method == "GET":
        queryset = company.produtos.select_related("categoria_residuo", "unidade", "reserva").all()
        return ok({"items": [serialize_item(item) for item in queryset]})

    if request.method != "POST":
        return method_not_allowed(["GET", "POST"])

    try:
        data = parse_json(request)
        name = str(data.get("name", "")).strip()
        waste_type = str(data.get("type", "")).strip()
        unit_sigla = str(data.get("unit", "kg")).strip() or "kg"
        quantity = decimal_from_payload(data.get("quantity", 0), "quantidade")
        target_quantity = decimal_from_payload(data.get("targetQuantity", 0), "meta")

        if not name or not waste_type:
            raise ApiError("Nome e tipo do residuo sao obrigatorios.", status=400)
        if quantity < 0:
            raise ApiError("A quantidade nao pode ser negativa.", status=400)
        if target_quantity <= 0:
            raise ApiError("A meta deve ser maior que zero.", status=400)

        with transaction.atomic():
            reserva = Reserva.objects.create(status_meta="em_aberto", qntd_reserva=target_quantity)
            item = Produto.objects.create(
                empresa=company,
                nome_residuo=name[:100],
                categoria_residuo=get_or_create_category(waste_type),
                unidade=get_or_create_unit(unit_sigla),
                quantidade_total=quantity,
                reserva=reserva,
            )
            item.atualizar_status()
            item.save(update_fields=["status"])

            if quantity > 0:
                MvtoProduto.objects.create(produto=item, nr_qntd=quantity)
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"item": serialize_item(item)}, status=201)


@login_required
def item_detail(request: HttpRequest, item_id):
    company = get_company(request)
    item = (
        company.produtos.select_related("categoria_residuo", "unidade", "reserva")
        .filter(pk=item_id)
        .first()
    )
    if item is None:
        return ok({"message": "Item nao encontrado."}, status=404)

    if request.method == "GET":
        return ok({"item": serialize_item(item)})

    if request.method == "DELETE":
        item.delete()
        return ok({"message": "Item removido."})

    if request.method != "PATCH":
        return method_not_allowed(["GET", "PATCH", "DELETE"])

    try:
        data = parse_json(request)
        if "name" in data:
            item.nome_residuo = (str(data["name"]).strip() or item.nome_residuo)[:100]
        if "type" in data:
            waste_type = str(data["type"]).strip()
            if waste_type:
                item.categoria_residuo = get_or_create_category(waste_type)
        if "unit" in data:
            unit_sigla = str(data["unit"]).strip()
            if unit_sigla:
                item.unidade = get_or_create_unit(unit_sigla)
        if "targetQuantity" in data:
            target_quantity = decimal_from_payload(data["targetQuantity"], "meta")
            if target_quantity <= 0:
                raise ApiError("A meta deve ser maior que zero.", status=400)
            if not item.reserva:
                item.reserva = Reserva.objects.create(status_meta="em_aberto", qntd_reserva=target_quantity)
            else:
                item.reserva.qntd_reserva = target_quantity
                item.reserva.save(update_fields=["qntd_reserva"])

        item.atualizar_status()
        item.save()
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"item": serialize_item(item)})


@login_required
def movements(request: HttpRequest):
    company = get_company(request)

    if request.method != "GET":
        return method_not_allowed(["GET"])

    queryset = (
        MvtoProduto.objects.filter(produto__empresa=company)
        .select_related("produto", "produto__categoria_residuo", "produto__unidade")
    )
    return ok({"movements": [serialize_movement(movement) for movement in queryset]})


@login_required
def item_movements(request: HttpRequest, item_id):
    company = get_company(request)

    if request.method == "GET":
        queryset = (
            MvtoProduto.objects.filter(produto_id=item_id, produto__empresa=company)
            .select_related("produto", "produto__categoria_residuo", "produto__unidade")
        )
        return ok({"movements": [serialize_movement(movement) for movement in queryset]})

    if request.method != "POST":
        return method_not_allowed(["GET", "POST"])

    try:
        data = parse_json(request)
        movement_type = str(data.get("type", "")).strip()
        quantity = decimal_from_payload(data.get("quantity", 0), "quantidade")

        if movement_type not in ["entrada", "saida"]:
            raise ApiError("Tipo de movimentacao invalido.", status=400)
        if quantity <= 0:
            raise ApiError("A quantidade deve ser maior que zero.", status=400)

        with transaction.atomic():
            item = (
                company.produtos.select_for_update()
                .select_related("categoria_residuo", "unidade", "reserva")
                .filter(pk=item_id)
                .first()
            )
            if item is None:
                raise ApiError("Item nao encontrado.", status=404)

            if movement_type == "saida" and quantity > item.quantidade_total:
                raise ApiError("A saida nao pode ser maior que o saldo disponivel em estoque.", status=400)

            signed_quantity = quantity if movement_type == "entrada" else -quantity
            item.quantidade_total += signed_quantity
            item.atualizar_status()
            item.save(update_fields=["quantidade_total", "status"])

            movement = MvtoProduto.objects.create(produto=item, nr_qntd=signed_quantity)
    except ApiError as exc:
        return api_error_response(exc)

    return ok({"item": serialize_item(item), "movement": serialize_movement(movement)}, status=201)
