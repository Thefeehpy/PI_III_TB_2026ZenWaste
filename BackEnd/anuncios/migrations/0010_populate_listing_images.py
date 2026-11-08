"""Data-only migration, separate from listing schema changes."""

from django.db import migrations


def extract_images(apps, schema_editor):
    Listing = apps.get_model("anuncios", "Anuncio")
    Image = apps.get_model("anuncios", "ImagemAnuncio")
    alias = schema_editor.connection.alias
    for listing in Listing.objects.using(alias).exclude(imagem_url="").exclude(imagem_url__isnull=True).iterator():
        Image.objects.using(alias).create(anuncio_id=listing.pk, url_arquivo=listing.imagem_url, eh_capa=True, ordem=0)


def restore_cover_image(apps, schema_editor):
    Listing = apps.get_model("anuncios", "Anuncio")
    Image = apps.get_model("anuncios", "ImagemAnuncio")
    alias = schema_editor.connection.alias
    Listing.objects.using(alias).update(imagem_url="")
    for image in Image.objects.using(alias).order_by("anuncio_id", "eh_capa", "ordem", "pk"):
        if image.eh_capa or not Listing.objects.using(alias).get(pk=image.anuncio_id).imagem_url:
            Listing.objects.using(alias).filter(pk=image.anuncio_id).update(imagem_url=image.url_arquivo)


class Migration(migrations.Migration):
    dependencies = [("anuncios", "0009_extract_listing_images")]
    operations = [migrations.RunPython(extract_images, restore_cover_image)]
