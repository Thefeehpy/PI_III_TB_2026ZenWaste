import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        ("marketplace", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="reserva",
            name="venda",
            field=models.ForeignKey(
                blank=True,
                db_column="FK_id_venda",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reservas",
                to="marketplace.anuncio",
            ),
        ),
    ]
