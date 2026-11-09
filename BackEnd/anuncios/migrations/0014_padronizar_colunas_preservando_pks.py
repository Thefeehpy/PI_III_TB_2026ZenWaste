# Padronização física: PKs e atributos Python preservados.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anuncios', '0013_anuncio_anuncio_ativo_com_quantidade'),
        ('produtos', '0012_padronizar_colunas_preservando_pks'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_produto_id" TO "produto_id";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "produto_id" TO "anuncio_produto_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_preco_unitario" TO "preco_unitario";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "preco_unitario" TO "anuncio_preco_unitario";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_preco_unitario_sugerido_ia" TO "preco_unitario_sugerido_ia";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "preco_unitario_sugerido_ia" TO "anuncio_preco_unitario_sugerido_ia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_situacao" TO "situacao";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "situacao" TO "anuncio_situacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_publicado_em" TO "publicado_em";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "publicado_em" TO "anuncio_publicado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_descricao" TO "descricao";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "descricao" TO "anuncio_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_quantidade_ofertada" TO "quantidade_ofertada";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "quantidade_ofertada" TO "anuncio_quantidade_ofertada";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_data_limite" TO "data_limite";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "data_limite" TO "anuncio_data_limite";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "anuncio_localizacao" TO "localizacao";',
                    reverse_sql='ALTER TABLE "anuncios_anuncio" RENAME COLUMN "localizacao" TO "anuncio_localizacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "imagem_anuncio_anuncio_id" TO "anuncio_id";',
                    reverse_sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "anuncio_id" TO "imagem_anuncio_anuncio_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "imagem_anuncio_url" TO "url_arquivo";',
                    reverse_sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "url_arquivo" TO "imagem_anuncio_url";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "imagem_anuncio_capa" TO "eh_capa";',
                    reverse_sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "eh_capa" TO "imagem_anuncio_capa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "imagem_anuncio_ordem" TO "ordem";',
                    reverse_sql='ALTER TABLE "anuncios_imagemanuncio" RENAME COLUMN "ordem" TO "imagem_anuncio_ordem";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_produto_id" TO "produto_id";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "produto_id" TO "reserva_produto_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_empresa_compradora_id" TO "empresa_compradora_id";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "empresa_compradora_id" TO "reserva_empresa_compradora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_pedido_id" TO "pedido_id";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "pedido_id" TO "reserva_pedido_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_modalidade" TO "modalidade";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "modalidade" TO "reserva_modalidade";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_quantidade_comprometida" TO "quantidade_comprometida";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "quantidade_comprometida" TO "reserva_quantidade_comprometida";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_preco_unitario_acordado" TO "preco_unitario_acordado";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "preco_unitario_acordado" TO "reserva_preco_unitario_acordado";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_situacao" TO "situacao";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "situacao" TO "reserva_situacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_observacao" TO "observacao";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "observacao" TO "reserva_observacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_data_limite" TO "data_limite";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "data_limite" TO "reserva_data_limite";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_criada_em" TO "criada_em";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "criada_em" TO "reserva_criada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_encerrada_em" TO "encerrada_em";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "encerrada_em" TO "reserva_encerrada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_contato_nome" TO "contato_nome";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "contato_nome" TO "reserva_contato_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "reserva_contato_telefone" TO "contato_telefone";',
                    reverse_sql='ALTER TABLE "anuncios_reserva" RENAME COLUMN "contato_telefone" TO "reserva_contato_telefone";',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='anuncio',
                    name='produto',
                    field=models.ForeignKey(db_column='produto_id', on_delete=django.db.models.deletion.PROTECT, related_name='anuncios', to='produtos.produto'),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='preco_final',
                    field=models.DecimalField(db_column='preco_unitario', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='preco_sugerido_ia',
                    field=models.DecimalField(blank=True, db_column='preco_unitario_sugerido_ia', decimal_places=2, max_digits=12, null=True),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='situacao_anuncio',
                    field=models.CharField(choices=[('ativo', 'Ativo'), ('inativo', 'Inativo'), ('vendido', 'Vendido')], db_column='situacao', default='ativo', max_length=20),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='data_publicacao',
                    field=models.DateTimeField(auto_now_add=True, db_column='publicado_em'),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='descricao_especifica',
                    field=models.CharField(blank=True, db_column='descricao', max_length=500),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='nr_qtd',
                    field=models.DecimalField(db_column='quantidade_ofertada', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='data_final',
                    field=models.DateField(blank=True, db_column='data_limite', null=True),
                ),
                migrations.AlterField(
                    model_name='anuncio',
                    name='localizacao',
                    field=models.CharField(blank=True, db_column='localizacao', max_length=120),
                ),
                migrations.AlterField(
                    model_name='imagemanuncio',
                    name='anuncio',
                    field=models.ForeignKey(db_column='anuncio_id', on_delete=django.db.models.deletion.CASCADE, related_name='imagens', to='anuncios.anuncio'),
                ),
                migrations.AlterField(
                    model_name='imagemanuncio',
                    name='url_arquivo',
                    field=models.TextField(db_column='url_arquivo'),
                ),
                migrations.AlterField(
                    model_name='imagemanuncio',
                    name='eh_capa',
                    field=models.BooleanField(db_column='eh_capa', default=False),
                ),
                migrations.AlterField(
                    model_name='imagemanuncio',
                    name='ordem',
                    field=models.PositiveIntegerField(db_column='ordem', default=0),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='produto',
                    field=models.ForeignKey(db_column='produto_id', on_delete=django.db.models.deletion.PROTECT, related_name='reservas', to='produtos.produto'),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='empresa_compradora',
                    field=models.ForeignKey(blank=True, db_column='empresa_compradora_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reservas_compradas', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='pedido',
                    field=models.OneToOneField(blank=True, db_column='pedido_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reserva', to='pedidos.pedido'),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='modalidade',
                    field=models.CharField(choices=[('captacao', 'Captacao de material'), ('compromisso', 'Compromisso de estoque')], db_column='modalidade', default='captacao', max_length=16),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='quantidade_reservada',
                    field=models.DecimalField(db_column='quantidade_comprometida', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='preco_unitario',
                    field=models.DecimalField(db_column='preco_unitario_acordado', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='situacao',
                    field=models.CharField(choices=[('em_captacao', 'Em captacao'), ('pronta', 'Pronta'), ('finalizada', 'Finalizada'), ('cancelada', 'Cancelada'), ('expirada', 'Expirada')], db_column='situacao', default='em_captacao', max_length=20),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='observacao',
                    field=models.CharField(blank=True, db_column='observacao', max_length=500),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='prazo_reserva',
                    field=models.DateField(blank=True, db_column='data_limite', null=True),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='data_reserva',
                    field=models.DateTimeField(auto_now_add=True, db_column='criada_em'),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='data_finalizacao',
                    field=models.DateTimeField(blank=True, db_column='encerrada_em', null=True),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='nome_comprador',
                    field=models.CharField(db_column='contato_nome', max_length=120),
                ),
                migrations.AlterField(
                    model_name='reserva',
                    name='numero_comprador',
                    field=models.CharField(db_column='contato_telefone', max_length=20),
                ),
            ],
        ),
    ]
