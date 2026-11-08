import base64
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from anuncios.models import Anuncio, ImagemAnuncio
from app.excecoes import ErroRegraNegocio
from autenticacao.servicos import gerar_token
from empresas.models import Empresa
from comercializacao.serializers import SerializadorEntradaAnuncio
from comercializacao.servicos import criar_anuncio
from produtos.catalogos import resolver_categoria, resolver_unidade
from produtos.models import Produto


class TestesSerializadorEntradaAnuncio(SimpleTestCase):
    def dados_basicos(self):
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

    def test_aceita_imagem_anexada(self):
        montar_dados = self.dados_basicos()
        imagem = base64.b64encode(b"fake-image").decode("ascii")
        montar_dados["imageUrl"] = f"data:image/png;base64,{imagem}"

        serializador = SerializadorEntradaAnuncio(data=montar_dados)

        self.assertTrue(serializador.is_valid(), serializador.errors)
        self.assertEqual(serializador.validated_data["imageUrl"], montar_dados["imageUrl"])

    def test_aceita_url_imagem_http(self):
        montar_dados = self.dados_basicos()
        montar_dados["imageUrl"] = "https://example.com/material.jpg"

        serializador = SerializadorEntradaAnuncio(data=montar_dados)

        self.assertTrue(serializador.is_valid(), serializador.errors)

    def test_rejeita_imagem_invalida(self):
        montar_dados = self.dados_basicos()
        montar_dados["imageUrl"] = "foto-local-sem-data-url"

        serializador = SerializadorEntradaAnuncio(data=montar_dados)

        self.assertFalse(serializador.is_valid())
        self.assertIn("imageUrl", serializador.errors)


