from decimal import Decimal
from datetime import timedelta
import hashlib
import hmac
import json
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from anuncios.models import Anuncio, Reserva
from autenticacao.servicos import gerar_token
from empresas.models import Empresa
from pedidos.integracoes import ResultadoPagamento, ErroIntegracaoPagamento
from pedidos.models import Pedido, TentativaPagamento
from produtos.models import Produto
from produtos.catalogos import resolver_categoria, resolver_unidade
from produtos.disponibilidade import quantidade_comprometida
from app.excecoes import ErroRegraNegocio


@override_settings(
    INTEGRACAO_PAGAMENTO="sandbox",
    SEGREDO_NOTIFICACAO_PAGAMENTO="test-webhook-secret",
    DEBUG=True,
)
class TestesAPIPedidosPagamentos(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.compradora = Empresa.objects.create(
            cnpj="11222333000181",
            razao_social="Compradora LTDA",
            telefone_whatsapp="11999990001",
            descricao_segmento="Industria",
            email="compras@example.com",
            senha="senha123",
        )
        self.vendedora = Empresa.objects.create(
            cnpj="11444777000161",
            razao_social="Recicladora LTDA",
            telefone_whatsapp="11999990002",
            descricao_segmento="Reciclagem",
            email="vendas@example.com",
            senha="senha123",
        )
        self.produto = Produto.objects.create(
            empresa=self.vendedora,
            categoria=resolver_categoria("Plastico"),
            quantidade=Decimal("10.000"),
            nome_residuo="Aparas PEAD",
            unidade_medida=resolver_unidade("kg"),
        )
        self.anuncio = Anuncio.objects.create(
            produto=self.produto,
            preco_final=Decimal("12.50"),
            situacao_anuncio="ativo",
            nr_qtd=Decimal("10.000"),
            descricao_especifica="Aparas limpas",
            localizacao="Sao Paulo - SP",
        )
        self.autenticar_como(self.compradora)
        self.dados_compradora = {
            "name": "Compradora LTDA",
            "email": "compras@example.com",
            "document": "11.222.333/0001-81",
            "phone": "(11) 99999-0001",
        }

    def autenticar_como(self, empresa):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {gerar_token(empresa)}")

    def criar_pedido(self, *, chave="order-create-1", quantidade="2.500"):
        return self.client.post(
            "/api/orders/",
            {
                "listingId": self.anuncio.pk,
                "quantity": quantidade,
                "buyer": self.dados_compradora,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=chave,
        )

    def test_criacao_calcula_total_e_e_idempotente(self):
        primeiro = self.criar_pedido()
        segundo = self.criar_pedido()

        self.assertEqual(primeiro.status_code, 201, primeiro.data)
        self.assertEqual(segundo.status_code, 201, segundo.data)
        self.assertEqual(primeiro.data["id"], segundo.data["id"])
        self.assertEqual(primeiro.data["totalCents"], 3125)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_reutilizar_chave_com_dados_diferentes_gera_conflito(self):
        self.assertEqual(self.criar_pedido().status_code, 201)

        resposta = self.criar_pedido(quantidade="3.000")

        self.assertEqual(resposta.status_code, 409)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_pedidos_ativos_comprometem_quantidade_anuncio(self):
        self.assertEqual(self.criar_pedido(quantidade="8.000").status_code, 201)

        resposta = self.criar_pedido(chave="order-create-2", quantidade="3.000")

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Pedido.objects.count(), 1)

    def test_movimentacao_nao_consume_saldo_comprometido(self):
        self.assertEqual(self.criar_pedido(quantidade="8.000").status_code, 201)
        self.autenticar_como(self.vendedora)

        resposta = self.client.post(
            f"/api/inventory/items/{self.produto.pk}/movements/",
            {"type": "saida", "quantity": "3.000", "note": "Baixa manual"},
            format="json",
        )

        self.assertEqual(resposta.status_code, 400)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10.000"))

    def test_vendedora_nao_finaliza_anuncio_comprometido(self):
        self.assertEqual(self.criar_pedido(quantidade="8.000").status_code, 201)
        self.autenticar_como(self.vendedora)

        atualizacao = self.client.patch(
            f"/api/marketplace/ads/{self.anuncio.pk}/",
            {"quantity": "7.000"},
            format="json",
        )
        finalizacao = self.client.post(
            f"/api/marketplace/ads/{self.anuncio.pk}/finalize/",
            {"soldQuantity": "1.000"},
            format="json",
        )

        self.assertEqual(atualizacao.status_code, 400)
        self.assertEqual(finalizacao.status_code, 400)
        self.anuncio.refresh_from_db()
        self.assertEqual(self.anuncio.nr_qtd, Decimal("10.000"))
        self.assertEqual(self.anuncio.situacao_anuncio, "ativo")

    def test_estoque_com_pedidos_preserva_historico(self):
        self.assertEqual(self.criar_pedido().status_code, 201)
        self.autenticar_como(self.vendedora)

        resposta = self.client.delete(f"/api/inventory/items/{self.produto.pk}/")

        self.assertEqual(resposta.status_code, 400)
        self.assertTrue(Produto.objects.filter(pk=self.produto.pk).exists())

    def test_compradora_nao_usa_documento_de_outra_empresa(self):
        self.dados_compradora["document"] = "11444777000161"

        resposta = self.criar_pedido()

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_pagamento_repetido_baixa_estoque_uma_vez(self):
        resposta_pedido = self.criar_pedido()
        pedido_id = resposta_pedido.data["id"]
        conteudo = {
            "method": "credit",
            "token": "demo_approved_test-token",
            "brand": "Visa",
            "last4": "4242",
            "installments": 1,
        }

        primeiro = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            conteudo,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )
        segundo = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            conteudo,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )

        self.assertEqual(primeiro.status_code, 200, primeiro.data)
        self.assertEqual(primeiro.data["status"], Pedido.Situacao.PAGO)
        self.assertEqual(segundo.status_code, 200, segundo.data)
        self.produto.refresh_from_db()
        self.anuncio.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("7.500"))
        self.assertEqual(self.anuncio.nr_qtd, Decimal("7.500"))
        self.assertEqual(TentativaPagamento.objects.count(), 1)

        dados_alterados = {**conteudo, "installments": 2}
        conflito = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            dados_alterados,
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-1",
        )
        self.assertEqual(conflito.status_code, 409)

    def test_pagamento_falho_permite_nova_tentativa_com_reserva(self):
        pedido_id = self.criar_pedido().data["id"]
        falhou = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            {
                "method": "credit",
                "token": "demo_declined_test",
                "brand": "Visa",
                "last4": "4242",
                "installments": 1,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="card-declined",
        )
        pedido = Pedido.objects.get(pk=pedido_id)
        pedido.reserva_expira_em = timezone.now() - timedelta(seconds=1)
        pedido.save(update_fields=['reserva_expira_em'])

        nova_tentativa = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            {
                "method": "debit",
                "token": "demo_approved_retry",
                "brand": "Visa",
                "last4": "4242",
                "installments": 1,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="debit-approved-retry",
        )

        self.assertEqual(falhou.status_code, 200)
        self.assertEqual(falhou.data["status"], Pedido.Situacao.FALHOU)
        self.assertEqual(nova_tentativa.status_code, 200, nova_tentativa.data)
        self.assertEqual(nova_tentativa.data["status"], Pedido.Situacao.PAGO)

    def test_rota_rejeita_dados_completos_cartao(self):
        pedido_id = self.criar_pedido().data["id"]

        resposta = self.client.post(
            f"/api/orders/{pedido_id}/payments/",
            {
                "method": "credit",
                "token": "demo_approved_test-token",
                "number": "4111111111111111",
                "cvv": "123",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-card-raw",
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(TentativaPagamento.objects.count(), 0)

    def test_resultado_incerto_preserva_tentativa_idempotente(self):
        pedido_id = self.criar_pedido().data["id"]
        conteudo = {
            "method": "credit",
            "token": "provider-token",
            "brand": "Visa",
            "last4": "4242",
            "installments": 1,
        }
        chave = "payment-unknown-then-confirmed"

        class IntegracaoResultadoIncerto:
            def cobrar_cartao(self, pedido, dados, chave_idempotencia):
                raise ErroIntegracaoPagamento("Resposta do provedor inconclusiva.", resultado_desconhecido=True)

        with patch('pedidos.servicos.obter_integracao_pagamento', return_value=IntegracaoResultadoIncerto()):
            incerto = self.client.post(
                f"/api/orders/{pedido_id}/payments/",
                conteudo,
                format="json",
                HTTP_IDEMPOTENCY_KEY=chave,
            )

        self.assertEqual(incerto.status_code, 503)
        self.assertEqual(Pedido.objects.get(pk=pedido_id).situacao, Pedido.Situacao.PENDENTE)
        tentativa = TentativaPagamento.objects.get(pedido_id=pedido_id)
        self.assertEqual(tentativa.situacao, TentativaPagamento.Situacao.PROCESSANDO)

        class IntegracaoConfirmada:
            def cobrar_cartao(self, pedido, dados, chave_idempotencia):
                return ResultadoPagamento(situacao="paid", bandeira_cartao="Visa", final_cartao="4242")

        with patch('pedidos.servicos.obter_integracao_pagamento', return_value=IntegracaoConfirmada()):
            nova_tentativa = self.client.post(
                f"/api/orders/{pedido_id}/payments/",
                conteudo,
                format="json",
                HTTP_IDEMPOTENCY_KEY=chave,
            )

        self.assertEqual(nova_tentativa.status_code, 200, nova_tentativa.data)
        self.assertEqual(nova_tentativa.data["status"], Pedido.Situacao.PAGO)
        self.assertEqual(TentativaPagamento.objects.filter(pedido_id=pedido_id).count(), 1)

    def test_pix_pendente_ate_confirmacao_assinada(self):
        pedido_id = self.criar_pedido().data["id"]
        resposta = self.client.post(
            f"/api/orders/{pedido_id}/pix/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-pix-1",
        )

        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(resposta.data["status"], Pedido.Situacao.PENDENTE)
        self.assertIn("ZENWASTE|PIX-SANDBOX", resposta.data["pix"]["copyPaste"])
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10.000"))

        pagamento = TentativaPagamento.objects.get(pedido_id=pedido_id)
        conteudo = {
            "eventId": "evt-test-1",
            "paymentReference": pagamento.referencia_provedor,
            "status": "paid",
            "amountCents": pagamento.valor_centavos,
        }
        corpo = json.dumps(conteudo, separators=(",", ":")).encode("utf-8")
        assinatura = hmac.new(
            b"test-webhook-secret",
            corpo,
            hashlib.sha256,
        ).hexdigest()
        notificacao = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            corpo,
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE=assinatura,
        )

        self.assertEqual(notificacao.status_code, 200, notificacao.data)
        self.assertEqual(Pedido.objects.get(pk=pedido_id).situacao, Pedido.Situacao.PAGO)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("7.500"))

    def test_pedido_nao_visivel_para_outra_empresa(self):
        pedido_id = self.criar_pedido().data["id"]
        self.autenticar_como(self.vendedora)

        resposta = self.client.get(f"/api/orders/{pedido_id}/")

        self.assertEqual(resposta.status_code, 404)

    def test_cancelamento_libera_compromisso_estoque(self):
        pedido_id = self.criar_pedido(quantidade="6.000").data["id"]
        cancelado = self.client.post(f"/api/orders/{pedido_id}/cancel/", {}, format="json")

        substituicao = self.criar_pedido(chave="order-after-cancel", quantidade="10.000")

        self.assertEqual(cancelado.status_code, 200, cancelado.data)
        self.assertEqual(cancelado.data["status"], Pedido.Situacao.CANCELADO)
        self.assertEqual(substituicao.status_code, 201, substituicao.data)

    def test_pedido_expirado_libera_reserva_na_consulta(self):
        pedido_id = self.criar_pedido(quantidade="10.000").data["id"]
        pedido = Pedido.objects.get(pk=pedido_id)
        pedido.reserva_expira_em = timezone.now() - timedelta(seconds=1)
        pedido.save(update_fields=['reserva_expira_em'])

        detalhes = self.client.get(f"/api/orders/{pedido_id}/")
        substituicao = self.criar_pedido(chave="order-after-expiry", quantidade="10.000")

        self.assertEqual(detalhes.status_code, 200)
        self.assertEqual(detalhes.data["status"], Pedido.Situacao.EXPIRADO)
        self.assertEqual(substituicao.status_code, 201, substituicao.data)

    def test_notificacao_assinada_rejeita_valor_incorreto(self):
        pedido_id = self.criar_pedido().data["id"]
        self.client.post(
            f"/api/orders/{pedido_id}/pix/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY="payment-pix-wrong-amount",
        )
        pagamento = TentativaPagamento.objects.get(pedido_id=pedido_id)
        conteudo = {
            "eventId": "evt-wrong-amount",
            "paymentReference": pagamento.referencia_provedor,
            "status": "paid",
            "amountCents": pagamento.valor_centavos + 1,
        }
        corpo = json.dumps(conteudo, separators=(",", ":")).encode("utf-8")
        assinatura = hmac.new(b"test-webhook-secret", corpo, hashlib.sha256).hexdigest()

        resposta = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            corpo,
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE=assinatura,
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(Pedido.objects.get(pk=pedido_id).situacao, Pedido.Situacao.PENDENTE)

    def test_notificacao_rejeita_assinatura_invalida(self):
        resposta = self.client.generic(
            "POST",
            "/api/payments/webhooks/sandbox/",
            b'{"eventId":"evt","paymentReference":"ref","status":"paid","amountCents":100}',
            content_type="application/json",
            HTTP_X_PAYMENT_SIGNATURE="invalid",
        )

        self.assertEqual(resposta.status_code, 401)


    def test_compra_cria_reserva_sem_compromisso_duplicado(self):
        resposta = self.criar_pedido(quantidade="2.125")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        reserva = Reserva.objects.get(pedido_id=resposta.data["id"])
        self.assertEqual(reserva.empresa_compradora_id, self.compradora.pk)
        self.assertEqual(reserva.produto_id, self.produto.pk)
        self.assertEqual(reserva.modalidade, "compromisso")
        self.assertEqual(quantidade_comprometida(self.produto.pk), Decimal("2.125"))
        self.assertEqual(self.criar_pedido(quantidade="2.125").data["id"], resposta.data["id"])
        self.assertEqual(Reserva.objects.filter(pedido_id=resposta.data["id"]).count(), 1)

    def test_falha_reserva_desfaz_criacao_pedido(self):
        with patch('pedidos.servicos._sincronizar_reserva_pedido', side_effect=ErroRegraNegocio("Falha de reserva")):
            resposta = self.criar_pedido()
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(Pedido.objects.exists())
        self.assertFalse(Reserva.objects.exists())
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10.000"))

    def test_reserva_manual_firme_limita_compra(self):
        Reserva.objects.create(
            produto=self.produto, empresa_compradora=self.compradora,
            modalidade="compromisso", quantidade_reservada=Decimal("8.000"),
            preco_unitario=Decimal("12.50"), situacao="pronta",
            nome_comprador=self.compradora.razao_social, numero_comprador=self.compradora.telefone_whatsapp,
        )
        resposta = self.criar_pedido(quantidade="3.000")
        self.assertEqual(resposta.status_code, 400, resposta.data)
        resposta = self.criar_pedido(chave="fits-manual-reservation", quantidade="2.000")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        self.assertEqual(quantidade_comprometida(self.produto.pk), Decimal("10.000"))

    def test_cancelamento_atualiza_reserva_vinculada(self):
        criado = self.criar_pedido()
        resposta = self.client.post(f"/api/orders/{criado.data['id']}/cancel/", {}, format="json")
        self.assertEqual(resposta.status_code, 200, resposta.data)
        reserva = Reserva.objects.get(pedido_id=criado.data["id"])
        self.assertEqual(reserva.situacao, "cancelada")
        self.assertEqual(quantidade_comprometida(self.produto.pk), Decimal("0"))

    def test_vendedora_nao_finaliza_reserva_pedido_manualmente(self):
        criado = self.criar_pedido()
        reserva = Reserva.objects.get(pedido_id=criado.data["id"])
        self.autenticar_como(self.vendedora)
        resposta = self.client.patch(
            f"/api/inventory/reservations/{reserva.pk}/", {"status": "finalizada"}, format="json",
        )
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10.000"))

    def test_expiracao_nao_sobrescreve_pagamento_recente(self):
        from pedidos.servicos import atualizar_situacao_pedido
        criado = self.criar_pedido()
        desatualizado = Pedido.objects.get(pk=criado.data["id"])
        Pedido.objects.filter(pk=desatualizado.pk).update(
            situacao=Pedido.Situacao.PAGO, pago_em=timezone.now(),
            reserva_expira_em=timezone.now() - timedelta(minutes=1),
        )
        atualizado = atualizar_situacao_pedido(desatualizado)
        self.assertEqual(atualizado.situacao, Pedido.Situacao.PAGO)
        self.assertEqual(Pedido.objects.get(pk=desatualizado.pk).situacao, Pedido.Situacao.PAGO)

    def test_nova_tentativa_rejeita_anuncio_inativo(self):
        criado = self.criar_pedido()
        pedido = Pedido.objects.get(pk=criado.data["id"])
        Pedido.objects.filter(pk=pedido.pk).update(situacao=Pedido.Situacao.FALHOU)
        Anuncio.objects.filter(pk=self.anuncio.pk).update(situacao_anuncio="inativo")
        resposta = self.client.post(
            f"/api/orders/{pedido.pk}/pix/", {}, format="json", HTTP_IDEMPOTENCY_KEY="retry-inactive",
        )
        self.assertEqual(resposta.status_code, 409, resposta.data)

    def test_compra_rejeita_total_acima_limite(self):
        self.produto.quantidade = Decimal("999999999.000")
        self.produto.save(update_fields=["quantidade"])
        self.anuncio.nr_qtd = Decimal("999999999.000")
        self.anuncio.preco_final = Decimal("9999999999.00")
        self.anuncio.save(update_fields=["nr_qtd", "preco_final"])
        resposta = self.criar_pedido(quantidade="999999999.000")
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(Pedido.objects.exists())


    def test_notificacao_rejeita_identificadores_acima_limite(self):
        from pedidos.models import EventoWebhook
        corpo = json.dumps({
            "eventId": "x" * 161, "paymentReference": "valid-reference",
            "status": "paid", "amountCents": 100,
        }).encode("utf-8")
        assinatura = hmac.new(b"test-webhook-secret", corpo, hashlib.sha256).hexdigest()
        resposta = self.client.generic(
            "POST", "/api/payments/webhooks/sandbox/", corpo,
            content_type="application/json", HTTP_X_PAYMENT_SIGNATURE=assinatura,
        )
        self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(EventoWebhook.objects.exists())
