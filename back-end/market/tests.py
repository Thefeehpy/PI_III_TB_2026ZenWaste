from django.test import TestCase
from rest_framework.test import APIClient


class MarketApiTests(TestCase):
    def test_prices_endpoint(self):
        response = APIClient().get("/api/market/prices/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["materials"]), 5)