class TestesModelagemComercializacao(TestCase):
    def setUp(self):
        self.cliente = APIClient()
        self.vendedora = Empresa.objects.create(
            cnpj="11444777000161", razao_social="Vendedora", telefone_whatsapp="11999990001",
            email="vendedora@example.com", senha="test-hash",
        )
        self.outra_empresa = Empresa.objects.create(
            cnpj="11222333000181", razao_social="Outra", telefone_whatsapp="11999990002",
            email="outra@example.com", senha="test-hash",
        )
        self.produto = Produto.objects.create(
            empresa=self.vendedora, nome_residuo="Retalhos de aluminio", descricao_produto="Limpos",
            categoria=resolver_categoria("Aluminio"), unidade_medida=resolver_unidade("kg"),
            quantidade=Decimal("10.000"),
        )
        self.cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {gerar_token(self.vendedora)}")

    def montar_dados(self, **alteracoes):
        dados = {
            "inventoryId": str(self.produto.pk), "name": self.produto.nome_residuo,
            "type": "Aluminio", "unit": "kg", "quantity": "0.001", "price": "5.00",
        }
        dados.update(alteracoes)
        return dados

    def test_descricao_anuncio_nao_sobrescreve_descricao_produto(self):
        dados = self.montar_dados(description="D" * 500, name="Novo material com descricao comercial")
        dados.pop("inventoryId")
        resposta = self.cliente.post("/api/marketplace/ads/", dados, format="json")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        anuncio = Anuncio.objects.get()
        self.assertEqual(anuncio.descricao_especifica, "D" * 500)
        self.assertEqual(anuncio.produto.descricao_produto, "")

    def test_quantidade_tres_casas_e_imagens_do_anuncio(self):
        resposta = self.cliente.post("/api/marketplace/ads/", self.montar_dados(images=[
            {"url": "https://example.com/first.jpg", "order": 0},
            {"url": "https://example.com/cover.jpg", "isCover": True, "order": 1},
        ]), format="json")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        anuncio = Anuncio.objects.get()
        self.assertEqual(anuncio.nr_qtd, Decimal("0.001"))
        self.assertEqual(anuncio.imagens.count(), 2)
        self.assertEqual(resposta.data["item"]["imageUrl"], "https://example.com/cover.jpg")
        self.assertEqual(len(resposta.data["item"]["images"]), 2)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10.000"))

    def test_imagem_legada_vira_capa_e_aceita_colecao(self):
        primeiro = self.cliente.post("/api/marketplace/ads/", self.montar_dados(imageUrl="https://example.com/old.jpg"), format="json")
        self.assertEqual(primeiro.status_code, 201, primeiro.data)
        anuncio = Anuncio.objects.get()
        self.assertTrue(anuncio.imagens.get().eh_capa)
        resposta = self.cliente.patch(f"/api/marketplace/ads/{anuncio.pk}/", {
            "images": [{"url": "https://example.com/new.jpg", "isCover": True, "order": 0}],
        }, format="json")
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(resposta.data["item"]["imageUrl"], "https://example.com/new.jpg")
        self.assertFalse(ImagemAnuncio.objects.filter(url_arquivo="https://example.com/old.jpg").exists())

    def test_colecao_invalida_desfaz_produto_anuncio_movimento(self):
        quantidade_produtos_anterior = Produto.objects.count()
        dados = self.montar_dados(images=[
            {"url": "https://example.com/a.jpg", "isCover": True},
            {"url": "https://example.com/b.jpg", "isCover": True},
        ])
        dados.pop("inventoryId")
        dados["name"] = "Novo residuo"
        dados["quantity"] = Decimal("1.001")
        dados["price"] = Decimal("5.00")
        with self.assertRaises(ErroRegraNegocio):
            criar_anuncio(self.vendedora, dados)
        self.assertEqual(Produto.objects.count(), quantidade_produtos_anterior)
        self.assertFalse(Anuncio.objects.exists())

    def test_nao_publica_estoque_de_outra_empresa(self):
        self.cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {gerar_token(self.outra_empresa)}")
        resposta = self.cliente.post("/api/marketplace/ads/", self.montar_dados(), format="json")
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(Anuncio.objects.exists())
        self.assertEqual(Produto.objects.count(), 1)

    def test_banco_rejeita_segunda_capa(self):
        anuncio = criar_anuncio(self.vendedora, {
            **self.montar_dados(), "quantity": Decimal("1.000"), "price": Decimal("5.00"),
        })
        ImagemAnuncio.objects.create(anuncio=anuncio, url_arquivo="https://example.com/a.jpg", eh_capa=True, ordem=0)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ImagemAnuncio.objects.create(anuncio=anuncio, url_arquivo="https://example.com/b.jpg", eh_capa=True, ordem=1)

    def test_rota_legada_isolada_valida_estoque(self):
        resposta = self.cliente.post("/anuncio", {
            "produto": self.produto.pk, "preco_final": "5.00", "nr_qtd": "11.000",
        }, format="json")
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(Anuncio.objects.exists())
        self.cliente.credentials()
        resposta = self.cliente.get("/anuncio")
        self.assertIn(resposta.status_code, (401, 403))

    def test_salvamento_nao_chama_ia_ocultamente(self):
        with patch("gemini_api.cliente.gerar_descricao_anuncio_ia") as sugestao:
            Anuncio.objects.create(produto=self.produto, preco_final=Decimal("5.00"), nr_qtd=Decimal("1.000"))
        sugestao.assert_not_called()

    def test_filtro_categoria_usa_relacao_normalizada(self):
        criar_anuncio(self.vendedora, {**self.montar_dados(), "quantity": Decimal("1.000"), "price": Decimal("5.00")})
        resposta = self.cliente.get("/api/marketplace/ads/", {"type": "Aluminio"})
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(len(resposta.data["items"]), 1)

    def test_ordem_repetida_rejeitada_antes_de_salvar(self):
        resposta = self.cliente.post("/api/marketplace/ads/", self.montar_dados(images=[
            {"url": "https://example.com/a.jpg", "order": 0},
            {"url": "https://example.com/b.jpg", "order": 0},
        ]), format="json")
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(Anuncio.objects.exists())
