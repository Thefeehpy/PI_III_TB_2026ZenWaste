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

    def test_produto_atualiza_status_e_dados_pelo_dominio(self):
        self.assertTrue(self.produto_a.atualizar_produto(
            descricao_produto="Aparas de PEAD lavadas",
            quantidade=Decimal("0.000"),
            empresa=self.empresa_b,
        ))
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.descricao_produto, "Aparas de PEAD lavadas")
        self.assertEqual(self.produto_a.status, "sem_saldo")
        self.assertEqual(self.produto_a.empresa, self.empresa_a)

    def test_cadastrar_e_excluir_produto(self):
        produto = Produto(
            empresa=self.empresa_a,
            tipo_produto="Vidro",
            quantidade=Decimal("3.000"),
            descricao_produto="Garrafas de vidro",
            unidade="kg",
        )
        self.assertTrue(produto.cadastrar_produto())
        self.assertEqual(produto.status, "disponivel")
        produto_id = produto.id_produto
        self.assertTrue(produto.excluir_produto())
        self.assertFalse(Produto.objects.filter(id_produto=produto_id).exists())

    def test_endpoints_de_estoque_mantem_contrato_das_telas(self):
        self.authenticate_as(self.empresa_a)
        create_response = self.client.post(
            "/api/inventory/items/",
            {"name": "Caixas de papelao", "type": "Papel", "quantity": "8.000", "unit": "kg"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        item = create_response.json()["item"]

        update_response = self.client.patch(
            f"/api/inventory/items/{item['id']}/",
            {"name": "Caixas de papelão prensadas", "unit": "fardo"},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["item"]["unit"], "fardo")

        delete_response = self.client.delete(f"/api/inventory/items/{item['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["closedAds"], 0)
