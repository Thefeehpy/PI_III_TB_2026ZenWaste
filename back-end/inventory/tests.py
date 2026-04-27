from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Empresa, SessionToken


class InventoryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(
            username="estoque@example.com",
            email="estoque@example.com",
            password="senha12345",
        )
        Empresa.objects.create(
            user=user,
            razao_social="Empresa Estoque",
            cnpj="11222333000181",
            descricao_segmento="Metalurgia",
            telefone_whatsapp="11999990000",
        )
        token, _token = SessionToken.create_for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_create_item_and_reject_outgoing_above_balance(self):
        create_response = self.client.post(
            "/api/inventory/items/",
            {
                "name": "Sucata de teste",
                "type": "Sucata Metalica",
                "quantity": 100,
                "unit": "kg",
                "targetQuantity": 250,
                "deadline": "2026-05-30",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        item = create_response.data["item"]

        invalid_movement = self.client.post(
            f"/api/inventory/items/{item['id']}/movements/",
            {"type": "saida", "quantity": 101},
            format="json",
        )
        self.assertEqual(invalid_movement.status_code, 400)

        valid_movement = self.client.post(
            f"/api/inventory/items/{item['id']}/movements/",
            {"type": "saida", "quantity": 40, "note": "Venda parcial"},
            format="json",
        )
        self.assertEqual(valid_movement.status_code, 201)
        self.assertEqual(valid_movement.data["item"]["quantity"], 60.0)
