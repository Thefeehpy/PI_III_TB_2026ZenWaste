"""Traduz modelos e atributos preservando tabelas, colunas e registros."""
from django.db import migrations


def renomear_tipos_conteudo(apps, schema_editor, pares):
    TipoConteudo = apps.get_model("contenttypes", "ContentType")
    for anterior, novo in pares:
        TipoConteudo.objects.using(schema_editor.connection.alias).filter(app_label="pedidos", model=anterior).update(model=novo)


def atualizar_tipos_conteudo(apps, schema_editor):
    renomear_tipos_conteudo(apps, schema_editor, (("order", "pedido"), ("paymentattempt", "tentativapagamento"), ("webhookevent", "eventowebhook")))


def restaurar_tipos_conteudo(apps, schema_editor):
    renomear_tipos_conteudo(apps, schema_editor, (("pedido", "order"), ("tentativapagamento", "paymentattempt"), ("eventowebhook", "webhookevent")))


class Migration(migrations.Migration):
    dependencies = [("pedidos", "0005_link_existing_checkout_reservations"), ("contenttypes", "0002_remove_content_type_name")]
    operations = [
        migrations.AlterModelTable(name='order', table='pedidos_order'),
        migrations.AlterModelTable(name='paymentattempt', table='pedidos_paymentattempt'),
        migrations.AlterModelTable(name='webhookevent', table='pedidos_webhookevent'),
        migrations.RemoveConstraint(model_name='order', name='unique_order_creation_key_per_buyer'),
        migrations.RemoveConstraint(model_name='order', name='order_quantity_positive'),
        migrations.RemoveConstraint(model_name='order', name='order_total_positive'),
        migrations.RemoveConstraint(model_name='paymentattempt', name='unique_payment_key_per_order'),
        migrations.RemoveConstraint(model_name='paymentattempt', name='unique_provider_payment_reference'),
        migrations.RemoveConstraint(model_name='webhookevent', name='unique_provider_webhook_event'),
        migrations.SeparateDatabaseAndState(state_operations=[
            migrations.RenameModel(old_name='Order', new_name='Pedido'),
            migrations.RenameModel(old_name='PaymentAttempt', new_name='TentativaPagamento'),
            migrations.RenameModel(old_name='WebhookEvent', new_name='EventoWebhook'),
        ]),
        migrations.RenameField(model_name='pedido', old_name='number', new_name='numero'),
        migrations.RenameField(model_name='pedido', old_name='buyer_company', new_name='empresa_compradora'),
        migrations.RenameField(model_name='pedido', old_name='listing', new_name='anuncio'),
        migrations.RenameField(model_name='pedido', old_name='status', new_name='situacao'),
        migrations.RenameField(model_name='pedido', old_name='method', new_name='metodo'),
        migrations.RenameField(model_name='pedido', old_name='installments', new_name='parcelas'),
        migrations.RenameField(model_name='pedido', old_name='quantity', new_name='quantidade'),
        migrations.RenameField(model_name='pedido', old_name='unit_price', new_name='preco_unitario'),
        migrations.RenameField(model_name='pedido', old_name='total_amount', new_name='valor_total'),
        migrations.RenameField(model_name='pedido', old_name='fulfillment', new_name='modalidade_entrega'),
        migrations.RenameField(model_name='pedido', old_name='buyer_name', new_name='nome_comprador'),
        migrations.RenameField(model_name='pedido', old_name='buyer_email', new_name='email_comprador'),
        migrations.RenameField(model_name='pedido', old_name='buyer_document', new_name='documento_comprador'),
        migrations.RenameField(model_name='pedido', old_name='buyer_phone', new_name='telefone_comprador'),
        migrations.RenameField(model_name='pedido', old_name='item_name', new_name='nome_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_type', new_name='categoria_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_description', new_name='descricao_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_unit', new_name='unidade_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_image_url', new_name='imagem_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_location', new_name='localizacao_material_negociado'),
        migrations.RenameField(model_name='pedido', old_name='item_company', new_name='razao_social_vendedora'),
        migrations.RenameField(model_name='pedido', old_name='creation_idempotency_key', new_name='chave_idempotencia_criacao'),
        migrations.RenameField(model_name='pedido', old_name='creation_fingerprint', new_name='resumo_dados_criacao'),
        migrations.RenameField(model_name='pedido', old_name='reservation_expires_at', new_name='reserva_expira_em'),
        migrations.RenameField(model_name='pedido', old_name='cancellation_requested', new_name='cancelamento_solicitado'),
        migrations.RenameField(model_name='pedido', old_name='paid_at', new_name='pago_em'),
        migrations.RenameField(model_name='pedido', old_name='created_at', new_name='criado_em'),
        migrations.RenameField(model_name='pedido', old_name='updated_at', new_name='atualizado_em'),
        migrations.RenameField(model_name='tentativapagamento', old_name='order', new_name='pedido'),
        migrations.RenameField(model_name='tentativapagamento', old_name='provider', new_name='provedor'),
        migrations.RenameField(model_name='tentativapagamento', old_name='method', new_name='metodo'),
        migrations.RenameField(model_name='tentativapagamento', old_name='status', new_name='situacao'),
        migrations.RenameField(model_name='tentativapagamento', old_name='idempotency_key', new_name='chave_idempotencia'),
        migrations.RenameField(model_name='tentativapagamento', old_name='request_fingerprint', new_name='resumo_dados_requisicao'),
        migrations.RenameField(model_name='tentativapagamento', old_name='provider_reference', new_name='referencia_provedor'),
        migrations.RenameField(model_name='tentativapagamento', old_name='amount_cents', new_name='valor_centavos'),
        migrations.RenameField(model_name='tentativapagamento', old_name='installments', new_name='parcelas'),
        migrations.RenameField(model_name='tentativapagamento', old_name='card_brand', new_name='bandeira_cartao'),
        migrations.RenameField(model_name='tentativapagamento', old_name='card_last4', new_name='final_cartao'),
        migrations.RenameField(model_name='tentativapagamento', old_name='pix_copy_paste', new_name='pix_copia_cola'),
        migrations.RenameField(model_name='tentativapagamento', old_name='pix_expires_at', new_name='pix_expira_em'),
        migrations.RenameField(model_name='tentativapagamento', old_name='created_at', new_name='criado_em'),
        migrations.RenameField(model_name='tentativapagamento', old_name='updated_at', new_name='atualizado_em'),
        migrations.RenameField(model_name='eventowebhook', old_name='provider', new_name='provedor'),
        migrations.RenameField(model_name='eventowebhook', old_name='event_id', new_name='identificador_externo'),
        migrations.RenameField(model_name='eventowebhook', old_name='payment', new_name='pagamento'),
        migrations.RenameField(model_name='eventowebhook', old_name='processed', new_name='processado'),
        migrations.RenameField(model_name='eventowebhook', old_name='received_at', new_name='recebido_em'),
        migrations.AlterModelOptions(name='pedido', options={"ordering": ["-criado_em"]}),
        migrations.AlterModelOptions(name='tentativapagamento', options={"ordering": ["-criado_em"]}),
        migrations.RunPython(atualizar_tipos_conteudo, restaurar_tipos_conteudo),
    ]
