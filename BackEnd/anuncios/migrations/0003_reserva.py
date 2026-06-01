# Generated for ZenWaste product reservations.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("produtos", "0007_remove_produto_meta"),
        ("anuncios", "0002_marketplace_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Reserva",
            fields=[
                ("id_reserva", models.AutoField(primary_key=True, serialize=False)),
                ("quantidade_reservada", models.DecimalField(decimal_places=3, max_digits=10)),
                ("preco_unitario", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("em_captacao", "Em captacao"),
                            ("pronta", "Pronta"),
                            ("finalizada", "Finalizada"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="em_captacao",
                        max_length=20,
                    ),
                ),
                ("observacao", models.CharField(blank=True, max_length=500)),
                ("data_reserva", models.DateTimeField(auto_now_add=True)),
                ("data_finalizacao", models.DateTimeField(blank=True, null=True)),
                ("nome_comprador", models.CharField(max_length=120)),
                ("numero_comprador", models.CharField(max_length=20)),
                (
                    "produto",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reservas",
                        to="produtos.produto",
                    ),
                ),
            ],
            options={
                "ordering": ["-data_reserva"],
            },
        ),
    ]
