from decimal import Decimal

from django.utils import timezone

from .models import MvtoProduto, Produto


def decimal_to_number(value: Decimal) -> float:
    return float(value)


def serialize_item(item: Produto) -> dict:
    created_at = timezone.localtime(item.data_registro)
    updated_at = timezone.localtime(item.updated_at)
    deadline = item.prazo.isoformat() if item.prazo else created_at.date().isoformat()

    return {
        "id": str(item.id_produto),
        "name": item.nome_residuo,
        "type": item.categoria_residuo.nome_material,
        "quantity": decimal_to_number(item.quantidade_total),
        "unit": item.unidade.sigla_unidade,
        "targetQuantity": decimal_to_number(item.meta_quantidade),
        "deadline": deadline,
        "status": item.api_status,
        "createdAt": created_at.isoformat(),
        "updatedAt": updated_at.isoformat(),
    }


def serialize_movement(movement: MvtoProduto) -> dict:
    movement_type = "entrada" if movement.nr_qntd >= 0 else "saida"
    quantity = abs(movement.nr_qntd)
    created_at = timezone.localtime(movement.dt_entrada)

    return {
        "id": str(movement.id_estoque),
        "itemId": str(movement.produto_id),
        "itemName": movement.produto.nome_residuo,
        "itemType": movement.produto.categoria_residuo.nome_material,
        "type": movement_type,
        "quantity": decimal_to_number(quantity),
        "unit": movement.produto.unidade.sigla_unidade,
        "note": movement.observacao or None,
        "createdAt": created_at.isoformat(),
        "resultingQuantity": decimal_to_number(movement.produto.quantidade_total),
    }
