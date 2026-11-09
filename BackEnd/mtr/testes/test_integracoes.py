from dataclasses import replace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from mtr.contratos import DocumentoSimulado, EstadoOperacaoSimulada, IntencaoSimulada, ResultadoOperacaoSimulada
from mtr.integracoes import (
    CenarioSimulado, ErroAutenticacaoSimulada, ErroConteudoConflitante,
    ErroIndisponibilidadeSimulada, ErroProvedorNaoPermitido,
    ErroReconciliacaoPendente, ErroRespostaSimuladaInvalida,
    ErroTempoEsgotadoSimulado, criar_integracao_mtr,
)


class TestesIntegracaoMTRSimulada(SimpleTestCase):
    def setUp(self):
        self.intencao = IntencaoSimulada("intencao-ficticia-1", "correlacao-ficticia-1", "a" * 64)

    def test_autenticacao_catalogo_emissao_documento_apenas_simulados(self):
        adapter = criar_integracao_mtr()
        self.assertTrue(adapter.autenticar().simulado)
        self.assertEqual(adapter.autenticar().provedor, "MOCK")
        self.assertTrue(adapter.consultar_catalogos()[0].simulado)
        self.assertEqual(adapter.validar(self.intencao), ())
        resultado = adapter.solicitar_emissao(self.intencao)
        self.assertTrue(resultado.simulado)
        self.assertTrue(resultado.referencia.startswith("MOCK-MTR-"))
        self.assertIsNone(resultado.numero_oficial)
        documento = adapter.recuperar_documento(self.intencao.identificador_interno)
        self.assertFalse(documento.oficial)
        self.assertIn(b"SEM VALOR OFICIAL", documento.conteudo)
        self.assertFalse(documento.conteudo.startswith(b"%PDF-"))

    def test_resultados_deterministicos_entre_instancias(self):
        a = criar_integracao_mtr().solicitar_emissao(self.intencao)
        b = criar_integracao_mtr().solicitar_emissao(self.intencao)
        self.assertEqual(a, b)

    def test_repeticao_compativel_nao_muda_referencia(self):
        adapter = criar_integracao_mtr()
        primeiro = adapter.solicitar_emissao(self.intencao)
        segundo = adapter.solicitar_emissao(replace(self.intencao, correlacao="nova-correlacao"))
        self.assertEqual(primeiro.referencia, segundo.referencia)
        self.assertEqual(segundo.correlacao, "nova-correlacao")

    def test_reutilizacao_de_referencia_com_outro_conteudo_rejeitada(self):
        adapter = criar_integracao_mtr()
        adapter.solicitar_emissao(self.intencao)
        with self.assertRaises(ErroConteudoConflitante):
            adapter.solicitar_emissao(replace(self.intencao, resumo_dados="b" * 64))

    def test_autenticacao_invalida_tipificada(self):
        adapter = criar_integracao_mtr(cenario=CenarioSimulado.AUTENTICACAO_INVALIDA)
        with self.assertRaises(ErroAutenticacaoSimulada):
            adapter.autenticar()
        with self.assertRaises(ErroAutenticacaoSimulada):
            adapter.solicitar_emissao(self.intencao)

    def test_timeout_exige_consulta_antes_de_repetir(self):
        adapter = criar_integracao_mtr(cenario=CenarioSimulado.TIMEOUT)
        with self.assertRaises(ErroTempoEsgotadoSimulado) as erro:
            adapter.solicitar_emissao(self.intencao)
        self.assertTrue(erro.exception.resultado_indeterminado)
        with self.assertRaises(ErroReconciliacaoPendente):
            adapter.solicitar_emissao(self.intencao)
        consultado = adapter.consultar_situacao(self.intencao.identificador_interno, "reconciliacao")
        self.assertEqual(consultado.estado, EstadoOperacaoSimulada.CONFIRMADA)
        self.assertEqual(adapter.solicitar_emissao(self.intencao).referencia, consultado.referencia)

    def test_resposta_malformada_nao_pode_virar_sucesso_otimista(self):
        adapter = criar_integracao_mtr(cenario=CenarioSimulado.RESPOSTA_MALFORMADA)
        with self.assertRaises(ErroRespostaSimuladaInvalida):
            adapter.solicitar_emissao(self.intencao)
        with self.assertRaises(ErroReconciliacaoPendente):
            adapter.recuperar_documento(self.intencao.identificador_interno)
        with self.assertRaises(ErroReconciliacaoPendente):
            adapter.solicitar_emissao(self.intencao)

    def test_indeterminado_e_pendente_sao_estados_tecnicos_distintos(self):
        for cenario, estado in ((CenarioSimulado.INDETERMINADO, EstadoOperacaoSimulada.INDETERMINADA), (CenarioSimulado.PENDENTE, EstadoOperacaoSimulada.PENDENTE)):
            with self.subTest(cenario=cenario):
                adapter = criar_integracao_mtr(cenario=cenario)
                resultado = adapter.solicitar_emissao(self.intencao)
                self.assertEqual(resultado.estado, estado)
                with self.assertRaises(ErroReconciliacaoPendente):
                    adapter.solicitar_emissao(self.intencao)
                self.assertEqual(adapter.consultar_situacao(self.intencao.identificador_interno, "revisao").estado, EstadoOperacaoSimulada.CONFIRMADA)

    def test_referencia_desconhecida_nao_inventa_operacao(self):
        adapter = criar_integracao_mtr()
        resultado = adapter.consultar_situacao("ausente", "consulta")
        self.assertEqual(resultado.estado, EstadoOperacaoSimulada.NAO_ENCONTRADA)
        with self.assertRaises(ErroReconciliacaoPendente):
            adapter.recuperar_documento("ausente")

    def test_indisponibilidade_tipificada(self):
        with self.assertRaises(ErroIndisponibilidadeSimulada):
            criar_integracao_mtr(cenario=CenarioSimulado.INDISPONIVEL).consultar_catalogos()

    def test_provedor_real_rejeitado_inclusive_configuracao(self):
        for provedor in ("HOMOLOG", "PROD", "REAL", "SIGOR", "", False):
            with self.subTest(provedor=provedor), self.assertRaises(ErroProvedorNaoPermitido):
                criar_integracao_mtr(provedor)
        with override_settings(MTR_PROVEDOR="HOMOLOG"), self.assertRaises(ErroProvedorNaoPermitido):
            criar_integracao_mtr()

    def test_dtos_nao_permitem_documento_ou_numero_oficial(self):
        with self.assertRaises(ValueError):
            ResultadoOperacaoSimulada("MOCK", "correlacao", EstadoOperacaoSimulada.CONFIRMADA, numero_oficial="indevido")
        with self.assertRaises(ValueError):
            DocumentoSimulado(b"%PDF-documento-indevido")
        with self.assertRaises(ValueError):
            DocumentoSimulado(b"texto", oficial=True)

    def test_nenhuma_requisicao_externa_nos_fluxos_simulados(self):
        with patch("socket.socket.connect", side_effect=AssertionError("Rede proibida")) as conectar, patch("socket.create_connection", side_effect=AssertionError("Rede proibida")) as criar:
            adapter = criar_integracao_mtr()
            adapter.autenticar()
            adapter.consultar_catalogos()
            adapter.solicitar_emissao(self.intencao)
            adapter.consultar_situacao(self.intencao.identificador_interno, "consulta")
            adapter.recuperar_documento(self.intencao.identificador_interno)
            for cenario in CenarioSimulado:
                teste = criar_integracao_mtr(cenario=cenario)
                try:
                    teste.solicitar_emissao(self.intencao)
                except (ErroAutenticacaoSimulada, ErroTempoEsgotadoSimulado, ErroRespostaSimuladaInvalida, ErroIndisponibilidadeSimulada):
                    pass
            conectar.assert_not_called()
            criar.assert_not_called()
