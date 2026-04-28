from django.test import TestCase
from rest_framework.test import APIClient


class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_rejects_invalid_cnpj(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "razaoSocial": "Empresa Teste",
                "cnpj": "11111111111111",
                "segmento": "Metalurgia",
                "email": "teste@example.com",
                "telefone": "11999990000",
                "password": "senha12345",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_register_login_and_me(self):
        payload = {
            "razaoSocial": "Empresa Teste",
            "cnpj": "11.222.333/0001-81",
            "segmento": "Metalurgia",
            "email": "teste@example.com",
            "telefone": "11999990000",
            "password": "senha12345",
        }

        register_response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(register_response.status_code, 201)

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": payload["email"], "password": payload["password"]},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['token']}")
        me_response = self.client.get("/api/auth/me/")

        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data["user"]["razaoSocial"], payload["razaoSocial"])

        companies_response = self.client.get("/api/companies/")
        self.assertEqual(companies_response.status_code, 200)
        self.assertEqual(len(companies_response.data["companies"]), 1)
        self.assertEqual(companies_response.data["companies"][0]["razaoSocial"], payload["razaoSocial"])

        company_id = companies_response.data["companies"][0]["id"]
        detail_response = self.client.get(f"/api/companies/{company_id}/")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data["company"]["email"], payload["email"])
