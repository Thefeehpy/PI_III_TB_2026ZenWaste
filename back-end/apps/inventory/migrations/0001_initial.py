import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CategoriaResiduo",
            fields=[
                ("id_categoria", models.AutoField(primary_key=True, serialize=False)),
                ("nome_material", models.CharField(max_length=50, unique=True)),
            ],
            options={
                "db_table": "CATEGORIA_RESIDUO",
                "ordering": ["nome_material"],
            },
        ),
        migrations.CreateModel(
            name="UnidadeMedida",
            fields=[
                ("id_unidade", models.AutoField(primary_key=True, serialize=False)),
                ("sigla_unidade", models.CharField(max_length=10, unique=True)),
                ("descricao_unidade", models.CharField(max_length=10)),
            ],
            options={
                "db_table": "UNIDADE_MEDIDA",
                "ordering": ["sigla_unidade"],
            },
        ),
        migrations.CreateModel(
            name="Reserva",
            fields=[
                ("id_reserva", models.AutoField(primary_key=True, serialize=False)),
                ("status_meta", models.CharField(default="em_aberto", max_length=20)),
                ("qntd_reserva", models.DecimalField(decimal_places=2, max_digits=10)),
            ],
            options={
                "db_table": "RESERVA",
            },
        ),
        migrations.CreateModel(
            name="Produto",
            fields=[
                ("id_produto", models.AutoField(primary_key=True, serialize=False)),
                ("quantidade_total", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("status", models.CharField(default="S", max_length=1)),
                ("data_registro", models.DateField(auto_now_add=True)),
                ("nome_residuo", models.CharField(max_length=100)),
                (
                    "categoria_residuo",
                    models.ForeignKey(
                        db_column="FK_id_categoria_residuo",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="produtos",
                        to="inventory.categoriaresiduo",
                    ),
                ),
                (
                    "empresa",
                    models.ForeignKey(
                        db_column="FK_id_empresa",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="produtos",
                        to="accounts.empresa",
                    ),
                ),
                (
                    "reserva",
                    models.ForeignKey(
                        blank=True,
                        db_column="FK_id_reserva",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="produtos",
                        to="inventory.reserva",
                    ),
                ),
                (
                    "unidade",
                    models.ForeignKey(
                        db_column="FK_id_unidade",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="produtos",
                        to="inventory.unidademedida",
                    ),
                ),
            ],
            options={
                "db_table": "PRODUTO",
                "ordering": ["-data_registro", "-id_produto"],
                "indexes": [
                    models.Index(fields=["empresa", "-data_registro"], name="PRODUTO_FK_id_e_0b8cd4_idx"),
                    models.Index(fields=["categoria_residuo"], name="PRODUTO_FK_id_c_a51f30_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="MvtoProduto",
            fields=[
                ("id_estoque", models.AutoField(primary_key=True, serialize=False)),
                ("dt_entrada", models.DateField(auto_now_add=True)),
                ("nr_qntd", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "produto",
                    models.ForeignKey(
                        db_column="FK_id_produto",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="movimentos",
                        to="inventory.produto",
                    ),
                ),
            ],
            options={
                "db_table": "MVTO_PRODUTO",
                "ordering": ["-dt_entrada", "-id_estoque"],
                "indexes": [
                    models.Index(fields=["produto", "-dt_entrada"], name="MVTO_PRODUT_FK_id_p_e58897_idx"),
                ],
            },
        ),
    ]
