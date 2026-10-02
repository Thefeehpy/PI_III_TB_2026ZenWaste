from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from anuncios.models import Anuncio
from empresas.models import Empresa
from market.ai import suggest_ad_description, suggest_ad_price
from produtos.models import Produto


class MarketAiSuggestionTests(SimpleTestCase):
    def test_description_falls_back_when_ai_is_unavailable(self):
        with (
            patch("market.ai.get_anounce_ai_description", return_value=None),
            patch("market.ai.get_ai_status", return_value={"available": False, "message": "IA indisponivel."}),
        ):
            result = suggest_ad_description({
                "name": "Aparas de PEAD",
                "type": "Plastico Industrial",
                "quantity": 20,
                "unit": "kg",
            })

        self.assertEqual(result["source"], "fallback")
        self.assertFalse(result["aiAvailable"])
        self.assertEqual(result["message"], "IA indisponivel.")
        self.assertIn("Aparas de PEAD", result["description"])

    def test_price_uses_ai_number_when_available(self):
        with (
            patch("market.ai.get_anounce_price_ai_description", return_value="R$ 3,75 por kg"),
            patch("market.ai.suggested_price_for_type", return_value=Decimal("2.80")),
            patch("market.ai.get_ai_status", return_value={"available": True, "message": ""}),
        ):
            result = suggest_ad_price({"type": "Plastico Industrial"})

        self.assertEqual(result["source"], "ai")
        self.assertEqual(result["suggestedPrice"], 3.75)

    def test_price_falls_back_when_ai_does_not_return_number(self):
        with (
            patch("market.ai.get_anounce_price_ai_description", return_value="Nao tenho dados suficientes."),
            patch("market.ai.suggested_price_for_type", return_value=Decimal("2.80")),
            patch("market.ai.get_ai_status", return_value={"available": False, "message": "Gemini sem resposta."}),
        ):
            result = suggest_ad_price({"type": "Plastico Industrial"})

        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["suggestedPrice"], 2.8)
        self.assertEqual(result["message"], "Gemini sem resposta.")


class MarketAdSignalTests(TestCase):
    def test_signal_preenche_descricao_com_ia_quando_disponivel(self):
        empresa = Empresa.objects.create(
            cnpj="33444555000181",
            razao_social="Mercado Circular LTDA",
            telefone_whatsapp="11977776666",
            descricao_segmento="Reciclagem",
            email="mercado@zenwaste.com",
            senha="senha123",
        )
        produto = Produto.objects.create(
            empresa=empresa,
            tipo_produto="Plastico",
            quantidade=Decimal("10.000"),
            descricao_produto="Aparas de PEAD",
            unidade="kg",
        )

        with (
            patch("market.signals.is_ai_available", return_value=True),
            patch("market.signals.get_anounce_ai_description", return_value="Descricao gerada pela IA."),
        ):
            anuncio = Anuncio(
                produto=produto,
                preco_final=Decimal("2.80"),
                nr_qtd=Decimal("5.00"),
            )
            anuncio.publicar()

        anuncio.refresh_from_db()
        self.assertEqual(anuncio.descricao_especifica, "Descricao gerada pela IA.")
