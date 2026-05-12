import django.utils.timezone
from django.db import migrations, models


def backfill_inventory_dates(apps, schema_editor):
    Produto = apps.get_model("inventory", "Produto")

    timezone = django.utils.timezone
    current_timezone = timezone.get_current_timezone()

    for item in Produto.objects.all():
        created_at = item.data_registro
        if created_at and timezone.is_naive(created_at):
            created_at = timezone.make_aware(created_at, current_timezone)

        if not item.prazo and created_at:
            item.prazo = created_at.date()

        if created_at:
            item.updated_at = created_at

        item.save(update_fields=["prazo", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_reserva_venda"),
    ]

    operations = [
        migrations.AddField(
            model_name="mvtoproduto",
            name="observacao",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="produto",
            name="prazo",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="produto",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="mvtoproduto",
            name="dt_entrada",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name="produto",
            name="data_registro",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.RunPython(backfill_inventory_dates, migrations.RunPython.noop),
    ]
