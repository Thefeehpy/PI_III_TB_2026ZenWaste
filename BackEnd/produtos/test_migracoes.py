"""Valida dados historicos durante a mudanca de estrutura no banco isolado de testes.

A reversao cobre uma imagem original por anuncio. Colecoes novas com varias
imagens nao podem ser representadas integralmente pela antiga coluna de URL unica.
"""

from datetime import timedelta
from decimal import Decimal
import uuid

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class TestesMigracaoEstruturaEstoque(TransactionTestCase):
    migracoes_origem = [
        ("empresas", "0001_initial"),
        ("produtos", "0007_remove_produto_meta"),
        ("anuncios", "0008_alter_anuncio_imagem_url"),
        ("pedidos", "0003_order_cancellation_requested"),
    ]

    def migrar(self, destinos):
        executor = MigrationExecutor(connection)
        executor.migrate(destinos)
        return executor.loader.project_state(destinos).apps

    def test_avanco_e_reversao_preservam_identidade_estoque_e_historico_compras(self):
        migracoes_atuais = MigrationExecutor(connection).loader.graph.leaf_nodes()
        try:
            legado = self.migrar(self.migracoes_origem)
            EmpresaHistorica = legado.get_model("empresas", "Empresa")
            ProdutoHistorico = legado.get_model("produtos", "Produto")
            MovimentacaoHistorica = legado.get_model("produtos", "MovimentacaoEstoque")
            AnuncioHistorico = legado.get_model("anuncios", "Anuncio")
            ReservaHistorica = legado.get_model("anuncios", "Reserva")
            PedidoHistorico = legado.get_model("pedidos", "Order")
            PagamentoHistorico = legado.get_model("pedidos", "PaymentAttempt")
            EventoHistorico = legado.get_model("pedidos", "WebhookEvent")
            hash_senha = make_password("cenario-sintetico-migracao")
            vendedora = EmpresaHistorica.objects.create(
                id_empresa=101, cnpj="11.111.111/0001-11", razao_social="Geradora historica",
                telefone_whatsapp="11911111111", email="vendedora-migracao@example.test",
                senha=hash_senha, descricao_segmento="Industria",
            )
            compradora = EmpresaHistorica.objects.create(
                id_empresa=102, cnpj="22.222.222/0001-22", razao_social="Compradora historica",
                telefone_whatsapp="11922222222", email="compradora-migracao@example.test",
                senha=hash_senha, descricao_segmento="Reciclagem",
            )
            produto_bloqueado = ProdutoHistorico.objects.create(
                id_produto=201, empresa=vendedora, tipo_produto="  Plastico  ", unidade="KG",
                descricao_produto="Nome original do material", quantidade=Decimal("8.000"), status="disponivel",
            )
            MovimentacaoHistorica.objects.create(
                id_movimentacao=301, empresa=vendedora, produto=produto_bloqueado, tipo="entrada",
                quantidade=Decimal("10.000"), saldo_resultante=Decimal("10.000"), observacao="Entrada historica",
            )
            MovimentacaoHistorica.objects.create(
                id_movimentacao=302, empresa=vendedora, produto=produto_bloqueado, tipo="saida",
                quantidade=Decimal("2.000"), saldo_resultante=Decimal("8.000"), observacao="Compra ja paga",
            )
            url_imagem = "https://example.test/original/" + "x" * 300 + ".png"
            anuncio = AnuncioHistorico.objects.create(
                id_anuncio=401, produto=produto_bloqueado, preco_final=Decimal("2.00"), nr_qtd=Decimal("8.00"),
                status_anuncio="ativo", imagem_url=url_imagem, descricao_especifica="Descricao negociada",
            )
            ReservaHistorica.objects.create(
                id_reserva=501, produto=produto_bloqueado, quantidade_reservada=Decimal("20.000"),
                preco_unitario=Decimal("0.00"), status="em_captacao",
                nome_comprador="Contato legado", numero_comprador="11933333333",
            )
            id_pendente = uuid.UUID("00000000-0000-0000-0000-000000000601")
            id_pago = uuid.UUID("00000000-0000-0000-0000-000000000602")
            campos_comuns = {
                "buyer_company": compradora, "listing": anuncio, "unit_price": Decimal("2.00"),
                "buyer_name": compradora.razao_social, "buyer_email": compradora.email,
                "buyer_phone": compradora.telefone_whatsapp, "buyer_document": "22222222000122",
                "item_name": "Nome original do material", "item_unit": "KG",
                "item_image_url": url_imagem,
                "reservation_expires_at": timezone.now() + timedelta(minutes=30),
                "creation_fingerprint": "f" * 64,
            }
            pendente = PedidoHistorico.objects.create(
                **campos_comuns, id=id_pendente, number="ZW-MIGRACAO-PENDENTE", status="pending",
                quantity=Decimal("3.000"), total_amount=Decimal("6.00"), creation_idempotency_key="chave-pendente",
            )
            pago_em = timezone.now() - timedelta(minutes=10)
            pago = PedidoHistorico.objects.create(
                **campos_comuns, id=id_pago, number="ZW-MIGRACAO-PAGO", status="paid", paid_at=pago_em,
                quantity=Decimal("2.000"), total_amount=Decimal("4.00"), creation_idempotency_key="chave-pago",
            )
            id_pagamento = uuid.UUID("00000000-0000-0000-0000-000000000701")
            pagamento = PagamentoHistorico.objects.create(
                id=id_pagamento, order=pago, provider="cenario", method="pix", status="paid",
                idempotency_key="chave-pagamento", request_fingerprint="p" * 64,
                provider_reference="referencia-cenario-pago", amount_cents=400,
            )
            EventoHistorico.objects.create(
                id=801, provider="cenario", event_id="evento-cenario-pago", payment=pagamento, processed=True,
            )
            produto_cadastrado_em = produto_bloqueado.data_registro
            pedido_criado_em = pendente.created_at

            novo = self.migrar(migracoes_atuais)
            EmpresaNova = novo.get_model("empresas", "Empresa")
            ProdutoNovo = novo.get_model("produtos", "Produto")
            MovimentacaoNova = novo.get_model("produtos", "MovimentacaoEstoque")
            ImagemNova = novo.get_model("anuncios", "ImagemAnuncio")
            ReservaNova = novo.get_model("anuncios", "Reserva")
            PedidoNovo = novo.get_model("pedidos", "Pedido")
            PagamentoNovo = novo.get_model("pedidos", "TentativaPagamento")
            EventoNovo = novo.get_model("pedidos", "EventoWebhook")
            produto_migrado = ProdutoNovo.objects.get(pk=produto_bloqueado.pk)
            self.assertEqual(produto_migrado.nome_residuo, "Nome original do material")
            self.assertEqual(produto_migrado.descricao_produto, "")
            self.assertEqual(produto_migrado.empresa_id, vendedora.pk)
            self.assertEqual(produto_migrado.quantidade, Decimal("8.000"))
            self.assertEqual(produto_migrado.data_registro, produto_cadastrado_em)
            self.assertEqual(produto_migrado.categoria.nome_material, "Plastico")
            self.assertEqual(produto_migrado.unidade_medida.sigla, "kg")
            self.assertEqual(set(MovimentacaoNova.objects.values_list("pk", flat=True)), {301, 302})
            self.assertEqual(MovimentacaoNova.objects.get(pk=302).saldo_resultante, Decimal("8.000"))
            capa = ImagemNova.objects.get(anuncio_id=anuncio.pk)
            self.assertEqual(capa.url_arquivo, url_imagem)
            self.assertTrue(capa.eh_capa)
            self.assertEqual(capa.ordem, 0)
            self.assertEqual(EmpresaNova.objects.get(pk=vendedora.pk).senha, hash_senha)
            vinculos = novo.get_model("empresas", "EmpresaPapel")
            self.assertEqual(set(vinculos.objects.filter(empresa_id=vendedora.pk).values_list("papel__codigo", flat=True)), {"vendedora", "compradora"})
            self.assertEqual(novo.get_model("empresas", "PapelEmpresa").objects.count(), 3)
            captacao_legada = ReservaNova.objects.get(pk=501)
            self.assertEqual(captacao_legada.modalidade, "captacao")
            self.assertIsNone(captacao_legada.empresa_compradora_id)
            self.assertIsNone(captacao_legada.pedido_id)
            reserva_pendente = ReservaNova.objects.get(pedido_id=id_pendente)
            self.assertEqual(reserva_pendente.produto_id, produto_bloqueado.pk)
            self.assertEqual(reserva_pendente.empresa_compradora_id, compradora.pk)
            self.assertEqual(reserva_pendente.modalidade, "compromisso")
            self.assertEqual(reserva_pendente.situacao, "pronta")
            self.assertEqual(reserva_pendente.quantidade_reservada, Decimal("3.000"))
            self.assertEqual(reserva_pendente.data_reserva, pedido_criado_em)
            reserva_paga = ReservaNova.objects.get(pedido_id=id_pago)
            self.assertEqual(reserva_paga.situacao, "finalizada")
            self.assertEqual(reserva_paga.data_finalizacao, pago_em)
            self.assertEqual(ReservaNova.objects.count(), 3)
            self.assertEqual(ReservaNova.objects.filter(pedido__isnull=False).count(), 2)
            self.assertEqual(PedidoNovo.objects.get(pk=id_pago).situacao, "paid")
            self.assertEqual(PedidoNovo.objects.get(pk=id_pago).chave_idempotencia_criacao, "chave-pago")
            self.assertEqual(PagamentoNovo.objects.get(pk=id_pagamento).valor_centavos, 400)
            self.assertEqual(EventoNovo.objects.get(pk=801).pagamento_id, id_pagamento)
            self.assertTrue(EventoNovo.objects.get(pk=801).processado)
            # Migracoes de dados nao podem baixar novamente os 2 kg da compra ja paga.
            self.assertEqual(MovimentacaoNova.objects.count(), 2)

            restaurado = self.migrar(self.migracoes_origem)
            produto_restaurado = restaurado.get_model("produtos", "Produto").objects.get(pk=produto_bloqueado.pk)
            self.assertEqual(produto_restaurado.descricao_produto, "Nome original do material")
            self.assertEqual(produto_restaurado.tipo_produto, "Plastico")
            self.assertEqual(produto_restaurado.unidade, "kg")
            self.assertEqual(produto_restaurado.quantidade, Decimal("8.000"))
            self.assertEqual(restaurado.get_model("produtos", "MovimentacaoEstoque").objects.get(pk=302).empresa_id, vendedora.pk)
            self.assertEqual(restaurado.get_model("anuncios", "Anuncio").objects.get(pk=anuncio.pk).imagem_url, url_imagem)
            self.assertEqual(restaurado.get_model("pedidos", "Order").objects.get(pk=id_pago).status, "paid")
            self.assertEqual(restaurado.get_model("empresas", "Empresa").objects.get(pk=vendedora.pk).senha, hash_senha)
            reservas_restauradas = restaurado.get_model("anuncios", "Reserva")
            self.assertEqual(reservas_restauradas.objects.count(), 1)
            self.assertEqual(reservas_restauradas.objects.get().pk, 501)
            self.assertEqual(reservas_restauradas.objects.get().quantidade_reservada, Decimal("20.000"))
        finally:
            # A limpeza do TransactionTestCase e os proximos testes exigem a estrutura atual.
            reaplicado = self.migrar(migracoes_atuais)

        # Reaplicar deve recriar somente as duas reservas derivadas dos pedidos,
        # sem transformar reservas vinculadas em metas de captacao fantasmas.
        reservas_reaplicadas = reaplicado.get_model("anuncios", "Reserva")
        self.assertEqual(reservas_reaplicadas.objects.count(), 3)
        self.assertEqual(reservas_reaplicadas.objects.filter(pedido__isnull=False).count(), 2)
        self.assertEqual(reservas_reaplicadas.objects.filter(modalidade="captacao").count(), 1)
        self.assertEqual(reservas_reaplicadas.objects.get(modalidade="captacao").pk, 501)
