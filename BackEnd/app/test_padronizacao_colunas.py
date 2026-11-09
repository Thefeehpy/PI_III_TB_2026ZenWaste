"""Nomenclatura e ida/volta reais; executar pelo PostgreSQL descartável."""
from datetime import timedelta
from decimal import Decimal

from django.apps import apps
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader
from django.test import SimpleTestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from autenticacao.servicos import gerar_token
from fretes.test_integracao import assinatura_sintetica


CHAVES_PRIMARIAS = {
    "empresas.Empresa": "id_empresa",
    "empresas.PapelEmpresa": "id_papel_empresa",
    "empresas.EmpresaPapel": "id_empresa_papel",
    "produtos.CategoriaResiduo": "id_categoria",
    "produtos.UnidadeMedida": "id_unidade",
    "produtos.Produto": "id_produto",
    "produtos.MovimentacaoEstoque": "id_movimentacao",
    "anuncios.Anuncio": "id_anuncio",
    "anuncios.ImagemAnuncio": "id_imagem_anuncio",
    "anuncios.Reserva": "id_reserva",
    "pedidos.Pedido": "id_pedido",
    "pedidos.TentativaPagamento": "id_tentativa_pagamento",
    "pedidos.EventoWebhook": "id_evento_webhook",
    "fretes.Frete": "id_frete",
    "fretes.CotacaoFrete": "id_cotacao_frete",
    "fretes.DocumentoCTe": "id_documento_cte",
    "fretes.DivergenciaFrete": "id_divergencia_frete",
    "fretes.ConfirmacaoEntrega": "id_confirmacao_entrega",
    "fretes.HistoricoFrete": "id_historico_frete",
    "fretes.DemandaTransporte": "id_demanda_transporte",
}
MIGRACOES_ANTERIORES = [
    ("empresas", "0003_empresa_unique_empresa_email_lower"),
    ("produtos", "0011_nomenclatura_portugues"),
    ("anuncios", "0013_anuncio_anuncio_ativo_com_quantidade"),
    ("pedidos", "0007_ajustar_relacionamentos_restricoes"),
    ("fretes", "0002_resolucao_divergencia_cancelamento"),
]
MIGRACOES_PADRONIZACAO = [
    ("empresas", "0004_padronizar_colunas_preservando_pks"),
    ("produtos", "0012_padronizar_colunas_preservando_pks"),
    ("anuncios", "0014_padronizar_colunas_preservando_pks"),
    ("pedidos", "0008_padronizar_colunas_preservando_pks"),
    ("fretes", "0003_padronizar_colunas_preservando_pks"),
]


class TestesContratosPadronizacao(SimpleTestCase):
    def test_as_vinte_pks_mantem_os_nomes_fisicos_originais(self):
        for rotulo, coluna in CHAVES_PRIMARIAS.items():
            with self.subTest(model=rotulo):
                self.assertEqual(apps.get_model(rotulo)._meta.pk.column, coluna)

    def test_fks_seguem_a_relacao_python_sem_colisoes(self):
        quantidade = 0
        for rotulo in CHAVES_PRIMARIAS:
            campos = apps.get_model(rotulo)._meta.local_fields
            self.assertEqual(len(campos), len({campo.column for campo in campos}))
            for campo in campos:
                if campo.is_relation:
                    quantidade += 1
                    self.assertEqual(campo.column, campo.attname)
                    self.assertTrue(campo.column.endswith("_id"))
        self.assertEqual(quantidade, 31)

    def test_migrations_apenas_renomeiam_180_colunas_sem_tocar_nas_pks(self):
        carregador = MigrationLoader(None)
        quantidade = 0
        for chave in MIGRACOES_PADRONIZACAO:
            migracao = carregador.disk_migrations[chave]
            self.assertEqual(len(migracao.operations), 1)
            separacao = migracao.operations[0]
            self.assertEqual(type(separacao).__name__, "SeparateDatabaseAndState")
            self.assertEqual(len(separacao.database_operations), len(separacao.state_operations))
            for banco, estado in zip(separacao.database_operations, separacao.state_operations):
                modelo = apps.get_model(chave[0], estado.model_name)
                self.assertFalse(modelo._meta.get_field(estado.name).primary_key)
                self.assertRegex(banco.sql, r'^ALTER TABLE "\w+" RENAME COLUMN "\w+" TO "\w+";$')
                self.assertRegex(banco.reverse_sql, r'^ALTER TABLE "\w+" RENAME COLUMN "\w+" TO "\w+";$')
                quantidade += 1
        self.assertEqual(quantidade, 180)


