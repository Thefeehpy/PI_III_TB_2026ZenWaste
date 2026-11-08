# Relacionamentos e restricoes dos modelos com nomenclatura em portugues.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anuncios', '0013_anuncio_anuncio_ativo_com_quantidade'),
        ('empresas', '0003_empresa_unique_empresa_email_lower'),
        ('pedidos', '0006_nomenclatura_portugues'),
    ]

    operations = [
        migrations.AlterField(
            model_name='eventowebhook',
            name='pagamento',
            field=models.ForeignKey(blank=True, db_column='webhook_pagamento_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='eventos_webhook', to='pedidos.tentativapagamento'),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='anuncio',
            field=models.ForeignKey(db_column='pedido_anuncio_id', on_delete=django.db.models.deletion.PROTECT, related_name='pedidos', to='anuncios.anuncio'),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='empresa_compradora',
            field=models.ForeignKey(db_column='pedido_empresa_compradora_id', on_delete=django.db.models.deletion.PROTECT, related_name='pedidos_como_compradora', to='empresas.empresa'),
        ),
        migrations.AlterField(
            model_name='tentativapagamento',
            name='pedido',
            field=models.ForeignKey(db_column='pagamento_pedido_id', on_delete=django.db.models.deletion.PROTECT, related_name='pagamentos', to='pedidos.pedido'),
        ),
        migrations.AddConstraint(
            model_name='eventowebhook',
            constraint=models.UniqueConstraint(fields=('provedor', 'identificador_externo'), name='webhook_evento_unico_por_provedor'),
        ),
        migrations.AddConstraint(
            model_name='pedido',
            constraint=models.UniqueConstraint(fields=('empresa_compradora', 'chave_idempotencia_criacao'), name='pedido_chave_criacao_unica_por_compradora'),
        ),
        migrations.AddConstraint(
            model_name='pedido',
            constraint=models.CheckConstraint(condition=models.Q(('quantidade__gt', 0)), name='pedido_quantidade_positiva'),
        ),
        migrations.AddConstraint(
            model_name='pedido',
            constraint=models.CheckConstraint(condition=models.Q(('valor_total__gt', 0)), name='pedido_total_positivo'),
        ),
        migrations.AddConstraint(
            model_name='tentativapagamento',
            constraint=models.UniqueConstraint(fields=('pedido', 'chave_idempotencia'), name='pagamento_chave_unica_por_pedido'),
        ),
        migrations.AddConstraint(
            model_name='tentativapagamento',
            constraint=models.UniqueConstraint(condition=models.Q(('referencia_provedor', ''), _negated=True), fields=('provedor', 'referencia_provedor'), name='pagamento_referencia_unica_por_provedor'),
        ),
    ]
