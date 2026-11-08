from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase

from mercado.inteligencia_artificial import sugerir_descricao_anuncio, sugerir_preco_anuncio


class IntegracaoIASimulada:
    def __init__(self, *, descricao=None, preco=None, disponivel=False, mensagem=""):
        self.resultado_descricao = descricao
        self.resultado_preco = preco
        self.resultado_situacao = {"available": disponivel, "message": mensagem}
        self.contexto_descricao = None
        self.contexto_preco = None

    def descricao(self, contexto):
        self.contexto_descricao = contexto
        return self.resultado_descricao

    def preco(self, contexto):
        self.contexto_preco = contexto
        return self.resultado_preco

    def situacao(self):
        return self.resultado_situacao.copy()


class TestesSugestoesIA(SimpleTestCase):
    def test_descricao_alternativa_quando_ia_indisponivel(self):
        integracao = IntegracaoIASimulada(mensagem="IA indisponivel.")
        resultado = sugerir_descricao_anuncio({
            "name": "Aparas de PEAD",
            "type": "Plastico Industrial",
            "quantity": 20,
            "unit": "kg",
        }, integracao=integracao)

        self.assertEqual(resultado["source"], "fallback")
        self.assertFalse(resultado["aiAvailable"])
        self.assertEqual(resultado["message"], "IA indisponivel.")
        self.assertIn("Aparas de PEAD", resultado["description"])

    def test_preco_usa_valor_da_ia(self):
        integracao = IntegracaoIASimulada(preco="R$ 3,75 por kg", disponivel=True)
        with patch("mercado.inteligencia_artificial.preco_sugerido_categoria", return_value=Decimal("2.80")):
            resultado = sugerir_preco_anuncio({"type": "Plastico Industrial"}, integracao=integracao)

        self.assertEqual(resultado["source"], "ai")
        self.assertEqual(resultado["suggestedPrice"], 3.75)

    def test_preco_alternativo_quando_ia_sem_numero(self):
        integracao = IntegracaoIASimulada(preco="Nao tenho dados suficientes.", mensagem="Gemini sem resposta.")
        with patch("mercado.inteligencia_artificial.preco_sugerido_categoria", return_value=Decimal("2.80")):
            resultado = sugerir_preco_anuncio({"type": "Plastico Industrial"}, integracao=integracao)

        self.assertEqual(resultado["source"], "fallback")
        self.assertEqual(resultado["suggestedPrice"], 2.8)
        self.assertEqual(resultado["message"], "Gemini sem resposta.")

    def test_preco_nao_positivo_usa_referencia_mercado(self):
        integracao = IntegracaoIASimulada(preco="0,00", disponivel=True)
        with patch("mercado.inteligencia_artificial.preco_sugerido_categoria", return_value=Decimal("2.80")):
            resultado = sugerir_preco_anuncio({"type": "Plastico Industrial"}, integracao=integracao)

        self.assertEqual(resultado["source"], "fallback")
        self.assertEqual(resultado["suggestedPrice"], 2.8)

    def test_integracao_injetada_recebe_contexto_sem_provedor_padrao(self):
        integracao = IntegracaoIASimulada(descricao="Material disponivel para negociacao.", disponivel=True)
        with patch("mercado.inteligencia_artificial.obter_integracao_ia", side_effect=AssertionError("O provedor padrao nao deve ser utilizado")):
            resultado = sugerir_descricao_anuncio({
                "name": "Retalhos de aluminio",
                "quantity": "15.125",
                "unit": "kg",
                "location": "Araras",
            }, integracao=integracao)

        self.assertEqual(resultado["source"], "ai")
        self.assertEqual(resultado["description"], "Material disponivel para negociacao.")
        self.assertIn("15.125 kg", integracao.contexto_descricao)
        self.assertIn("Araras", integracao.contexto_descricao)