def preparar_dados(estado):
    """Preenche os vinte models históricos sem importar métodos atuais."""
    def modelo(rotulo):
        return estado.apps.get_model(rotulo)

    empresas = []
    for indice, papel in enumerate(("vendedora", "compradora", "transportadora"), 1):
        empresa = modelo("empresas.Empresa").objects.create(
            cnpj=f"{indice:014d}", razao_social=f"Empresa de migração {indice}",
            telefone_whatsapp=f"110000000{indice:02d}", email=f"migracao-{indice}@example.test",
            senha="hash-sintetico-sem-login",
        )
        cargo, _ = modelo("empresas.PapelEmpresa").objects.get_or_create(codigo=papel, defaults={"descricao": papel})
        modelo("empresas.EmpresaPapel").objects.create(empresa=empresa, papel=cargo)
        empresas.append(empresa)
    vendedora, compradora, transportadora = empresas
    categoria = modelo("produtos.CategoriaResiduo").objects.create(nome_material="Material da migração")
    unidade = modelo("produtos.UnidadeMedida").objects.create(sigla="ensaio", descricao="Unidade sintética")
    produto = modelo("produtos.Produto").objects.create(
        empresa=vendedora, categoria=categoria, unidade_medida=unidade,
        nome_residuo="Material de teste", quantidade=Decimal("100.000"), situacao="disponivel",
    )
    modelo("produtos.MovimentacaoEstoque").objects.create(produto=produto, tipo="entrada", quantidade=100, saldo_resultante=100)
    anuncio = modelo("anuncios.Anuncio").objects.create(produto=produto, preco_final=2, nr_qtd=100)
    modelo("anuncios.ImagemAnuncio").objects.create(anuncio=anuncio, url_arquivo="https://example.test/migracao.png", eh_capa=True)
    pedido = modelo("pedidos.Pedido").objects.create(
        numero="ZW-MIGRACAO", empresa_compradora=compradora, anuncio=anuncio, situacao="paid",
        quantidade=2, preco_unitario=2, valor_total=4, nome_comprador="Compradora sintética",
        email_comprador=compradora.email, documento_comprador=compradora.cnpj,
        telefone_comprador=compradora.telefone_whatsapp, nome_material_negociado="Material negociado",
        unidade_material_negociado="ensaio", chave_idempotencia_criacao="pedido-migracao",
        resumo_dados_criacao="a" * 64, reserva_expira_em=timezone.now() + timedelta(days=1),
    )
    modelo("anuncios.Reserva").objects.create(
        pedido=pedido, produto=produto, empresa_compradora=compradora, modalidade="compromisso",
        situacao="finalizada", quantidade_reservada=2, preco_unitario=2,
        nome_comprador="Compradora sintética", numero_comprador=compradora.telefone_whatsapp,
    )
    pagamento = modelo("pedidos.TentativaPagamento").objects.create(
        pedido=pedido, provedor="ensaio", metodo="pix", situacao="paid", chave_idempotencia="pagamento-migracao",
        resumo_dados_requisicao="b" * 64, valor_centavos=400,
    )
    modelo("pedidos.EventoWebhook").objects.create(provedor="ensaio", identificador_externo="evento-migracao", pagamento=pagamento, processado=True)
    frete = modelo("fretes.Frete").objects.create(
        pedido=pedido, empresa_vendedora=vendedora, empresa_compradora=compradora,
        transportadora=transportadora, numero_pedido=pedido.numero, origem_cadastro="pedido",
        material="Material negociado", unidade="ensaio", quantidade=1, origem="Origem", destino="Destino",
        peso_toneladas=1, cubagem_m3=1, quantidade_volumes=1, situacao="com_divergencia",
        modalidade="cotar", valor_referencia=500, retirado_em=timezone.now(),
    )
    modelo("fretes.CotacaoFrete").objects.create(frete=frete, transportadora=transportadora, valor=500, prazo_dias=2, aprovada=True)
    original = modelo("fretes.DocumentoCTe").objects.create(frete=frete, versao=1, numero="CTE-ORIGINAL", valor=650)
    correcao = modelo("fretes.DocumentoCTe").objects.create(frete=frete, versao=2, numero="CTE-CORRIGIDO", valor=620)
    modelo("fretes.DivergenciaFrete").objects.create(
        frete=frete, documento=original, valor_referencia=500, valor_cobrado=650, diferenca=150,
        tipo_resolucao="cte_corrigido", documento_correcao=correcao,
        empresa_resolvedora=vendedora, resolvida_em=timezone.now(),
    )
    modelo("fretes.DivergenciaFrete").objects.create(frete=frete, documento=correcao, valor_referencia=500, valor_cobrado=620, diferenca=120)
    modelo("fretes.ConfirmacaoEntrega").objects.create(
        frete=frete, empresa_confirmadora=compradora, nome_recebedor="Recebedor sintético",
        dados_assinatura=assinatura_sintetica(), tipo_recebimento="completo",
    )
    modelo("fretes.HistoricoFrete").objects.create(
        frete=frete, autora=vendedora, acao="registrar-cte", situacao_nova="com_divergencia",
        chave_idempotencia="historico-migracao", resumo_dados="c" * 64, detalhes={"versao": 2},
    )
    modelo("fretes.DemandaTransporte").objects.create(frete=frete, valor_sugerido=500, janela_coleta="A combinar", tipo_veiculo="Caminhão")
    return {"vendedora": vendedora.pk, "compradora": compradora.pk, "pedido": pedido.pk, "frete": frete.pk, "produto": produto.pk}


