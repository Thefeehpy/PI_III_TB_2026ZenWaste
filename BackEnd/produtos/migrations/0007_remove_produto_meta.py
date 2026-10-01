# Generated for ZenWaste inventory without target goals.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("produtos", "0006_inventory_fields_and_movements"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="produto",
            name="meta_quantidade",
        ),
        migrations.RemoveField(
            model_name="produto",
            name="prazo_meta",
        ),
    ]
