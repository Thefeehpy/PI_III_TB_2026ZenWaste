import base64
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from anuncios.models import Anuncio
from authentication.services import make_token
from empresas.models import Empresa
from marketplace.serializers import MarketplaceAdInputSerializer
from produtos.models import Produto


class MarketplaceAdInputSerializerTests(SimpleTestCase):
    def base_payload(self):
        return {
            "inventoryId": "1",
            "name": "Aparas de PEAD",
            "type": "Plastico Industrial",
            "description": "",
            "quantity": "10.00",
            "unit": "kg",
            "price": "2.80",
            "location": "Sao Paulo - SP",
        }

    def test_accepts_attached_data_image(self):
        payload = self.base_payload()
        image = base64.b64encode(b"fake-image").decode("ascii")
        payload["imageUrl"] = f"data:image/png;base64,{image}"

        serializer = MarketplaceAdInputSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["imageUrl"], payload["imageUrl"])

    def test_accepts_remote_http_image_url(self):
        payload = self.base_payload()
        payload["imageUrl"] = "https://example.com/material.jpg"

        serializer = MarketplaceAdInputSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_invalid_image_value(self):
        payload = self.base_payload()
        payload["imageUrl"] = "foto-local-sem-data-url"

        serializer = MarketplaceAdInputSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("imageUrl", serializer.errors)


class MarketplaceEndpointContractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.empresa = Empresa.objects.create(
            cnpj="22333444000181",
            razao_social="Reserva Circular LTDA",
            telefone_whatsapp="11999998888",
            descricao_segmento="Reciclagem",
            email="reservas@zenwaste.com",
            senha="senha123",
        )
        self.produto = Produto.objects.create(
            empresa=self.empresa,
            tipo_produto="Metal",
            quantidade=Decimal("8.000"),
            descricao_produto="Latas de aluminio",
            unidade="kg",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {make_token(self.empresa)}")

    def test_anuncio_e_reserva_mantem_contrato(self):
        anuncio = Anuncio(
            produto=self.produto,
            preco_final=Decimal("2.80"),
            nr_qtd=Decimal("5.00"),
        )
        anuncio.publicar()

        cancel_response = self.client.delete(f"/api/marketplace/ads/{anuncio.id_anuncio}/")
        self.assertEqual(cancel_response.status_code, 204)

        create_response = self.client.post(
            f"/api/inventory/items/{self.produto.id_produto}/reservations/",
            {
                "quantity": "3.000",
                "unitPrice": "4.50",
                "buyerName": "Cooperativa Verde",
                "buyerPhone": "11988887777",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        reserva = create_response.json()["reservation"]
        self.assertEqual(reserva["status"], "pronta")
