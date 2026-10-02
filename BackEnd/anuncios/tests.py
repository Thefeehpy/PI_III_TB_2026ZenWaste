from decimal import Decimal

from django.test import TestCase

from anuncios.models import Anuncio, Reserva
from empresas.models import Empresa
from produtos.models import Produto


class AnuncioReservaDomainTests(TestCase):
    def setUp(self):
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

    def test_comportamentos_do_anuncio(self):
        anuncio = Anuncio(
            produto=self.produto,
            preco_final=Decimal("2.80"),
            nr_qtd=Decimal("5.00"),
            localizacao="Sao Paulo - SP",
        )
        self.assertTrue(anuncio.publicar())
        self.assertTrue(anuncio.editar_anuncio(descricao_especifica="Material limpo."))
        self.assertTrue(anuncio.alterar_preco(Decimal("3.10")))
        self.assertTrue(anuncio.finalizar_venda())
        anuncio.refresh_from_db()
        self.assertEqual(anuncio.status_anuncio, "vendido")
        self.assertIsNotNone(anuncio.data_final)

    def test_comportamentos_da_reserva(self):
        reserva = Reserva(
            produto=self.produto,
            quantidade_reservada=Decimal("10.000"),
            preco_unitario=Decimal("4.50"),
            nome_comprador="Cooperativa Verde",
            numero_comprador="11988887777",
        )
        self.assertTrue(reserva.criar_reserva())
        self.assertEqual(reserva.status, "em_captacao")
        self.produto.atualizar_produto(quantidade=Decimal("10.000"))
        self.assertTrue(reserva.atualizar_status())
        self.assertTrue(reserva.finalizar_reserva())
        reserva.refresh_from_db()
        self.assertEqual(reserva.status, "finalizada")
        self.assertIsNotNone(reserva.data_finalizacao)

