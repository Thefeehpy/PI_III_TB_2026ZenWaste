from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from anuncios.models import Anuncio, Reserva
from app.excecoes import ErroRegraNegocio
from autenticacao.servicos import gerar_token
from empresas.models import Empresa
from pedidos.models import Pedido
from produtos.disponibilidade import quantidade_comprometida
from produtos.catalogos import resolver_categoria, resolver_unidade
from produtos.models import CategoriaResiduo, MovimentacaoEstoque, Produto, UnidadeMedida
from produtos.politicas import obter_politica_movimentacao
from produtos.servicos import (
    criar_item_estoque, criar_reserva_produto, desativar_item_estoque,
    registrar_movimentacao_estoque, atualizar_item_estoque, atualizar_reserva_produto,
)


class TestesPoliticasMovimentacaoEstoque(SimpleTestCase):
    def test_saida_respeita_material_comprometido(self):
        politica = obter_politica_movimentacao("saida")
        self.assertEqual(politica.calcular_saldo_resultante(Decimal("100"), Decimal("30"), Decimal("70")), Decimal("70"))
        with self.assertRaises(ErroRegraNegocio):
            politica.calcular_saldo_resultante(Decimal("100"), Decimal("30.001"), Decimal("70"))

    def test_quantidade_e_tipo_movimentacao_invalidos_sao_rejeitados(self):
        for quantidade in (Decimal("0"), Decimal("-1"), Decimal("NaN"), Decimal("0.0001")):
            with self.subTest(quantidade=quantidade), self.assertRaises(ErroRegraNegocio):
                obter_politica_movimentacao("entrada").calcular_saldo_resultante(Decimal("10"), quantidade)
        with self.assertRaises(ErroRegraNegocio):
            obter_politica_movimentacao("invalido")


