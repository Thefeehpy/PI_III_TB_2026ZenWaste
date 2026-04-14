import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from apps.accounts.models import Empresa, SessionToken


class InventoryApiTests(TestCase):
    def setUp(self):
        self.client = Client()
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
        self.token, _token = SessionToken.create_for_user(user)

    def auth(self) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def post_json(self, path: str, payload: dict):
        return self.client.post(path, data=json.dumps(payload), content_type="application/json", **self.auth())

    def test_create_item_and_reject_outgoing_above_balance(self):
        create_response = self.post_json(
            "/api/inventory/items/",
            {
                "name": "Sucata de teste",
                "type": "Sucata Metalica",
                "quantity": 100,
                "unit": "kg",
                "targetQuantity": 250,
                "deadline": "2026-05-30",
            },
        )
        self.assertEqual(create_response.status_code, 201)
        item = create_response.json()["item"]

        invalid_movement = self.post_json(
            f"/api/inventory/items/{item['id']}/movements/",
            {"type": "saida", "quantity": 101},
        )
        self.assertEqual(invalid_movement.status_code, 400)

        valid_movement = self.post_json(
            f"/api/inventory/items/{item['id']}/movements/",
            {"type": "saida", "quantity": 40, "note": "Venda parcial"},
        )
        self.assertEqual(valid_movement.status_code, 201)
        self.assertEqual(valid_movement.json()["item"]["quantity"], 60.0)
