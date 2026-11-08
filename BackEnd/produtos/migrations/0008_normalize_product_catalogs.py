"""Preserve product names and normalize the former text catalogs."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("produtos", "0007_remove_produto_meta")]

    operations = [
        migrations.AlterField(
            model_name="movimentacaoestoque", name="empresa",
            field=models.ForeignKey(to="empresas.empresa", on_delete=django.db.models.deletion.CASCADE, related_name="movimentacoes_estoque", null=True),
        ),
        migrations.CreateModel(
            name="CategoriaResiduo",
            fields=[
                ("id_categoria", models.AutoField(primary_key=True, serialize=False)),
                ("nome_material", models.CharField(max_length=50, db_column="categoria_nome_material")),
                ("descricao", models.CharField(max_length=255, blank=True, db_column="categoria_descricao")),
                ("ativo", models.BooleanField(default=True, db_column="categoria_ativa")),
            ],
            options={"ordering": ["nome_material"]},
        ),
        migrations.CreateModel(
            name="UnidadeMedida",
            fields=[
                ("id_unidade", models.AutoField(primary_key=True, serialize=False)),
                ("sigla", models.CharField(max_length=12, db_column="unidade_sigla")),
                ("descricao", models.CharField(max_length=100, db_column="unidade_descricao")),
                ("ativo", models.BooleanField(default=True, db_column="unidade_ativa")),
            ],
            options={"ordering": ["sigla"]},
        ),
        migrations.RenameField(model_name="produto", old_name="descricao_produto", new_name="nome_residuo"),
        migrations.AddField(
            model_name="produto", name="descricao_produto",
            field=models.CharField(max_length=256, blank=True, default="", db_column="produto_descricao"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="produto", name="categoria",
            field=models.ForeignKey(to="produtos.categoriaresiduo", on_delete=django.db.models.deletion.PROTECT, related_name="produtos", null=True, db_column="produto_categoria_id"),
        ),
        migrations.AddField(
            model_name="produto", name="unidade_medida",
            field=models.ForeignKey(to="produtos.unidademedida", on_delete=django.db.models.deletion.PROTECT, related_name="produtos", null=True, db_column="produto_unidade_id"),
        ),
        migrations.AlterField(model_name="produto", name="tipo_produto", field=models.CharField(max_length=50, null=True)),
        migrations.AlterField(model_name="produto", name="unidade", field=models.CharField(max_length=12, null=True, default="kg")),
    ]
