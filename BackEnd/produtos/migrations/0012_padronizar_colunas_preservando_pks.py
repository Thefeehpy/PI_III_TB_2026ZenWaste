# Padronização física: PKs e atributos Python preservados.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('empresas', '0004_padronizar_colunas_preservando_pks'),
        ('produtos', '0011_nomenclatura_portugues'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "categoria_nome_material" TO "nome_material";',
                    reverse_sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "nome_material" TO "categoria_nome_material";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "categoria_descricao" TO "descricao";',
                    reverse_sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "descricao" TO "categoria_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "categoria_ativa" TO "ativa";',
                    reverse_sql='ALTER TABLE "produtos_categoriaresiduo" RENAME COLUMN "ativa" TO "categoria_ativa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "unidade_sigla" TO "sigla";',
                    reverse_sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "sigla" TO "unidade_sigla";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "unidade_descricao" TO "descricao";',
                    reverse_sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "descricao" TO "unidade_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "unidade_ativa" TO "ativa";',
                    reverse_sql='ALTER TABLE "produtos_unidademedida" RENAME COLUMN "ativa" TO "unidade_ativa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_empresa_id" TO "empresa_id";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "empresa_id" TO "produto_empresa_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_categoria_id" TO "categoria_id";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "categoria_id" TO "produto_categoria_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_unidade_id" TO "unidade_medida_id";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "unidade_medida_id" TO "produto_unidade_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_nome_residuo" TO "nome_residuo";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "nome_residuo" TO "produto_nome_residuo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_descricao" TO "descricao";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "descricao" TO "produto_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_saldo_fisico" TO "saldo_fisico";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "saldo_fisico" TO "produto_saldo_fisico";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_ativo" TO "ativo";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "ativo" TO "produto_ativo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_situacao" TO "situacao";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "situacao" TO "produto_situacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_cadastrado_em" TO "cadastrado_em";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "cadastrado_em" TO "produto_cadastrado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" RENAME COLUMN "produto_atualizado_em" TO "atualizado_em";',
                    reverse_sql='ALTER TABLE "produtos_produto" RENAME COLUMN "atualizado_em" TO "produto_atualizado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_produto_id" TO "produto_id";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "produto_id" TO "movimentacao_produto_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_tipo" TO "tipo";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "tipo" TO "movimentacao_tipo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_quantidade" TO "quantidade";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "quantidade" TO "movimentacao_quantidade";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_observacao" TO "observacao";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "observacao" TO "movimentacao_observacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_saldo_resultante" TO "saldo_resultante";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "saldo_resultante" TO "movimentacao_saldo_resultante";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "movimentacao_registrada_em" TO "registrada_em";',
                    reverse_sql='ALTER TABLE "produtos_movimentacaoestoque" RENAME COLUMN "registrada_em" TO "movimentacao_registrada_em";',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='categoriaresiduo',
                    name='nome_material',
                    field=models.CharField(db_column='nome_material', max_length=50),
                ),
                migrations.AlterField(
                    model_name='categoriaresiduo',
                    name='descricao',
                    field=models.CharField(blank=True, db_column='descricao', max_length=255),
                ),
                migrations.AlterField(
                    model_name='categoriaresiduo',
                    name='ativo',
                    field=models.BooleanField(db_column='ativa', default=True),
                ),
                migrations.AlterField(
                    model_name='unidademedida',
                    name='sigla',
                    field=models.CharField(db_column='sigla', max_length=12),
                ),
                migrations.AlterField(
                    model_name='unidademedida',
                    name='descricao',
                    field=models.CharField(db_column='descricao', max_length=100),
                ),
                migrations.AlterField(
                    model_name='unidademedida',
                    name='ativo',
                    field=models.BooleanField(db_column='ativa', default=True),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='empresa',
                    field=models.ForeignKey(db_column='empresa_id', on_delete=django.db.models.deletion.PROTECT, related_name='produtos', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='categoria',
                    field=models.ForeignKey(db_column='categoria_id', on_delete=django.db.models.deletion.PROTECT, related_name='produtos', to='produtos.categoriaresiduo'),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='unidade_medida',
                    field=models.ForeignKey(db_column='unidade_medida_id', on_delete=django.db.models.deletion.PROTECT, related_name='produtos', to='produtos.unidademedida'),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='nome_residuo',
                    field=models.CharField(db_column='nome_residuo', max_length=256),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='descricao_produto',
                    field=models.CharField(blank=True, db_column='descricao', max_length=256),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='quantidade',
                    field=models.DecimalField(db_column='saldo_fisico', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='ativo',
                    field=models.BooleanField(db_column='ativo', default=True),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='situacao',
                    field=models.CharField(db_column='situacao', default='sem_saldo', max_length=20),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='data_registro',
                    field=models.DateField(auto_now_add=True, db_column='cadastrado_em'),
                ),
                migrations.AlterField(
                    model_name='produto',
                    name='atualizado_em',
                    field=models.DateTimeField(auto_now=True, db_column='atualizado_em'),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='produto',
                    field=models.ForeignKey(db_column='produto_id', on_delete=django.db.models.deletion.PROTECT, related_name='movimentacoes', to='produtos.produto'),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='tipo',
                    field=models.CharField(choices=[('entrada', 'Entrada'), ('saida', 'Saida')], db_column='tipo', max_length=8),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='quantidade',
                    field=models.DecimalField(db_column='quantidade', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='observacao',
                    field=models.CharField(blank=True, db_column='observacao', max_length=255),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='saldo_resultante',
                    field=models.DecimalField(db_column='saldo_resultante', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='movimentacaoestoque',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='registrada_em'),
                ),
            ],
        ),
    ]
