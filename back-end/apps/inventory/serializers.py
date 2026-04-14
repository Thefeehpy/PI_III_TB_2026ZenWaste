from decimal import Decimal

from .models import MvtoProduto, Produto


def decimal_to_number(value: Decimal) -> float:
    return float(value)


def serialize_item(item: Produto) -> dict:
    return {
        "id": str(item.id_produto),
        "name": item.nome_residuo,
        "type": item.categoria_residuo.nome_material,
        "quantity": decimal_to_number(item.quantidade_total),
        "unit": item.unidade.sigla_unidade,
        "targetQuantity": decimal_to_number(item.meta_quantidade),
        "deadline": item.data_registro.isoformat(),
        "status": item.api_status,
        "createdAt": item.data_registro.isoformat(),
        "updatedAt": item.data_registro.isoformat(),
    }


def serialize_movement(movement: MvtoProduto) -> dict:
    movement_type = "entrada" if movement.nr_qntd >= 0 else "saida"
    quantity = abs(movement.nr_qntd)

    return {
        "id": str(movement.id_estoque),
        "itemId": str(movement.produto_id),
        "itemName": movement.produto.nome_residuo,
        "itemType": movement.produto.categoria_residuo.nome_material,
        "type": movement_type,
        "quantity": decimal_to_number(quantity),
        "unit": movement.produto.unidade.sigla_unidade,
        "note": None,
        "createdAt": movement.dt_entrada.isoformat(),
        "resultingQuantity": decimal_to_number(movement.produto.quantidade_total),
    }
