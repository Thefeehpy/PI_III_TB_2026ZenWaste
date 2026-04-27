from decimal import Decimal

from inventory.models import CategoriaResiduo, UnidadeMedida


def get_or_create_category(name: str) -> CategoriaResiduo:
    category, _created = CategoriaResiduo.objects.get_or_create(nome_material=name.strip()[:50])
    return category


def get_or_create_unit(sigla: str) -> UnidadeMedida:
    value = (sigla or "kg").strip()[:10]
    unit, _created = UnidadeMedida.objects.get_or_create(
        sigla_unidade=value,
        defaults={"descricao_unidade": value},
    )
    return unit


def decimal_to_number(value: Decimal) -> float:
    return float(value)
