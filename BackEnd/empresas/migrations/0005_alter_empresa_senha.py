from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("empresas", "0004_empresa_estoque"),
    ]

    operations = [
        migrations.AlterField(
            model_name="empresa",
            name="senha",
            field=models.CharField(max_length=128),
        ),
    ]
