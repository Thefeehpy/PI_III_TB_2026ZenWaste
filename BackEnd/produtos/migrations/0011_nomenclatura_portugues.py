"""Padroniza o atributo de situacao sem alterar sua coluna fisica."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("produtos", "0010_finalize_product_structure")]
    operations = [migrations.RenameField(model_name="produto", old_name="status", new_name="situacao")]
