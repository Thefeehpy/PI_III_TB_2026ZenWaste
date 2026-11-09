import hashlib
import json

from django.apps import apps
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader
from django.test import SimpleTestCase, TransactionTestCase

from fretes.test_integracao import CenarioFretes


MIGRACAO = ("mtr", "0001_catalogo_ibama")


class TestesPlanoMigracaoMTR(SimpleTestCase):
    def test_migracao_exclusivamente_aditiva_sem_dependencias_comerciais(self):
        migracao = MigrationLoader(None).disk_migrations[MIGRACAO]
        self.assertEqual(migracao.dependencies, [])
        for operacao in migracao.operations:
            self.assertIn(type(operacao).__name__, {"CreateModel", "AddIndex", "AddConstraint"})


class TestesMigracaoMTR(CenarioFretes, TransactionTestCase):
    def test_ida_volta_em_postgresql_sem_alterar_tabelas_comerciais(self):
        self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        def snapshot_comercial():
            resultado = {}
            for model in apps.get_models():
                if model._meta.app_label in {"empresas", "produtos", "anuncios", "pedidos", "fretes"}:
                    linhas = list(model.objects.order_by(model._meta.pk.name).values())
                    resultado[model._meta.db_table] = hashlib.sha256(json.dumps(linhas, default=str, sort_keys=True).encode()).hexdigest()
            return resultado

        antes = snapshot_comercial()
        try:
            MigrationExecutor(connection).migrate([("mtr", None)])
            self.assertNotIn("mtr_versaocatalogoibama", connection.introspection.table_names())
            executor = MigrationExecutor(connection)
            executor.migrate([MIGRACAO])
            estado = executor.loader.project_state([MIGRACAO])
            Versao = estado.apps.get_model("mtr", "VersaoCatalogoIBAMA")
            Codigo = estado.apps.get_model("mtr", "CodigoResiduoIBAMA")
            versao = Versao.objects.create(fonte="fixture-historica", versao="teste", referencia_fonte="FICTICIA", sha256_arquivo="a" * 64, simulado=True)
            codigo = Codigo.objects.create(catalogo=versao, codigo="000001", codigo_busca="000001", descricao="FICTICIO")
            with connection.cursor() as cursor:
                colunas = {c.name for c in connection.introspection.get_table_description(cursor, Codigo._meta.db_table)}
            self.assertIn("id_codigo_residuo_ibama", colunas)
            self.assertIn("catalogo_id", colunas)
            self.assertEqual(Codigo.objects.get(pk=codigo.pk).catalogo_id, versao.pk)
            self.assertEqual(snapshot_comercial(), antes)
            MigrationExecutor(connection).migrate([("mtr", None)])
            self.assertNotIn("mtr_codigoresiduoibama", connection.introspection.table_names())
            self.assertEqual(snapshot_comercial(), antes)
        finally:
            MigrationExecutor(connection).migrate([MIGRACAO])
        self.assertEqual(snapshot_comercial(), antes)
