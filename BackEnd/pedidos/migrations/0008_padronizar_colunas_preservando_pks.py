# Padronização física: PKs e atributos Python preservados.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anuncios', '0014_padronizar_colunas_preservando_pks'),
        ('pedidos', '0007_ajustar_relacionamentos_restricoes'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_numero" TO "numero";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "numero" TO "pedido_numero";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_empresa_compradora_id" TO "empresa_compradora_id";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "empresa_compradora_id" TO "pedido_empresa_compradora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_anuncio_id" TO "anuncio_id";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "anuncio_id" TO "pedido_anuncio_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_situacao" TO "situacao";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "situacao" TO "pedido_situacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_metodo_pagamento" TO "metodo_pagamento";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "metodo_pagamento" TO "pedido_metodo_pagamento";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_parcelas" TO "parcelas";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "parcelas" TO "pedido_parcelas";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_quantidade_negociada" TO "quantidade_negociada";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "quantidade_negociada" TO "pedido_quantidade_negociada";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_preco_unitario_acordado" TO "preco_unitario_acordado";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "preco_unitario_acordado" TO "pedido_preco_unitario_acordado";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_valor_total" TO "valor_total";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "valor_total" TO "pedido_valor_total";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_modalidade_entrega" TO "modalidade_entrega";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "modalidade_entrega" TO "pedido_modalidade_entrega";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_comprador_nome" TO "comprador_nome";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "comprador_nome" TO "pedido_comprador_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_comprador_email" TO "comprador_email";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "comprador_email" TO "pedido_comprador_email";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_comprador_cnpj" TO "comprador_cnpj";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "comprador_cnpj" TO "pedido_comprador_cnpj";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_comprador_telefone" TO "comprador_telefone";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "comprador_telefone" TO "pedido_comprador_telefone";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_nome_residuo" TO "item_nome_residuo";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_nome_residuo" TO "pedido_item_nome_residuo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_categoria" TO "item_categoria";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_categoria" TO "pedido_item_categoria";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_descricao" TO "item_descricao";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_descricao" TO "pedido_item_descricao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_unidade" TO "item_unidade";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_unidade" TO "pedido_item_unidade";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_imagem_url" TO "item_imagem_url";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_imagem_url" TO "pedido_item_imagem_url";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_item_localizacao" TO "item_localizacao";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "item_localizacao" TO "pedido_item_localizacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_vendedor_razao_social" TO "vendedor_razao_social";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "vendedor_razao_social" TO "pedido_vendedor_razao_social";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_chave_criacao" TO "chave_criacao";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "chave_criacao" TO "pedido_chave_criacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_fingerprint_criacao" TO "resumo_dados_criacao";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "resumo_dados_criacao" TO "pedido_fingerprint_criacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_reserva_expira_em" TO "reserva_expira_em";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "reserva_expira_em" TO "pedido_reserva_expira_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_cancelamento_solicitado" TO "cancelamento_solicitado";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "cancelamento_solicitado" TO "pedido_cancelamento_solicitado";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_pago_em" TO "pago_em";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pago_em" TO "pedido_pago_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_criado_em" TO "criado_em";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "criado_em" TO "pedido_criado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_order" RENAME COLUMN "pedido_atualizado_em" TO "atualizado_em";',
                    reverse_sql='ALTER TABLE "pedidos_order" RENAME COLUMN "atualizado_em" TO "pedido_atualizado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_pedido_id" TO "pedido_id";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pedido_id" TO "pagamento_pedido_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_provedor" TO "provedor";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "provedor" TO "pagamento_provedor";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_metodo" TO "metodo";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "metodo" TO "pagamento_metodo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_situacao" TO "situacao";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "situacao" TO "pagamento_situacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_chave_idempotencia" TO "chave_idempotencia";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "chave_idempotencia" TO "pagamento_chave_idempotencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_fingerprint_requisicao" TO "resumo_dados_requisicao";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "resumo_dados_requisicao" TO "pagamento_fingerprint_requisicao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_referencia_provedor" TO "referencia_provedor";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "referencia_provedor" TO "pagamento_referencia_provedor";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_valor_centavos" TO "valor_centavos";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "valor_centavos" TO "pagamento_valor_centavos";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_parcelas" TO "parcelas";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "parcelas" TO "pagamento_parcelas";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_cartao_bandeira" TO "cartao_bandeira";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "cartao_bandeira" TO "pagamento_cartao_bandeira";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_cartao_final" TO "cartao_final";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "cartao_final" TO "pagamento_cartao_final";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_pix_copia_cola" TO "pix_copia_cola";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pix_copia_cola" TO "pagamento_pix_copia_cola";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_pix_expira_em" TO "pix_expira_em";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pix_expira_em" TO "pagamento_pix_expira_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_criado_em" TO "criado_em";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "criado_em" TO "pagamento_criado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "pagamento_atualizado_em" TO "atualizado_em";',
                    reverse_sql='ALTER TABLE "pedidos_paymentattempt" RENAME COLUMN "atualizado_em" TO "pagamento_atualizado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "webhook_provedor" TO "provedor";',
                    reverse_sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "provedor" TO "webhook_provedor";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "webhook_identificador_externo" TO "identificador_externo";',
                    reverse_sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "identificador_externo" TO "webhook_identificador_externo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "webhook_pagamento_id" TO "pagamento_id";',
                    reverse_sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "pagamento_id" TO "webhook_pagamento_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "webhook_processado" TO "processado";',
                    reverse_sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "processado" TO "webhook_processado";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "webhook_recebido_em" TO "recebido_em";',
                    reverse_sql='ALTER TABLE "pedidos_webhookevent" RENAME COLUMN "recebido_em" TO "webhook_recebido_em";',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='pedido',
                    name='numero',
                    field=models.CharField(db_column='numero', max_length=24, unique=True),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='empresa_compradora',
                    field=models.ForeignKey(db_column='empresa_compradora_id', on_delete=django.db.models.deletion.PROTECT, related_name='pedidos_como_compradora', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='anuncio',
                    field=models.ForeignKey(db_column='anuncio_id', on_delete=django.db.models.deletion.PROTECT, related_name='pedidos', to='anuncios.anuncio'),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='situacao',
                    field=models.CharField(choices=[('awaiting_payment', 'Aguardando pagamento'), ('pending', 'Pagamento pendente'), ('paid', 'Pago'), ('failed', 'Falhou'), ('canceled', 'Cancelado'), ('expired', 'Expirado')], db_column='situacao', db_index=True, default='awaiting_payment', max_length=24),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='metodo',
                    field=models.CharField(blank=True, db_column='metodo_pagamento', max_length=12),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='parcelas',
                    field=models.PositiveSmallIntegerField(db_column='parcelas', default=1),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='quantidade',
                    field=models.DecimalField(db_column='quantidade_negociada', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='preco_unitario',
                    field=models.DecimalField(db_column='preco_unitario_acordado', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='valor_total',
                    field=models.DecimalField(db_column='valor_total', decimal_places=2, max_digits=14),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='modalidade_entrega',
                    field=models.CharField(db_column='modalidade_entrega', default='pickup', max_length=16),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='nome_comprador',
                    field=models.CharField(db_column='comprador_nome', max_length=120),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='email_comprador',
                    field=models.EmailField(db_column='comprador_email', max_length=256),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='documento_comprador',
                    field=models.CharField(db_column='comprador_cnpj', max_length=14),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='telefone_comprador',
                    field=models.CharField(db_column='comprador_telefone', max_length=20),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='nome_material_negociado',
                    field=models.CharField(db_column='item_nome_residuo', max_length=256),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='categoria_material_negociado',
                    field=models.CharField(db_column='item_categoria', max_length=50),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='descricao_material_negociado',
                    field=models.CharField(blank=True, db_column='item_descricao', max_length=500),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='unidade_material_negociado',
                    field=models.CharField(db_column='item_unidade', max_length=12),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='imagem_material_negociado',
                    field=models.TextField(blank=True, db_column='item_imagem_url'),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='localizacao_material_negociado',
                    field=models.CharField(blank=True, db_column='item_localizacao', max_length=120),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='razao_social_vendedora',
                    field=models.CharField(db_column='vendedor_razao_social', max_length=100),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='chave_idempotencia_criacao',
                    field=models.CharField(db_column='chave_criacao', max_length=128),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='resumo_dados_criacao',
                    field=models.CharField(db_column='resumo_dados_criacao', max_length=64),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='reserva_expira_em',
                    field=models.DateTimeField(db_column='reserva_expira_em', db_index=True),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='cancelamento_solicitado',
                    field=models.BooleanField(db_column='cancelamento_solicitado', default=False),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='pago_em',
                    field=models.DateTimeField(blank=True, db_column='pago_em', null=True),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criado_em'),
                ),
                migrations.AlterField(
                    model_name='pedido',
                    name='atualizado_em',
                    field=models.DateTimeField(auto_now=True, db_column='atualizado_em'),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='pedido',
                    field=models.ForeignKey(db_column='pedido_id', on_delete=django.db.models.deletion.PROTECT, related_name='pagamentos', to='pedidos.pedido'),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='provedor',
                    field=models.CharField(db_column='provedor', max_length=40),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='metodo',
                    field=models.CharField(db_column='metodo', max_length=12),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='situacao',
                    field=models.CharField(choices=[('processing', 'Processando'), ('pending', 'Pendente'), ('paid', 'Pago'), ('failed', 'Falhou'), ('canceled', 'Cancelado'), ('expired', 'Expirado')], db_column='situacao', db_index=True, max_length=16),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='chave_idempotencia',
                    field=models.CharField(db_column='chave_idempotencia', max_length=128),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='resumo_dados_requisicao',
                    field=models.CharField(db_column='resumo_dados_requisicao', max_length=64),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='referencia_provedor',
                    field=models.CharField(blank=True, db_column='referencia_provedor', max_length=160),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='valor_centavos',
                    field=models.PositiveBigIntegerField(db_column='valor_centavos'),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='parcelas',
                    field=models.PositiveSmallIntegerField(db_column='parcelas', default=1),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='bandeira_cartao',
                    field=models.CharField(blank=True, db_column='cartao_bandeira', max_length=32),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='final_cartao',
                    field=models.CharField(blank=True, db_column='cartao_final', max_length=4),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='pix_copia_cola',
                    field=models.TextField(blank=True, db_column='pix_copia_cola'),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='pix_expira_em',
                    field=models.DateTimeField(blank=True, db_column='pix_expira_em', null=True),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criado_em'),
                ),
                migrations.AlterField(
                    model_name='tentativapagamento',
                    name='atualizado_em',
                    field=models.DateTimeField(auto_now=True, db_column='atualizado_em'),
                ),
                migrations.AlterField(
                    model_name='eventowebhook',
                    name='provedor',
                    field=models.CharField(db_column='provedor', max_length=40),
                ),
                migrations.AlterField(
                    model_name='eventowebhook',
                    name='identificador_externo',
                    field=models.CharField(db_column='identificador_externo', max_length=160),
                ),
                migrations.AlterField(
                    model_name='eventowebhook',
                    name='pagamento',
                    field=models.ForeignKey(blank=True, db_column='pagamento_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='eventos_webhook', to='pedidos.tentativapagamento'),
                ),
                migrations.AlterField(
                    model_name='eventowebhook',
                    name='processado',
                    field=models.BooleanField(db_column='processado', default=False),
                ),
                migrations.AlterField(
                    model_name='eventowebhook',
                    name='recebido_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='recebido_em'),
                ),
            ],
        ),
    ]
