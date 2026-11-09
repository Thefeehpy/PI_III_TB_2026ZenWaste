# Padronização física: PKs e atributos Python preservados.

import django.db.models.deletion
import localflavor.br.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anuncios', '0013_anuncio_anuncio_ativo_com_quantidade'),
        ('empresas', '0003_empresa_unique_empresa_email_lower'),
        ('fretes', '0002_resolucao_divergencia_cancelamento'),
        ('pedidos', '0007_ajustar_relacionamentos_restricoes'),
        ('produtos', '0011_nomenclatura_portugues'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_cnpj" TO "cnpj";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "cnpj" TO "empresa_cnpj";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_razao_social" TO "razao_social";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "razao_social" TO "empresa_razao_social";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_telefone_whatsapp" TO "telefone_whatsapp";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "telefone_whatsapp" TO "empresa_telefone_whatsapp";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_cadastrada_em" TO "cadastrada_em";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "cadastrada_em" TO "empresa_cadastrada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_segmento_descricao" TO "descricao_segmento";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "descricao_segmento" TO "empresa_segmento_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_email" TO "email";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "email" TO "empresa_email";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_senha_hash" TO "senha_hash";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "senha_hash" TO "empresa_senha_hash";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "empresa_ativa" TO "ativa";',
                    reverse_sql='ALTER TABLE "empresas_empresa" RENAME COLUMN "ativa" TO "empresa_ativa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_papelempresa" RENAME COLUMN "papel_empresa_codigo" TO "codigo";',
                    reverse_sql='ALTER TABLE "empresas_papelempresa" RENAME COLUMN "codigo" TO "papel_empresa_codigo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_papelempresa" RENAME COLUMN "papel_empresa_descricao" TO "descricao";',
                    reverse_sql='ALTER TABLE "empresas_papelempresa" RENAME COLUMN "descricao" TO "papel_empresa_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresapapel" RENAME COLUMN "empresa_papel_empresa_id" TO "empresa_id";',
                    reverse_sql='ALTER TABLE "empresas_empresapapel" RENAME COLUMN "empresa_id" TO "empresa_papel_empresa_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "empresas_empresapapel" RENAME COLUMN "empresa_papel_papel_id" TO "papel_id";',
                    reverse_sql='ALTER TABLE "empresas_empresapapel" RENAME COLUMN "papel_id" TO "empresa_papel_papel_id";',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='empresa',
                    name='cnpj',
                    field=localflavor.br.models.BRCNPJField(db_column='cnpj', max_length=18, unique=True, verbose_name='CNPJ'),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='razao_social',
                    field=models.CharField(db_column='razao_social', max_length=100),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='telefone_whatsapp',
                    field=models.CharField(db_column='telefone_whatsapp', max_length=20, unique=True),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='data_cadastro',
                    field=models.DateField(auto_now_add=True, db_column='cadastrada_em'),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='descricao_segmento',
                    field=models.CharField(blank=True, db_column='descricao_segmento', max_length=60),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='email',
                    field=models.CharField(db_column='email', max_length=256, unique=True),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='senha',
                    field=models.CharField(db_column='senha_hash', max_length=128),
                ),
                migrations.AlterField(
                    model_name='empresa',
                    name='ativo',
                    field=models.BooleanField(db_column='ativa', default=True),
                ),
                migrations.AlterField(
                    model_name='papelempresa',
                    name='codigo',
                    field=models.CharField(choices=[('vendedora', 'Vendedora'), ('compradora', 'Compradora'), ('transportadora', 'Transportadora')], db_column='codigo', max_length=20, unique=True),
                ),
                migrations.AlterField(
                    model_name='papelempresa',
                    name='descricao',
                    field=models.CharField(db_column='descricao', max_length=100),
                ),
                migrations.AlterField(
                    model_name='empresapapel',
                    name='empresa',
                    field=models.ForeignKey(db_column='empresa_id', on_delete=django.db.models.deletion.PROTECT, related_name='vinculos_papeis', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='empresapapel',
                    name='papel',
                    field=models.ForeignKey(db_column='papel_id', on_delete=django.db.models.deletion.PROTECT, related_name='vinculos_empresas', to='empresas.papelempresa'),
                ),
            ],
        ),
    ]
