import json

from django.test import Client, TestCase


class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def post_json(self, path: str, payload: dict):
        return self.client.post(path, data=json.dumps(payload), content_type="application/json")

    def test_register_rejects_invalid_cnpj(self):
        response = self.post_json(
            "/api/auth/register/",
            {
                "razaoSocial": "Empresa Teste",
                "cnpj": "11111111111111",
                "segmento": "Metalurgia",
                "email": "teste@example.com",
                "telefone": "11999990000",
                "password": "senha12345",
            },
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

        register_response = self.post_json("/api/auth/register/", payload)
        self.assertEqual(register_response.status_code, 201)

        login_response = self.post_json(
            "/api/auth/login/",
            {"email": payload["email"], "password": payload["password"]},
        )
        self.assertEqual(login_response.status_code, 200)
        token = login_response.json()["token"]

        me_response = self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["user"]["razaoSocial"], payload["razaoSocial"])
