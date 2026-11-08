"""Data-only migration: commit deferred FK checks before further DDL."""

from django.db import migrations, models


def populate_catalogs(apps, schema_editor):
    Product = apps.get_model("produtos", "Produto")
    Movement = apps.get_model("produtos", "MovimentacaoEstoque")
    Category = apps.get_model("produtos", "CategoriaResiduo")
    Unit = apps.get_model("produtos", "UnidadeMedida")
    alias = schema_editor.connection.alias
    products = Product.objects.using(alias)
    if products.filter(empresa__isnull=True).exists():
        raise RuntimeError("Associe os produtos sem empresa antes de aplicar a normalizacao do estoque.")
    if Movement.objects.using(alias).exclude(empresa_id=models.F("produto__empresa_id")).exists():
        raise RuntimeError("Corrija movimentacoes cuja empresa difere da proprietaria do produto antes de migrar.")
    if products.filter(quantidade__lt=0).exists():
        raise RuntimeError("Corrija saldos fisicos negativos antes de migrar.")
    categories, units = {}, {}
    for product in products.all().iterator():
        name = " ".join((product.tipo_produto or "").split())
        symbol = " ".join((product.unidade or "").split()).lower()
        if not name or not symbol:
            raise RuntimeError(f"O produto {product.pk} precisa de categoria e unidade antes de migrar.")
        category_key = name.lower()
        if category_key not in categories:
            categories[category_key] = Category.objects.using(alias).create(nome_material=name)
        if symbol not in units:
            units[symbol] = Unit.objects.using(alias).create(sigla=symbol, descricao=symbol)
        products.filter(pk=product.pk).update(
            categoria_id=categories[category_key].pk,
            unidade_medida_id=units[symbol].pk,
        )


def restore_catalog_text(apps, schema_editor):
    Product = apps.get_model("produtos", "Produto")
    for product in Product.objects.using(schema_editor.connection.alias).select_related("categoria", "unidade_medida"):
        Product.objects.using(schema_editor.connection.alias).filter(pk=product.pk).update(
            tipo_produto=product.categoria.nome_material,
            unidade=product.unidade_medida.sigla,
        )


def restore_movement_company(apps, schema_editor):
    Movement = apps.get_model("produtos", "MovimentacaoEstoque")
    alias = schema_editor.connection.alias
    for movement in Movement.objects.using(alias).select_related("produto").iterator():
        Movement.objects.using(alias).filter(pk=movement.pk).update(empresa_id=movement.produto.empresa_id)


def restore_legacy_data(apps, schema_editor):
    restore_catalog_text(apps, schema_editor)
    restore_movement_company(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [("produtos", "0008_normalize_product_catalogs")]
    operations = [migrations.RunPython(populate_catalogs, restore_legacy_data)]
