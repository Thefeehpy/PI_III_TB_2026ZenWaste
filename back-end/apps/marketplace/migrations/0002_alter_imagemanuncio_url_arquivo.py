from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="imagemanuncio",
            name="url_arquivo",
            field=models.TextField(),
        ),
    ]
