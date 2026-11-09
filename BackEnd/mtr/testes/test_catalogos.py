from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
import json
from unittest.mock import patch

from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase

from mtr.catalogos import buscar_codigos, importar_catalogo_json, ler_catalogo_json
from mtr.dominio import ErroValidacaoMTR
from mtr.models import CodigoResiduoIBAMA, VersaoCatalogoIBAMA


FIXTURE = Path(__file__).with_name("fixtures") / "catalogo_ficticio.json"


def conteudo_teste(**alteracoes):
    dados = json.loads(FIXTURE.read_bytes())
    dados.update(alteracoes)
    return json.dumps(dados).encode()


class BancoIsoladoMTR:
    def setUp(self):
        super().setUp()
        self.assertEqual(connection.vendor, "postgresql")
        self.assertTrue(connection.settings_dict["NAME"].startswith("test_zenwaste_fretes_"), "Use o executor PostgreSQL descartável existente.")


class TestesCatalogosMTR(BancoIsoladoMTR, TestCase):
    def test_importa_versao_preservando_codigo_marcador_origem(self):
        resultado = importar_catalogo_json(FIXTURE.read_bytes())
        catalogo = VersaoCatalogoIBAMA.objects.get(pk=resultado.catalogo_id)
        self.assertTrue(resultado.criado)
        self.assertTrue(catalogo.simulado)
        self.assertIn("SEM VALOR OFICIAL", catalogo.referencia_fonte)
        self.assertEqual(list(catalogo.codigos.values_list("codigo", flat=True)), ["000001", "000002(*)"])
        self.assertIsNone(catalogo.codigos.get(codigo="000001").perigoso)
        self.assertTrue(catalogo.codigos.get(codigo="000002(*)").perigoso)

    def test_repeticao_nao_recria_nem_altera_data(self):
        conteudo = FIXTURE.read_bytes()
        primeiro = importar_catalogo_json(conteudo)
        data = VersaoCatalogoIBAMA.objects.get(pk=primeiro.catalogo_id).importado_em
        segundo = importar_catalogo_json(conteudo)
        self.assertFalse(segundo.criado)
        self.assertEqual(primeiro.catalogo_id, segundo.catalogo_id)
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 2)
        self.assertEqual(VersaoCatalogoIBAMA.objects.get().importado_em, data)

    def test_nova_versao_preserva_historico(self):
        antigo = importar_catalogo_json(conteudo_teste())
        novo = importar_catalogo_json(conteudo_teste(versao="teste-2"))
        self.assertNotEqual(antigo.catalogo_id, novo.catalogo_id)
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 2)
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 4)

    def test_versao_existente_com_conteudo_diferente_nao_sobrescreve(self):
        importar_catalogo_json(conteudo_teste())
        dados = json.loads(conteudo_teste())
        dados["codigos"][0]["descricao"] = "FICTICIO: alterado"
        with self.assertRaises(ErroValidacaoMTR) as erro:
            importar_catalogo_json(json.dumps(dados).encode())
        self.assertEqual(erro.exception.codigo, "versao_conflitante")
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 2)
        self.assertNotIn("alterado", CodigoResiduoIBAMA.objects.first().descricao)

    def test_rejeita_duplicata_e_alias_de_marcador_antes_de_persistir(self):
        for codigo in ("000001", "000002*"):
            dados = json.loads(conteudo_teste())
            dados["codigos"].append({"codigo": codigo, "descricao": "FICTICIO: duplicado", "perigoso": "*" in codigo})
            with self.subTest(codigo=codigo), self.assertRaises(ErroValidacaoMTR):
                importar_catalogo_json(json.dumps(dados).encode())
            self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 0)

    def test_arquivo_invalido_e_json_com_chaves_repetidas(self):
        for conteudo in (b"", b"\xff", b"[]", b"{", b'{"formato": 1, "formato": 2}', b"NaN", b"x" * (5 * 1024 * 1024 + 1)):
            with self.subTest(tamanho=len(conteudo)), self.assertRaises(ErroValidacaoMTR):
                importar_catalogo_json(conteudo)
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 0)

    def test_fonte_oficial_nao_validada_permanece_bloqueada(self):
        with self.assertRaises(ErroValidacaoMTR) as erro:
            importar_catalogo_json(conteudo_teste(simulado=False))
        self.assertEqual(erro.exception.codigo, "fonte_oficial_pendente")
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 0)

    def test_indicacao_de_perigo_inconsistente_rejeitada(self):
        for valor in (False, None, "sim", 1):
            dados = json.loads(conteudo_teste())
            dados["codigos"][1]["perigoso"] = valor
            with self.subTest(valor=valor), self.assertRaises(ErroValidacaoMTR):
                importar_catalogo_json(json.dumps(dados).encode())
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 0)

    def test_busca_por_codigo_descricao_e_simulacao_explicita(self):
        resultado = importar_catalogo_json(conteudo_teste())
        self.assertEqual(list(buscar_codigos(resultado.catalogo_id)), [])
        por_codigo = list(buscar_codigos(resultado.catalogo_id, "000002(*)", incluir_simulados=True))
        self.assertEqual([x.codigo for x in por_codigo], ["000002(*)"])
        self.assertEqual(len(list(buscar_codigos(resultado.catalogo_id, "material", incluir_simulados=True))), 1)
        self.assertEqual(len(list(buscar_codigos(resultado.catalogo_id, incluir_simulados=True, limite=1))), 1)

    def test_vigencia_inativa_preserva_registros_sem_reativar_na_repeticao(self):
        conteudo = conteudo_teste()
        resultado = importar_catalogo_json(conteudo)
        VersaoCatalogoIBAMA.objects.filter(pk=resultado.catalogo_id).update(vigente=False)
        importar_catalogo_json(conteudo)
        self.assertEqual(list(buscar_codigos(resultado.catalogo_id, incluir_simulados=True)), [])
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 2)

    def test_detecta_item_persistido_alterado_sem_reescrever_historico(self):
        conteudo = conteudo_teste()
        importar_catalogo_json(conteudo)
        CodigoResiduoIBAMA.objects.filter(codigo="000001").update(descricao="FICTICIO: alteracao direta inconsistente")
        with self.assertRaises(ErroValidacaoMTR) as erro:
            importar_catalogo_json(conteudo)
        self.assertEqual(erro.exception.codigo, "versao_conflitante")

    def test_consulta_rejeita_limite_e_identificador_invalidos(self):
        for identificador, limite in ((True, 10), ("abc", 10), (0, 10), (1, True), (1, 101)):
            with self.subTest(identificador=identificador, limite=limite), self.assertRaises(ErroValidacaoMTR):
                buscar_codigos(identificador, limite=limite)

    def test_falha_na_gravacao_de_itens_reverte_versao(self):
        with patch("mtr.catalogos.CodigoResiduoIBAMA.objects.bulk_create", side_effect=RuntimeError("falha sintética")):
            with self.assertRaises(RuntimeError):
                importar_catalogo_json(conteudo_teste())
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 0)
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 0)

    def test_unicidade_fisica_no_postgresql_e_nomes_das_chaves(self):
        resultado = importar_catalogo_json(conteudo_teste())
        with self.assertRaises(IntegrityError), transaction.atomic():
            CodigoResiduoIBAMA.objects.create(catalogo_id=resultado.catalogo_id, codigo="000001", codigo_busca="000001", descricao="FICTICIO")
        self.assertEqual(VersaoCatalogoIBAMA._meta.pk.column, "id_versao_catalogo_ibama")
        self.assertEqual(CodigoResiduoIBAMA._meta.pk.column, "id_codigo_residuo_ibama")
        self.assertEqual(CodigoResiduoIBAMA._meta.get_field("catalogo").column, "catalogo_id")


class TestesConcorrenciaCatalogoMTR(BancoIsoladoMTR, TransactionTestCase):
    def test_duas_importacoes_simultaneas_mesma_versao(self):
        barreira = Barrier(2)

        def importar():
            close_old_connections()
            try:
                barreira.wait(timeout=10)
                return importar_catalogo_json(conteudo_teste()).catalogo_id
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            resultados = list(executor.map(lambda _: importar(), range(2)))
        self.assertEqual(resultados[0], resultados[1])
        self.assertEqual(VersaoCatalogoIBAMA.objects.count(), 1)
        self.assertEqual(CodigoResiduoIBAMA.objects.count(), 2)
