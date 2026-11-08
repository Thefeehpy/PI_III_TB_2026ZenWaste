from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from empresas.models import Empresa


class TestesVisaoAcesso(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.empresa = Empresa.objects.create(
            cnpj="11222333000181",
            razao_social="ZenWaste LTDA",
            telefone_whatsapp="11999999999",
            descricao_segmento="Reciclagem",
            email="contato@zenwaste.com",
            senha="senha123",
        )

    def test_acesso_com_senha_legada_atualiza_para_resumo_criptografico(self):
        resposta = self.client.post(
            "/auth/login/",
            {"email": "contato@zenwaste.com", "password": "senha123"},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["empresa"]["email"], self.empresa.email)

        self.empresa.refresh_from_db()
        self.assertNotEqual(self.empresa.senha, "senha123")
        self.assertTrue(self.empresa.validar_senha("senha123"))

    def test_acesso_retorna_401_quando_senha_invalida(self):
        resposta = self.client.post(
            "/auth/login/",
            {"email": "contato@zenwaste.com", "password": "senha-incorreta"},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(resposta.data["message"], "E-mail ou senha inválidos.")
