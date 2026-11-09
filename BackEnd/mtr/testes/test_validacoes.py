from datetime import datetime, timezone
from decimal import Decimal

from django.test import SimpleTestCase

from mtr.dominio import CampoPreenchimento, ErroValidacaoMTR, PrePreenchimentoMTR, SituacaoInformacao
from mtr.validacoes import unidade_comercial_reconhecida, validar_codigo_ibama, validar_quantidade_comercial, validar_texto


class TestesValidacoesMTR(SimpleTestCase):
    def test_codigo_textual_preserva_zeros_e_marcador(self):
        self.assertEqual(validar_codigo_ibama("000001"), "000001")
        self.assertEqual(validar_codigo_ibama("000002(*)"), "000002*")
        self.assertEqual(validar_codigo_ibama("000002*"), "000002*")

    def test_codigo_rejeita_numero_formato_e_texto_extra(self):
        for valor in (1, True, None, "", "12345", "000001\n", " 000001", "GRUPO A", "000001**"):
            with self.subTest(valor=valor), self.assertRaises(ErroValidacaoMTR):
                validar_codigo_ibama(valor)

    def test_quantidade_valida_e_precisao_comercial(self):
        self.assertEqual(validar_quantidade_comercial("7.125"), Decimal("7.125"))
        self.assertEqual(validar_quantidade_comercial(0, permitir_zero=True), 0)
        self.assertEqual(validar_quantidade_comercial(Decimal("1.0000")), 1)

    def test_quantidade_rejeita_nao_finito_bool_e_precisao_invalida(self):
        for valor in (True, None, 1.5, "", "NaN", "Infinity", "-1", "0", "0.0001", "1000000000"):
            with self.subTest(valor=valor), self.assertRaises(ErroValidacaoMTR):
                validar_quantidade_comercial(valor)

    def test_unidade_reconhecida_nao_equivale_a_codigo_sigor(self):
        self.assertTrue(unidade_comercial_reconhecida("kg", ["KG", "T"]))
        self.assertFalse(unidade_comercial_reconhecida("ZZ", ["KG"]))

    def test_texto_vazio_controle_e_limite(self):
        for valor in (None, " ", "\n", "ABCDE"):
            with self.subTest(valor=valor), self.assertRaises(ErroValidacaoMTR):
                validar_texto(valor, "campo", limite=4)

    def test_objeto_rejeita_disponivel_sem_valor_e_inferencia(self):
        with self.assertRaises(ErroValidacaoMTR):
            CampoPreenchimento("peso", None, None, None, SituacaoInformacao.DISPONIVEL)
        with self.assertRaises(ErroValidacaoMTR):
            CampoPreenchimento("destinador", "compradora", None, None, SituacaoInformacao.NAO_INFERIR)

    def test_objeto_rejeita_campos_duplicados(self):
        campo = CampoPreenchimento("material", "teste", "Frete.material", "1", SituacaoInformacao.DISPONIVEL)
        with self.assertRaises(ErroValidacaoMTR):
            PrePreenchimentoMTR("1", 1, datetime.now(timezone.utc), (campo, campo))
