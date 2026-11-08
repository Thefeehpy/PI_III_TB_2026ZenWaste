from unittest.mock import patch

from django.db import IntegrityError
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from app.excecoes import ErroRegraNegocio
from autenticacao.servicos import obter_empresa_da_requisicao, gerar_token, dados_empresa
from empresas.admin import FormularioAdministrativoEmpresa
from empresas.models import Empresa, EmpresaPapel, PapelEmpresa
from empresas.serializers import SerializadorEmpresa
from empresas.servicos import atribuir_papeis_empresa, desativar_empresa, cadastrar_empresa, atualizar_empresa


class TestesPapeisEAcessoEmpresa(TestCase):
    def dados_cadastrais_empresa(self, **alteracoes):
        dados_recebidos = {
            "cnpj": "11222333000181",
            "razao_social": "Reciclagem Modelo",
            "telefone_whatsapp": "11999999999",
            "descricao_segmento": "Reciclagem",
            "email": "CONTATO@example.com",
            "senha": "senha123",
        }
        dados_recebidos.update(alteracoes)
        return dados_recebidos

    def test_cadastro_atribui_papeis_comerciais_e_oculta_senha(self):
        empresa = cadastrar_empresa(self.dados_cadastrais_empresa())

        self.assertEqual(empresa.email, "contato@example.com")
        self.assertTrue(empresa.validar_senha("senha123"))
        self.assertNotEqual(empresa.senha, "senha123")
        self.assertEqual(set(empresa.papeis.values_list("codigo", flat=True)), {"vendedora", "compradora"})
        self.assertNotIn("senha", SerializadorEmpresa(empresa).data)
        self.assertNotIn("senha", dados_empresa(empresa))

    def test_empresa_pode_assumir_transporte_sem_duplicar_cadastro_ou_vinculos(self):
        empresa = cadastrar_empresa(self.dados_cadastrais_empresa())

        atribuir_papeis_empresa(empresa, ["transportadora", "compradora"])
        atribuir_papeis_empresa(empresa, ["transportadora"])

        self.assertEqual(Empresa.objects.count(), 1)
        self.assertEqual(EmpresaPapel.objects.filter(empresa=empresa).count(), 3)
        self.assertEqual(set(empresa.papeis.values_list("codigo", flat=True)), set(PapelEmpresa.Codigo.values))

    def test_papel_inicial_invalido_desfaz_cadastro_empresa(self):
        empresas_antes = Empresa.objects.count()
        vinculos_antes = EmpresaPapel.objects.count()
        with self.assertRaises(ErroRegraNegocio):
            cadastrar_empresa(self.dados_cadastrais_empresa(), codigos_papeis=["compradora", "inexistente"])

        self.assertEqual(Empresa.objects.count(), empresas_antes)
        self.assertEqual(EmpresaPapel.objects.count(), vinculos_antes)

    def test_desativacao_preserva_papeis_e_invalida_acesso_existente(self):
        empresa = cadastrar_empresa(self.dados_cadastrais_empresa())
        token = gerar_token(empresa)
        requisicao = RequestFactory().get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(obter_empresa_da_requisicao(requisicao), empresa)

        desativar_empresa(empresa)

        self.assertTrue(Empresa.objects.filter(pk=empresa.pk, ativo=False).exists())
        self.assertEqual(empresa.papeis.count(), 2)
        self.assertIsNone(obter_empresa_da_requisicao(requisicao))
        cliente = APIClient()
        for rota in ("/api/auth/login/", "/auth/login/"):
            resposta = cliente.post(rota, {"email": empresa.email, "password": "senha123"}, format="json")
            self.assertEqual(resposta.status_code, 401)
        cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(cliente.get("/api/auth/me/").status_code, 401)

    def test_acesso_valido_preserva_contrato_e_informa_papeis(self):
        empresa = cadastrar_empresa(self.dados_cadastrais_empresa())
        resposta = APIClient().post(
            "/api/auth/login/",
            {"email": empresa.email, "password": "senha123"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertIn("token", resposta.data)
        self.assertEqual(resposta.data["user"]["id"], str(empresa.pk))
        self.assertEqual(resposta.data["user"]["roles"], ["compradora", "vendedora"])
        self.assertNotIn("senha", resposta.data["user"])

    def test_serializador_informa_erro_campo_email_duplicado_sem_diferenca_caixa(self):
        cadastrar_empresa(self.dados_cadastrais_empresa())
        serializador = SerializadorEmpresa(data=self.dados_cadastrais_empresa(
            cnpj="11444777000161",
            telefone_whatsapp="11888888888",
            email=" CONTATO@EXAMPLE.COM ",
        ))

        self.assertFalse(serializador.is_valid())
        self.assertIn("email", serializador.errors)
        self.assertEqual(Empresa.objects.count(), 1)

    def test_servico_atualizacao_rejeita_email_de_outra_empresa_sem_alteracao(self):
        primeira_empresa = cadastrar_empresa(self.dados_cadastrais_empresa())
        segunda_empresa = cadastrar_empresa(self.dados_cadastrais_empresa(
            cnpj="11444777000161",
            telefone_whatsapp="11888888888",
            email="second@example.com",
        ))

        with self.assertRaises(ErroRegraNegocio):
            atualizar_empresa(segunda_empresa, {"email": f" {primeira_empresa.email.upper()} "})

        segunda_empresa.refresh_from_db()
        self.assertEqual(segunda_empresa.email, "second@example.com")
        self.assertEqual(atualizar_empresa(segunda_empresa, {"email": " SECOND@EXAMPLE.COM "}).email, segunda_empresa.email)

    def test_administracao_rejeita_email_de_outra_empresa(self):
        cadastrar_empresa(self.dados_cadastrais_empresa())
        formulario = FormularioAdministrativoEmpresa(data={
            **self.dados_cadastrais_empresa(cnpj="11444777000161", telefone_whatsapp="11888888888"),
            "email": " CONTATO@EXAMPLE.COM ",
            "nova_senha": "senha123",
        })

        self.assertFalse(formulario.is_valid())
        self.assertIn("email", formulario.errors)

    def test_concorrencia_email_gera_erro_negocio_e_desfaz_cadastro(self):
        cadastrar_empresa(self.dados_cadastrais_empresa())
        with patch("empresas.servicos.validar_email_empresa", return_value="CONTATO@example.com"):
            with self.assertRaises(ErroRegraNegocio) as erro:
                cadastrar_empresa(self.dados_cadastrais_empresa(
                    cnpj="11444777000161",
                    telefone_whatsapp="11888888888",
                    email="CONTATO@example.com",
                ))

        self.assertIn("email", erro.exception.detalhes)
        self.assertEqual(Empresa.objects.count(), 1)

    def test_outros_erros_integridade_nao_sao_mascarados_como_email(self):
        cadastrar_empresa(self.dados_cadastrais_empresa())
        with self.assertRaises(IntegrityError):
            cadastrar_empresa(self.dados_cadastrais_empresa(
                telefone_whatsapp="11888888888",
                email="another@example.com",
            ))

        self.assertEqual(Empresa.objects.count(), 1)
