import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Anuncio",
            fields=[
                ("id_anuncio", models.AutoField(primary_key=True, serialize=False)),
                ("preco_sugerido_ia", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("preco_final", models.DecimalField(decimal_places=2, max_digits=10)),
                ("status_anuncio", models.CharField(default="A", max_length=1)),
                ("data_publicacao", models.DateField(auto_now_add=True)),
                ("descricao_especifico", models.CharField(max_length=500)),
                ("nr_qntd", models.DecimalField(decimal_places=2, max_digits=10)),
                ("data_final", models.DateField(blank=True, null=True)),
                (
                    "produto",
                    models.ForeignKey(
                        db_column="FK_id_produto",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="anuncios",
                        to="inventory.produto",
                    ),
                ),
            ],
            options={
                "db_table": "ANUNCIO",
                "ordering": ["-data_publicacao", "-id_anuncio"],
                "indexes": [
                    models.Index(fields=["status_anuncio", "-data_publicacao"], name="ANUNCIO_status__8a0cee_idx"),
                    models.Index(fields=["produto"], name="ANUNCIO_FK_id_p_25fb41_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ImagemAnuncio",
            fields=[
                ("id_imagem", models.AutoField(primary_key=True, serialize=False)),
                ("url_arquivo", models.URLField(max_length=255)),
                ("eh_capa", models.BooleanField(default=False)),
                (
                    "produto",
                    models.ForeignKey(
                        db_column="FK_id_produto",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="imagens",
                        to="inventory.produto",
                    ),
                ),
            ],
            options={
                "db_table": "IMAGEM_ANUNCIO",
                "ordering": ["-eh_capa", "id_imagem"],
            },
        ),
    ]
