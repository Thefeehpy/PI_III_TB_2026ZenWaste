from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase

from market.ai import suggest_ad_description, suggest_ad_price


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
