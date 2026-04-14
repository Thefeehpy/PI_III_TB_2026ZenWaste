import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from apps.accounts.models import Empresa, SessionToken
from apps.inventory.models import CategoriaResiduo, Produto, Reserva, UnidadeMedida


class MarketplaceApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        user = get_user_model().objects.create_user(
            username="market@example.com",
            email="market@example.com",
            password="senha12345",
        )
        self.company = Empresa.objects.create(
            user=user,
            razao_social="Empresa Marketplace",
            cnpj="22333444000181",
            descricao_segmento="Papel e Celulose",
            telefone_whatsapp="41999990000",
        )
        self.token, _token = SessionToken.create_for_user(user)
        category = CategoriaResiduo.objects.create(nome_material="Papel e Papelao")
        unit = UnidadeMedida.objects.create(sigla_unidade="kg", descricao_unidade="kg")
        reserve = Reserva.objects.create(status_meta="em_aberto", qntd_reserva=1000)
        self.item = Produto.objects.create(
            empresa=self.company,
            nome_residuo="Papelao teste",
            categoria_residuo=category,
            quantidade_total=500,
            unidade=unit,
            reserva=reserve,
        )

    def auth(self) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def post_json(self, path: str, payload: dict):
        return self.client.post(path, data=json.dumps(payload), content_type="application/json", **self.auth())

    def test_publish_ad_from_inventory_and_list_public_marketplace(self):
        create_response = self.post_json(
            "/api/marketplace/ads/",
            {
                "inventoryId": str(self.item.id_produto),
                "name": "Papelao disponivel",
                "type": self.item.categoria_residuo.nome_material,
                "description": "Fardos limpos.",
                "quantity": 300,
                "unit": "kg",
                "price": 0.45,
                "location": "Curitiba - PR",
            },
        )
        self.assertEqual(create_response.status_code, 201)

        list_response = self.client.get("/api/marketplace/ads/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()["items"]), 1)
        self.assertIn("whatsappUrl", list_response.json()["items"][0])

    def test_reject_ad_quantity_above_inventory_balance(self):
        response = self.post_json(
            "/api/marketplace/ads/",
            {
                "inventoryId": str(self.item.id_produto),
                "name": "Papelao acima do saldo",
                "type": self.item.categoria_residuo.nome_material,
                "description": "Nao deve publicar.",
                "quantity": 600,
                "unit": "kg",
                "price": 0.45,
                "location": "Curitiba - PR",
            },
        )

        self.assertEqual(response.status_code, 400)
