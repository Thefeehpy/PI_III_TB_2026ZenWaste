# Generated for ZenWaste marketplace image uploads.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("anuncios", "0007_alter_anuncio_descricao_especifica_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="anuncio",
            name="imagem_url",
            field=models.TextField(blank=True),
        ),
    ]
