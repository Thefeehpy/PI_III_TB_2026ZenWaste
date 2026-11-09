# Padronização física: PKs e atributos Python preservados.

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fretes', '0002_resolucao_divergencia_cancelamento'),
        ('pedidos', '0008_padronizar_colunas_preservando_pks'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_pedido_id" TO "pedido_id";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "pedido_id" TO "frete_pedido_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_empresa_vendedora_id" TO "empresa_vendedora_id";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "empresa_vendedora_id" TO "frete_empresa_vendedora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_empresa_compradora_id" TO "empresa_compradora_id";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "empresa_compradora_id" TO "frete_empresa_compradora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_transportadora_id" TO "transportadora_id";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "transportadora_id" TO "frete_transportadora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_numero_referencia" TO "numero_referencia";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "numero_referencia" TO "frete_numero_referencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_origem_cadastro" TO "origem_cadastro";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "origem_cadastro" TO "frete_origem_cadastro";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_material" TO "material";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "material" TO "frete_material";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_unidade" TO "unidade";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "unidade" TO "frete_unidade";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_quantidade_remessa" TO "quantidade_remessa";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "quantidade_remessa" TO "frete_quantidade_remessa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_local_origem" TO "local_origem";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "local_origem" TO "frete_local_origem";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_local_destino" TO "local_destino";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "local_destino" TO "frete_local_destino";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_peso_toneladas" TO "peso_toneladas";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "peso_toneladas" TO "frete_peso_toneladas";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_cubagem_m3" TO "cubagem_m3";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "cubagem_m3" TO "frete_cubagem_m3";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_quantidade_volumes" TO "quantidade_volumes";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "quantidade_volumes" TO "frete_quantidade_volumes";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_data_referencia" TO "data_referencia";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "data_referencia" TO "frete_data_referencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_previsao_entrega" TO "previsao_entrega";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "previsao_entrega" TO "frete_previsao_entrega";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_situacao_auditoria" TO "situacao_auditoria";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "situacao_auditoria" TO "frete_situacao_auditoria";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_modalidade" TO "modalidade";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "modalidade" TO "frete_modalidade";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_valor_referencia" TO "valor_referencia";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "valor_referencia" TO "frete_valor_referencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_retirado_em" TO "retirado_em";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "retirado_em" TO "frete_retirado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_foto_retirada_nome" TO "nome_foto_retirada";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "nome_foto_retirada" TO "frete_foto_retirada_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_cancelado_em" TO "cancelado_em";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "cancelado_em" TO "frete_cancelado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_cancelamento_justificativa" TO "justificativa_cancelamento";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "justificativa_cancelamento" TO "frete_cancelamento_justificativa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_criado_em" TO "criado_em";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "criado_em" TO "frete_criado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_frete" RENAME COLUMN "frete_atualizado_em" TO "atualizado_em";',
                    reverse_sql='ALTER TABLE "fretes_frete" RENAME COLUMN "atualizado_em" TO "frete_atualizado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "frete_id" TO "cotacao_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_transportadora_id" TO "transportadora_id";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "transportadora_id" TO "cotacao_transportadora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_valor" TO "valor";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "valor" TO "cotacao_valor";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_prazo_dias" TO "prazo_dias";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "prazo_dias" TO "cotacao_prazo_dias";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_observacao" TO "observacao";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "observacao" TO "cotacao_observacao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_aprovada" TO "aprovada";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "aprovada" TO "cotacao_aprovada";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "cotacao_criada_em" TO "criada_em";',
                    reverse_sql='ALTER TABLE "fretes_cotacaofrete" RENAME COLUMN "criada_em" TO "cotacao_criada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "frete_id" TO "cte_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_versao" TO "versao";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "versao" TO "cte_versao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_numero" TO "numero";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "numero" TO "cte_numero";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_valor" TO "valor";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "valor" TO "cte_valor";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_arquivo_nome" TO "nome_arquivo";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "nome_arquivo" TO "cte_arquivo_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_nfe_nome" TO "nome_arquivo_nfe";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "nome_arquivo_nfe" TO "cte_nfe_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "cte_registrado_em" TO "registrado_em";',
                    reverse_sql='ALTER TABLE "fretes_documentocte" RENAME COLUMN "registrado_em" TO "cte_registrado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "frete_id" TO "divergencia_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_cte_id" TO "documento_id";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "documento_id" TO "divergencia_cte_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_referencia" TO "valor_referencia";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "valor_referencia" TO "divergencia_referencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_cobrado" TO "valor_cobrado";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "valor_cobrado" TO "divergencia_cobrado";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_diferenca" TO "diferenca";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "diferenca" TO "divergencia_diferenca";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_resolucao_justificativa" TO "justificativa_resolucao";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "justificativa_resolucao" TO "divergencia_resolucao_justificativa";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_tipo_resolucao" TO "tipo_resolucao";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "tipo_resolucao" TO "divergencia_tipo_resolucao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_cte_correcao_id" TO "documento_correcao_id";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "documento_correcao_id" TO "divergencia_cte_correcao_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_empresa_resolvedora_id" TO "empresa_resolvedora_id";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "empresa_resolvedora_id" TO "divergencia_empresa_resolvedora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_criada_em" TO "criada_em";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "criada_em" TO "divergencia_criada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "divergencia_resolvida_em" TO "resolvida_em";',
                    reverse_sql='ALTER TABLE "fretes_divergenciafrete" RENAME COLUMN "resolvida_em" TO "divergencia_resolvida_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "frete_id" TO "entrega_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_empresa_confirmadora_id" TO "empresa_confirmadora_id";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "empresa_confirmadora_id" TO "entrega_empresa_confirmadora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_recebedor_nome" TO "nome_recebedor";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "nome_recebedor" TO "entrega_recebedor_nome";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_assinatura_imagem" TO "imagem_assinatura";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "imagem_assinatura" TO "entrega_assinatura_imagem";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_tipo_recebimento" TO "tipo_recebimento";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "tipo_recebimento" TO "entrega_tipo_recebimento";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_ressalva" TO "ressalva";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "ressalva" TO "entrega_ressalva";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "entrega_confirmada_em" TO "confirmada_em";',
                    reverse_sql='ALTER TABLE "fretes_confirmacaoentrega" RENAME COLUMN "confirmada_em" TO "entrega_confirmada_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "frete_id" TO "historico_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_empresa_autora_id" TO "autora_id";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "autora_id" TO "historico_empresa_autora_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_acao" TO "acao";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "acao" TO "historico_acao";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_situacao_anterior" TO "situacao_anterior";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "situacao_anterior" TO "historico_situacao_anterior";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_situacao_nova" TO "situacao_nova";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "situacao_nova" TO "historico_situacao_nova";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_chave_idempotencia" TO "chave_idempotencia";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "chave_idempotencia" TO "historico_chave_idempotencia";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_resumo_dados" TO "resumo_dados";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "resumo_dados" TO "historico_resumo_dados";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_detalhes" TO "detalhes";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "detalhes" TO "historico_detalhes";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "historico_criado_em" TO "criado_em";',
                    reverse_sql='ALTER TABLE "fretes_historicofrete" RENAME COLUMN "criado_em" TO "historico_criado_em";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_frete_id" TO "frete_id";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "frete_id" TO "demanda_frete_id";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_valor_sugerido" TO "valor_sugerido";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "valor_sugerido" TO "demanda_valor_sugerido";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_janela_coleta" TO "janela_coleta";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "janela_coleta" TO "demanda_janela_coleta";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_tipo_veiculo" TO "tipo_veiculo";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "tipo_veiculo" TO "demanda_tipo_veiculo";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_observacoes" TO "observacoes";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "observacoes" TO "demanda_observacoes";',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "demanda_publicada_em" TO "publicada_em";',
                    reverse_sql='ALTER TABLE "fretes_demandatransporte" RENAME COLUMN "publicada_em" TO "demanda_publicada_em";',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='frete',
                    name='pedido',
                    field=models.ForeignKey(blank=True, db_column='pedido_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='fretes', to='pedidos.pedido'),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='empresa_vendedora',
                    field=models.ForeignKey(db_column='empresa_vendedora_id', on_delete=django.db.models.deletion.PROTECT, related_name='fretes_como_vendedora', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='empresa_compradora',
                    field=models.ForeignKey(db_column='empresa_compradora_id', on_delete=django.db.models.deletion.PROTECT, related_name='fretes_como_compradora', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='transportadora',
                    field=models.ForeignKey(blank=True, db_column='transportadora_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='fretes_atribuidos', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='numero_pedido',
                    field=models.CharField(db_column='numero_referencia', max_length=60),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='origem_cadastro',
                    field=models.CharField(choices=[('pedido', 'Pedido comercial'), ('avulso', 'Frete avulso')], db_column='origem_cadastro', max_length=12),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='material',
                    field=models.CharField(db_column='material', max_length=256),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='unidade',
                    field=models.CharField(db_column='unidade', max_length=12),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='quantidade',
                    field=models.DecimalField(db_column='quantidade_remessa', decimal_places=3, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='origem',
                    field=models.CharField(db_column='local_origem', max_length=255),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='destino',
                    field=models.CharField(db_column='local_destino', max_length=255),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='peso_toneladas',
                    field=models.DecimalField(blank=True, db_column='peso_toneladas', decimal_places=3, max_digits=12, null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='cubagem_m3',
                    field=models.DecimalField(blank=True, db_column='cubagem_m3', decimal_places=3, max_digits=12, null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='quantidade_volumes',
                    field=models.PositiveIntegerField(blank=True, db_column='quantidade_volumes', null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='data_pedido',
                    field=models.DateField(db_column='data_referencia', default=django.utils.timezone.localdate),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='previsao_entrega',
                    field=models.DateField(blank=True, db_column='previsao_entrega', null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='situacao',
                    field=models.CharField(choices=[('aguardando_classificacao', 'Aguardando classificação'), ('em_cotacao', 'Em cotação'), ('aguardando_conferencia', 'Aguardando conferência'), ('com_divergencia', 'Com divergência'), ('aguardando_entrega', 'Aguardando entrega'), ('concluido', 'Concluído'), ('cancelado', 'Cancelado')], db_column='situacao_auditoria', db_index=True, default='aguardando_classificacao', max_length=30),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='modalidade',
                    field=models.CharField(blank=True, choices=[('cotar', 'Cotar o frete'), ('contratado', 'Frete já contratado'), ('retirada_cliente', 'Retirada pelo cliente')], db_column='modalidade', default='', max_length=24),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='valor_referencia',
                    field=models.DecimalField(blank=True, db_column='valor_referencia', decimal_places=2, max_digits=12, null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='retirado_em',
                    field=models.DateTimeField(blank=True, db_column='retirado_em', null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='nome_foto_retirada',
                    field=models.CharField(blank=True, db_column='nome_foto_retirada', default='', max_length=255),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='cancelado_em',
                    field=models.DateTimeField(blank=True, db_column='cancelado_em', null=True),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='justificativa_cancelamento',
                    field=models.CharField(blank=True, db_column='justificativa_cancelamento', default='', max_length=1000),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criado_em'),
                ),
                migrations.AlterField(
                    model_name='frete',
                    name='atualizado_em',
                    field=models.DateTimeField(auto_now=True, db_column='atualizado_em'),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='frete',
                    field=models.ForeignKey(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='cotacoes', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='transportadora',
                    field=models.ForeignKey(db_column='transportadora_id', on_delete=django.db.models.deletion.PROTECT, related_name='cotacoes_frete', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='valor',
                    field=models.DecimalField(db_column='valor', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='prazo_dias',
                    field=models.PositiveIntegerField(db_column='prazo_dias'),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='observacao',
                    field=models.CharField(blank=True, db_column='observacao', default='', max_length=1000),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='aprovada',
                    field=models.BooleanField(db_column='aprovada', default=False),
                ),
                migrations.AlterField(
                    model_name='cotacaofrete',
                    name='criada_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criada_em'),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='frete',
                    field=models.ForeignKey(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='documentos', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='versao',
                    field=models.PositiveIntegerField(db_column='versao', default=1),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='numero',
                    field=models.CharField(db_column='numero', max_length=60),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='valor',
                    field=models.DecimalField(db_column='valor', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='nome_arquivo',
                    field=models.CharField(blank=True, db_column='nome_arquivo', default='', max_length=255),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='arquivo_nfe',
                    field=models.CharField(blank=True, db_column='nome_arquivo_nfe', default='', max_length=255),
                ),
                migrations.AlterField(
                    model_name='documentocte',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='registrado_em'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='frete',
                    field=models.ForeignKey(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='divergencias', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='documento',
                    field=models.OneToOneField(db_column='documento_id', on_delete=django.db.models.deletion.PROTECT, related_name='divergencia', to='fretes.documentocte'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='valor_referencia',
                    field=models.DecimalField(db_column='valor_referencia', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='valor_cobrado',
                    field=models.DecimalField(db_column='valor_cobrado', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='diferenca',
                    field=models.DecimalField(db_column='diferenca', decimal_places=2, max_digits=13),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='justificativa',
                    field=models.CharField(blank=True, db_column='justificativa_resolucao', default='', max_length=1000),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='tipo_resolucao',
                    field=models.CharField(blank=True, choices=[('aceite_justificado', 'Aceite justificado'), ('cte_corrigido', 'CT-e corrigido')], db_column='tipo_resolucao', default='', max_length=20),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='documento_correcao',
                    field=models.ForeignKey(blank=True, db_column='documento_correcao_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='divergencias_corrigidas', to='fretes.documentocte'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='empresa_resolvedora',
                    field=models.ForeignKey(blank=True, db_column='empresa_resolvedora_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='divergencias_resolvidas', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='criada_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criada_em'),
                ),
                migrations.AlterField(
                    model_name='divergenciafrete',
                    name='resolvida_em',
                    field=models.DateTimeField(blank=True, db_column='resolvida_em', null=True),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='frete',
                    field=models.OneToOneField(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='entrega', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='empresa_confirmadora',
                    field=models.ForeignKey(db_column='empresa_confirmadora_id', on_delete=django.db.models.deletion.PROTECT, related_name='entregas_confirmadas', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='nome_recebedor',
                    field=models.CharField(db_column='nome_recebedor', max_length=120),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='dados_assinatura',
                    field=models.TextField(db_column='imagem_assinatura'),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='tipo_recebimento',
                    field=models.CharField(choices=[('completo', 'Completo'), ('com_ressalva', 'Com ressalva')], db_column='tipo_recebimento', max_length=16),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='ressalva',
                    field=models.CharField(blank=True, db_column='ressalva', default='', max_length=1000),
                ),
                migrations.AlterField(
                    model_name='confirmacaoentrega',
                    name='confirmado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='confirmada_em'),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='frete',
                    field=models.ForeignKey(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='historico', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='autora',
                    field=models.ForeignKey(db_column='autora_id', on_delete=django.db.models.deletion.PROTECT, related_name='eventos_frete', to='empresas.empresa'),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='acao',
                    field=models.CharField(db_column='acao', max_length=40),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='situacao_anterior',
                    field=models.CharField(blank=True, db_column='situacao_anterior', default='', max_length=30),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='situacao_nova',
                    field=models.CharField(db_column='situacao_nova', max_length=30),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='chave_idempotencia',
                    field=models.CharField(db_column='chave_idempotencia', max_length=128),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='resumo_dados',
                    field=models.CharField(db_column='resumo_dados', max_length=64),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='detalhes',
                    field=models.JSONField(db_column='detalhes', default=dict),
                ),
                migrations.AlterField(
                    model_name='historicofrete',
                    name='criado_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='criado_em'),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='frete',
                    field=models.ForeignKey(db_column='frete_id', on_delete=django.db.models.deletion.PROTECT, related_name='demandas', to='fretes.frete'),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='valor_sugerido',
                    field=models.DecimalField(db_column='valor_sugerido', decimal_places=2, max_digits=12),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='janela_coleta',
                    field=models.CharField(db_column='janela_coleta', max_length=120),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='tipo_veiculo',
                    field=models.CharField(db_column='tipo_veiculo', max_length=120),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='observacoes',
                    field=models.CharField(blank=True, db_column='observacoes', default='', max_length=1000),
                ),
                migrations.AlterField(
                    model_name='demandatransporte',
                    name='publicada_em',
                    field=models.DateTimeField(auto_now_add=True, db_column='publicada_em'),
                ),
            ],
        ),
    ]
