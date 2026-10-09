from decimal import Decimal
from unittest.mock import Mock

from django.test import SimpleTestCase, TestCase

from assistente_ia.engine import recommend_freight, suggest_ad_description
from assistente_ia.models import AssistenteIA
from empresas.models import Empresa


class AssistenteIAEngineTests(SimpleTestCase):
    def test_description_has_safe_fallback_without_provider(self):
        manager = Mock()
        manager.get_anounce_ai_description.return_value = None
        manager.get_ai_status.return_value = {"available": False, "message": "indisponível"}

        result = suggest_ad_description({"name": "Aparas", "type": "Plástico"}, ai_manager=manager)

        self.assertEqual(result["source"], "fallback")
        self.assertIn("Aparas", result["description"])

    def test_freight_recommendation_calculates_vehicle_and_value(self):
        manager = Mock()
        manager.get_freight_recommendation.return_value = None
        manager.get_ai_status.return_value = {"available": False, "message": "sem chave"}

        result = recommend_freight(
            {"material": "Vidro", "distanceKm": 100, "weightTon": 8, "cubicMeters": 20},
            ai_manager=manager,
        )

        self.assertEqual(result["vehicleType"], "Truck")
        self.assertEqual(result["suggestedValue"], 950.0)
        self.assertEqual(result["source"], "fallback")


class AssistenteIAModelTests(TestCase):
    def test_execution_keeps_auditable_result(self):
        empresa = Empresa.objects.create(
            cnpj="11222333000181",
            razao_social="IA Circular",
            telefone_whatsapp="11911110000",
            email="ia@zenwaste.test",
            senha="hash",
        )
        execution = AssistenteIA.objects.create(
            empresa=empresa,
            sugestao_preco=Decimal("2.50"),
            status_ia=AssistenteIA.Status.FALLBACK,
            fonte=AssistenteIA.Fonte.FALLBACK,
            contexto={"type": "Papel"},
        )

        self.assertEqual(execution.empresa, empresa)
        self.assertEqual(execution.sugestao_preco, Decimal("2.50"))
