import base64

from django.test import SimpleTestCase

from marketplace.serializers import MarketplaceAdInputSerializer


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