class TestesIsolamentoEmpresasEstoque(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.empresa_a = Empresa.objects.create(
            cnpj="00.000.000/0001-00", razao_social="Empresa A",
            telefone_whatsapp="11999990001", descricao_segmento="Reciclagem",
            email="empresa-a@example.com", senha="senha123",
        )
        self.empresa_b = Empresa.objects.create(
            cnpj="00.000.000/0002-00", razao_social="Empresa B",
            telefone_whatsapp="11999990002", descricao_segmento="Industria",
            email="empresa-b@example.com", senha="senha123",
        )
        self.produto_a = criar_item_estoque(self.empresa_a, {
            "name": "Aparas PEAD", "type": "Plastico", "quantity": Decimal("10.000"), "unit": "kg",
        })
        self.produto_b = criar_item_estoque(self.empresa_b, {
            "name": "Sucata metalica", "type": "Metal", "quantity": Decimal("5.000"), "unit": "kg",
        })

    def autenticar_como(self, empresa):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {gerar_token(empresa)}")

    def test_empresa_nao_movimenta_estoque_de_outra_empresa(self):
        self.autenticar_como(self.empresa_b)
        resposta = self.client.post(
            f"/api/inventory/items/{self.produto_a.pk}/movements/",
            {"type": "entrada", "quantity": "3.000", "note": "Tentativa indevida"}, format="json",
        )
        self.assertEqual(resposta.status_code, 404)
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade, Decimal("10.000"))
        self.assertEqual(self.produto_a.movimentacoes.count(), 1)

    def test_servico_rejeita_empresa_diferente_da_proprietaria(self):
        with self.assertRaises(ErroRegraNegocio) as erro:
            registrar_movimentacao_estoque(self.produto_a, self.empresa_b, {
                "type": "entrada", "quantity": Decimal("1.000"),
            })
        self.assertIn("nao pertence", str(erro.exception))

    def test_empresa_lista_apenas_movimentacoes_de_seus_produtos(self):
        self.autenticar_como(self.empresa_b)
        resposta = self.client.get("/api/inventory/movements/")
        self.assertEqual(resposta.status_code, 200)
        movimentacoes = resposta.json()["movements"]
        self.assertEqual(len(movimentacoes), 1)
        self.assertEqual(movimentacoes[0]["itemId"], str(self.produto_b.pk))
        movimentacao = self.produto_b.movimentacoes.get()
        self.assertEqual(movimentacao.empresa_id, self.empresa_b.pk)
        self.assertNotIn("empresa", {campo.name for campo in MovimentacaoEstoque._meta.fields})

    def test_api_preserva_contrato_com_descricao_separada_e_quantidade_ampliada(self):
        self.autenticar_como(self.empresa_a)
        resposta = self.client.post("/api/inventory/items/", {
            "name": "Lote industrial", "description": "Material limpo e seco", "type": "PLASTICO",
            "unit": "KG", "quantity": "12345678.123",
        }, format="json")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        item = resposta.data["item"]
        self.assertEqual(item["name"], "Lote industrial")
        self.assertEqual(item["description"], "Material limpo e seco")
        self.assertEqual(item["unit"], "kg")
        self.assertEqual(Decimal(str(item["quantity"])), Decimal("12345678.123"))
        self.assertEqual(Produto.objects.get(pk=item["id"]).categoria_id, self.produto_a.categoria_id)

    def test_catalogos_reutilizam_rotulos_sem_distinguir_maiusculas(self):
        self.assertEqual(resolver_categoria("  PLASTICO  ").pk, self.produto_a.categoria_id)
        self.assertEqual(resolver_unidade("KG").pk, self.produto_a.unidade_medida_id)
        self.assertEqual(CategoriaResiduo.objects.count(), 2)
        self.assertEqual(UnidadeMedida.objects.count(), 1)

    def test_falha_movimentacao_inicial_desfaz_produto_e_catalogo(self):
        quantidade_anterior = Produto.objects.count()
        with patch("produtos.servicos.MovimentacaoEstoque.objects.create", side_effect=RuntimeError("historico indisponivel")):
            with self.assertRaises(RuntimeError):
                criar_item_estoque(self.empresa_a, {
                    "name": "Novo residuo", "type": "Vidro", "quantity": Decimal("2.000"), "unit": "kg",
                })
        self.assertEqual(Produto.objects.count(), quantidade_anterior)
        self.assertFalse(CategoriaResiduo.objects.filter(nome_material="Vidro").exists())

    def test_falha_movimentacao_desfaz_alteracao_saldo_fisico(self):
        quantidade_anterior = self.produto_a.movimentacoes.count()
        with patch("produtos.servicos.MovimentacaoEstoque.objects.create", side_effect=RuntimeError("historico indisponivel")):
            with self.assertRaises(RuntimeError):
                registrar_movimentacao_estoque(self.produto_a, self.empresa_a, {
                    "type": "saida", "quantity": Decimal("2.000"),
                })
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade, Decimal("10.000"))
        self.assertEqual(self.produto_a.movimentacoes.count(), quantidade_anterior)

    def test_troca_unidade_com_historico_e_rejeitada_atomicamente(self):
        with self.assertRaises(ErroRegraNegocio):
            atualizar_item_estoque(self.produto_a, {"name": "Outro nome", "unit": "t"})
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.unidade, "kg")
        self.assertEqual(self.produto_a.nome_residuo, "Aparas PEAD")
        self.assertFalse(UnidadeMedida.objects.filter(sigla="t").exists())

    def test_desativacao_preserva_produto_e_historico_e_inativa_anuncios(self):
        anuncio = Anuncio.objects.create(produto=self.produto_a, preco_final=Decimal("3.00"), nr_qtd=Decimal("10.000"))
        self.assertEqual(desativar_item_estoque(self.produto_a), 1)
        self.produto_a.refresh_from_db()
        anuncio.refresh_from_db()
        self.assertFalse(self.produto_a.ativo)
        self.assertEqual(self.produto_a.movimentacoes.count(), 1)
        self.assertEqual(anuncio.situacao_anuncio, "inativo")
        self.autenticar_como(self.empresa_a)
        resposta = self.client.get("/api/inventory/items/")
        self.assertEqual(resposta.data["items"], [])

    def test_meta_captacao_nao_compromete_estoque_fisico(self):
        reserva = criar_reserva_produto(self.produto_a, {
            "quantity": Decimal("50.000"), "unitPrice": Decimal("0"),
            "buyerName": "Contato legado", "buyerPhone": "11999990003",
        })
        self.assertEqual(reserva.modalidade, "captacao")
        self.assertEqual(reserva.situacao, "em_captacao")
        self.assertEqual(quantidade_comprometida(self.produto_a.pk), Decimal("0"))

    def test_compromisso_com_compradora_impede_venda_excedente_e_saida_manual(self):
        reserva = criar_reserva_produto(self.produto_a, {
            "quantity": Decimal("7.000"), "unitPrice": Decimal("3.00"), "buyerCompanyId": self.empresa_b.pk,
        })
        self.assertEqual(reserva.empresa_compradora_id, self.empresa_b.pk)
        self.assertEqual(reserva.nome_comprador, self.empresa_b.razao_social)
        self.assertEqual(quantidade_comprometida(self.produto_a.pk), Decimal("7.000"))
        with self.assertRaises(ErroRegraNegocio):
            criar_reserva_produto(self.produto_a, {
                "quantity": Decimal("4.000"), "unitPrice": Decimal("3.00"), "buyerCompanyId": self.empresa_b.pk,
            })
        with self.assertRaises(ErroRegraNegocio):
            registrar_movimentacao_estoque(self.produto_a, self.empresa_a, {
                "type": "saida", "quantity": Decimal("4.000"),
            })
        with self.assertRaises(ErroRegraNegocio):
            desativar_item_estoque(self.produto_a)
        atualizar_reserva_produto(reserva, "finalizada")
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade, Decimal("3.000"))
        self.assertEqual(quantidade_comprometida(self.produto_a.pk), Decimal("0"))

    def test_reserva_vinculada_pedido_nao_pode_ser_finalizada_manualmente(self):
        anuncio = Anuncio.objects.create(produto=self.produto_a, preco_final=Decimal("3.00"), nr_qtd=Decimal("10.000"))
        pedido = Pedido.objects.create(
            numero="ZW-PRODUTOS-TEST", empresa_compradora=self.empresa_b, anuncio=anuncio,
            quantidade=Decimal("2.000"), preco_unitario=Decimal("3.00"), valor_total=Decimal("6.00"),
            reserva_expira_em=timezone.now() + timedelta(minutes=30),
        )
        reserva = Reserva.objects.create(
            produto=self.produto_a, empresa_compradora=self.empresa_b, pedido=pedido,
            modalidade="compromisso", quantidade_reservada=Decimal("2.000"), preco_unitario=Decimal("3.00"),
            nome_comprador=self.empresa_b.razao_social, numero_comprador=self.empresa_b.telefone_whatsapp,
        )
        self.assertEqual(quantidade_comprometida(self.produto_a.pk), Decimal("2.000"))
        with self.assertRaises(ErroRegraNegocio):
            atualizar_reserva_produto(reserva, "finalizada")
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade, Decimal("10.000"))

    def test_banco_rejeita_saldo_fisico_negativo(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Produto.objects.filter(pk=self.produto_a.pk).update(quantidade=Decimal("-1"))

    def test_empresa_inativa_nao_recebe_nova_reserva(self):
        self.empresa_b.ativo = False
        self.empresa_b.save(update_fields=["ativo"])
        with self.assertRaises(ErroRegraNegocio):
            criar_reserva_produto(self.produto_a, {
                "quantity": Decimal("1.000"), "unitPrice": Decimal("3.00"), "buyerCompanyId": self.empresa_b.pk,
            })
        self.assertFalse(self.produto_a.reservas.exists())
