from decimal import Decimal

from django.test import TestCase
from rest_framework import serializers
from rest_framework.test import APIClient

from authentication.services import make_token
from empresas.models import Empresa
from produtos.models import MovimentacaoEstoque, Produto
from produtos.services import register_inventory_movement


class InventoryTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.empresa_a = Empresa.objects.create(
            cnpj="00.000.000/0001-00",
            razao_social="Empresa A",
            telefone_whatsapp="11999990001",
            descricao_segmento="Reciclagem",
            email="empresa-a@example.com",
            senha="senha123",
        )
        self.empresa_b = Empresa.objects.create(
            cnpj="00.000.000/0002-00",
            razao_social="Empresa B",
            telefone_whatsapp="11999990002",
            descricao_segmento="Industria",
            email="empresa-b@example.com",
            senha="senha123",
        )
        self.produto_a = Produto.objects.create(
            empresa=self.empresa_a,
            tipo_produto="Plastico",
            quantidade=Decimal("10.000"),
            descricao_produto="Aparas PEAD",
            unidade="kg",
        )
        self.produto_b = Produto.objects.create(
            empresa=self.empresa_b,
            tipo_produto="Metal",
            quantidade=Decimal("5.000"),
            descricao_produto="Sucata metalica",
            unidade="kg",
        )

    def authenticate_as(self, empresa):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {make_token(empresa)}")

    def test_user_cannot_move_inventory_item_from_another_company(self):
        self.authenticate_as(self.empresa_b)

        response = self.client.post(
            f"/api/inventory/items/{self.produto_a.id_produto}/movements/",
            {"type": "entrada", "quantity": "3.000", "note": "Tentativa indevida"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade, Decimal("10.000"))
        self.assertFalse(MovimentacaoEstoque.objects.filter(empresa=self.empresa_b, produto=self.produto_a).exists())

    def test_movement_service_rejects_company_mismatch(self):
        with self.assertRaises(serializers.ValidationError) as error:
            register_inventory_movement(
                self.produto_a,
                self.empresa_b,
                {"type": "entrada", "quantity": Decimal("1.000"), "note": ""},
            )
        self.assertIn("Este item de estoque nao pertence ao usuario autenticado.", str(error.exception))

    def test_user_only_lists_movements_from_own_company_and_products(self):
        MovimentacaoEstoque.objects.create(
            produto=self.produto_a,
            empresa=self.empresa_a,
            tipo="entrada",
            quantidade=Decimal("2.000"),
            saldo_resultante=Decimal("12.000"),
        )
        MovimentacaoEstoque.objects.create(
            produto=self.produto_b,
            empresa=self.empresa_b,
            tipo="entrada",
            quantidade=Decimal("4.000"),
            saldo_resultante=Decimal("9.000"),
        )
        MovimentacaoEstoque.objects.create(
            produto=self.produto_a,
            empresa=self.empresa_b,
            tipo="entrada",
            quantidade=Decimal("99.000"),
            saldo_resultante=Decimal("109.000"),
        )

        self.authenticate_as(self.empresa_b)
        response = self.client.get("/api/inventory/movements/")

        self.assertEqual(response.status_code, 200)
        movements = response.json()["movements"]
        self.assertEqual(len(movements), 1)
        self.assertEqual(movements[0]["itemId"], str(self.produto_b.id_produto))
