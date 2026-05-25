# Generated for ZenWaste marketplace API.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anuncios', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='anuncio',
            name='preco_final',
            field=models.DecimalField(decimal_places=2, max_digits=10),
        ),
        migrations.AlterField(
            model_name='anuncio',
            name='status_anuncio',
            field=models.CharField(default='ativo', max_length=20),
        ),
        migrations.AlterField(
            model_name='anuncio',
            name='data_final',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='anuncio',
            name='produto',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='anuncios', to='produtos.produto'),
        ),
        migrations.AddField(
            model_name='anuncio',
            name='localizacao',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='anuncio',
            name='imagem_url',
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
