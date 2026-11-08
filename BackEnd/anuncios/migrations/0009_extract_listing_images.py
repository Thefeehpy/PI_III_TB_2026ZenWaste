"""Move existing listing URLs without replacing or truncating them."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("anuncios", "0008_alter_anuncio_imagem_url")]

    operations = [
        migrations.CreateModel(
            name="ImagemAnuncio",
            fields=[
                ("id_imagem_anuncio", models.AutoField(primary_key=True, serialize=False)),
                ("url_arquivo", models.TextField(db_column="imagem_anuncio_url")),
                ("eh_capa", models.BooleanField(default=False, db_column="imagem_anuncio_capa")),
                ("ordem", models.PositiveIntegerField(default=0, db_column="imagem_anuncio_ordem")),
                ("anuncio", models.ForeignKey(to="anuncios.anuncio", on_delete=django.db.models.deletion.CASCADE, related_name="imagens", db_column="imagem_anuncio_anuncio_id")),
            ],
            options={"ordering": ["ordem", "id_imagem_anuncio"]},
        ),
        migrations.AlterField(model_name="anuncio", name="imagem_url", field=models.TextField(blank=True, null=True)),
    ]
