import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Empresa",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        db_column="id_empresa",
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="company_profile",
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("cnpj", models.CharField(max_length=14, unique=True)),
                ("razao_social", models.CharField(max_length=100)),
                ("tipo_perfil", models.CharField(default="empresa", max_length=20)),
                ("telefone_whatsapp", models.CharField(max_length=20)),
                ("data_cadastro", models.DateField(auto_now_add=True)),
                ("descricao_segmento", models.CharField(max_length=60)),
            ],
            options={
                "db_table": "EMPRESA",
                "ordering": ["razao_social"],
            },
        ),
        migrations.CreateModel(
            name="SessionToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="api_tokens",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["token_hash"], name="accounts_se_token_h_cd4652_idx"),
                    models.Index(fields=["expires_at"], name="accounts_se_expires_9a5d84_idx"),
                ],
            },
        ),
    ]