def capturar_dados(registro):
    return {
        rotulo: list(registro.get_model(rotulo).objects.order_by("pk").values(
            *[campo.attname for campo in registro.get_model(rotulo)._meta.local_fields]
        )) for rotulo in CHAVES_PRIMARIAS
    }


def capturar_estrutura():
    consultas = {
        "tabelas": "SELECT oid,relname,relfilenode FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY oid",
        "constraints": "SELECT oid,conrelid,contype,conkey,confkey,confrelid,conindid,convalidated,conbin::text FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY oid",
        "indices": "SELECT indexrelid,indrelid,indkey::text,indisunique,indisvalid,indpred::text,indexprs::text FROM pg_index WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY indexrelid",
        "sequencias": "SELECT objid,refobjid,refobjsubid,deptype FROM pg_depend WHERE classid='pg_class'::regclass AND objid IN (SELECT oid FROM pg_class WHERE relkind='S' AND relnamespace='public'::regnamespace) AND deptype IN ('a','i') ORDER BY objid",
        "pks": "SELECT c.relname,a.attname FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(k.conkey) WHERE k.contype='p' AND c.relnamespace='public'::regnamespace ORDER BY c.relname,a.attnum",
        "triggers": "SELECT oid,tgrelid,tgfoid,tgenabled,tgisinternal FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY oid",
    }
    resultado = {}
    with connection.cursor() as cursor:
        for nome, consulta in consultas.items():
            cursor.execute(consulta)
            resultado[nome] = cursor.fetchall()
    return resultado


class TestesMigracaoPadronizacao(TransactionTestCase):
    def test_ida_volta_preservam_dados_pks_relacoes_indices_e_api(self):
        self.assertEqual(connection.vendor, "postgresql")
        self.assertTrue(connection.settings_dict["NAME"].startswith("test_zenwaste_fretes_"), "Use o executor PostgreSQL descartável.")
        atuais = MigrationExecutor(connection).loader.graph.leaf_nodes()
        try:
            executor = MigrationExecutor(connection)
            executor.migrate(MIGRACOES_ANTERIORES)
            estado_antigo = executor.loader.project_state(MIGRACOES_ANTERIORES)
            identificadores = preparar_dados(estado_antigo)
            antes = capturar_dados(estado_antigo.apps)
            self.assertTrue(all(antes.values()))
            estrutura = capturar_estrutura()

            MigrationExecutor(connection).migrate(atuais)
            self.assertEqual(capturar_dados(apps), antes)
            self.assertEqual(capturar_estrutura(), estrutura)
            with connection.cursor() as cursor:
                for rotulo in CHAVES_PRIMARIAS:
                    modelo = apps.get_model(rotulo)
                    colunas = {coluna.name for coluna in connection.introspection.get_table_description(cursor, modelo._meta.db_table)}
                    self.assertEqual(colunas, {campo.column for campo in modelo._meta.local_fields})

            for caminho, empresa in [
                ("/api/auth/me/", "vendedora"), ("/api/inventory/items/", "vendedora"),
                ("/api/marketplace/ads/", "vendedora"), ("/api/orders/", "compradora"),
                (f"/api/orders/{identificadores['pedido']}/", "compradora"),
                ("/api/fretes/", "vendedora"), (f"/api/fretes/{identificadores['frete']}/", "vendedora"),
                ("/api/fretes/demandas/", "vendedora"), ("/api/fretes/pedidos-disponiveis/", "vendedora"),
            ]:
                cliente = APIClient()
                cliente.credentials(HTTP_AUTHORIZATION="Bearer " + gerar_token(apps.get_model("empresas.Empresa").objects.get(pk=identificadores[empresa])))
                resposta = cliente.get(caminho)
                self.assertEqual(resposta.status_code, 200, caminho)
            self.assertEqual(capturar_dados(apps), antes)
            produto = apps.get_model("produtos.Produto")
            for alteracao in ({"quantidade": -1}, {"empresa_id": 987654321}):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    produto.objects.filter(pk=identificadores["produto"]).update(**alteracao)
                    connection.check_constraints()
            with self.assertRaises(IntegrityError), transaction.atomic():
                apps.get_model("empresas.PapelEmpresa").objects.create(codigo="vendedora", descricao="Duplicada")

            empresa = apps.get_model("empresas.Empresa")
            maior_id = max(empresa.objects.values_list("pk", flat=True))
            adicional = empresa.objects.create(cnpj="99999999999999", razao_social="Empresa adicional", telefone_whatsapp="11999999999", email="adicional@example.test", senha="sem-login")
            self.assertGreater(adicional.pk, maior_id)
            adicional.delete()

            executor = MigrationExecutor(connection)
            executor.migrate(MIGRACOES_ANTERIORES)
            estado_revertido = executor.loader.project_state(MIGRACOES_ANTERIORES)
            self.assertEqual(capturar_dados(estado_revertido.apps), antes)
            self.assertEqual(capturar_estrutura(), estrutura)
            MigrationExecutor(connection).migrate(atuais)
            self.assertEqual(capturar_dados(apps), antes)
            self.assertEqual(capturar_estrutura(), estrutura)
        finally:
            MigrationExecutor(connection).migrate(atuais)
