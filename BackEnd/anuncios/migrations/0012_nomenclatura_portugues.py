"""Traduz atributos de anuncio e reserva mantendo dados e colunas."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("anuncios", "0011_finalize_listing_structure"),
        ("pedidos", "0006_nomenclatura_portugues"),
    ]
    operations = [
        migrations.RemoveConstraint(model_name="anuncio", name="anuncio_ativo_com_quantidade"),
        migrations.RenameField(model_name="anuncio", old_name="status_anuncio", new_name="situacao_anuncio"),
        migrations.RenameField(model_name="reserva", old_name="status", new_name="situacao"),
    ]
