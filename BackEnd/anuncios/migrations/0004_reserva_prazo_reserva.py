# Generated for ZenWaste customer reservation deadlines.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("anuncios", "0003_reserva"),
    ]

    operations = [
        migrations.AddField(
            model_name="reserva",
            name="prazo_reserva",
            field=models.DateField(blank=True, null=True),
        ),
    ]
