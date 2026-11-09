"""Persistência e API reais. Executar exclusivamente no PostgreSQL descartável."""

import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
import json
import struct
from threading import Barrier
import uuid
from unittest.mock import patch
import zlib

from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from anuncios.models import Anuncio, Reserva
from app.excecoes import ErroConflito, ErroRegraNegocio
from autenticacao.servicos import gerar_token
from empresas.models import Empresa, EmpresaPapel, PapelEmpresa
from fretes.models import ConfirmacaoEntrega, CotacaoFrete, DemandaTransporte, DivergenciaFrete, DocumentoCTe, Frete, HistoricoFrete
from fretes.servicos import criar_frete, executar_comando_frete
from pedidos.models import Pedido
from produtos.models import CategoriaResiduo, MovimentacaoEstoque, Produto, UnidadeMedida


class TestesPreRequisicaoFretes(SimpleTestCase):
    def test_navegador_pode_enviar_chave_de_idempotencia(self):
        resposta = self.client.options(
            '/api/fretes/', HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type,idempotency-key',
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta['Access-Control-Allow-Origin'], 'http://127.0.0.1:5173')
        self.assertIn('idempotency-key', resposta['Access-Control-Allow-Headers'])


def assinatura_sintetica():
    def bloco(tipo, dados):
        return struct.pack(">I", len(dados)) + tipo + dados + struct.pack(">I", zlib.crc32(tipo + dados) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + bloco(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
    png += bloco(b"IDAT", zlib.compress(b"\x00\x00\x00\x00\xff")) + bloco(b"IEND", b"")
    return "data:image/png;base64," + base64.b64encode(png).decode()


class CenarioFretes:
    def setUp(self):
        super().setUp()
        self.assertEqual(connection.vendor, "postgresql", "Esta suíte exige PostgreSQL.")
        self.assertTrue(connection.settings_dict["NAME"].startswith("test_zenwaste_fretes_"), "Use o executor descartável de fretes.")
        empresas = []
        for indice, papel in enumerate(("vendedora", "compradora", "transportadora", "transportadora", "compradora"), 1):
            empresa = Empresa.objects.create(
                razao_social=f"Empresa sintética de teste {indice}", cnpj=f"{indice:014d}",
                telefone_whatsapp=f"110000000{indice:02d}", email=f"empresa-{indice}@example.test", senha="hash-sintetico-sem-login",
            )
            cargo, _ = PapelEmpresa.objects.get_or_create(codigo=papel, defaults={"descricao": papel})
            EmpresaPapel.objects.create(empresa=empresa, papel=cargo)
            empresas.append(empresa)
        self.vendedora, self.compradora, self.transportadora, self.concorrente, self.terceira = empresas
        categoria = CategoriaResiduo.objects.create(nome_material="Categoria sintética")
        unidade = UnidadeMedida.objects.create(sigla="KG", descricao="Quilograma")
        self.produto = Produto.objects.create(
            empresa=self.vendedora, categoria=categoria, unidade_medida=unidade,
            nome_residuo="Material sintético", quantidade=Decimal("100.000"), situacao="disponivel",
        )
        self.anuncio = Anuncio.objects.create(produto=self.produto, preco_final=Decimal("2.00"), nr_qtd=Decimal("100.000"))
        self.pedido = Pedido.objects.create(
            numero="ZW-TESTE-FRETES", empresa_compradora=self.compradora, anuncio=self.anuncio,
            situacao=Pedido.Situacao.PAGO, quantidade=Decimal("10.000"), preco_unitario=Decimal("2.00"), valor_total=Decimal("20.00"),
            nome_comprador="Compradora de teste", email_comprador=self.compradora.email, documento_comprador=self.compradora.cnpj,
            telefone_comprador=self.compradora.telefone_whatsapp, nome_material_negociado="Material negociado",
            unidade_material_negociado="KG", chave_idempotencia_criacao="pedido-sintetico", resumo_dados_criacao="a" * 64,
            reserva_expira_em=timezone.now() + timedelta(days=1),
        )
        self.reserva = Reserva.objects.create(
            pedido=self.pedido, produto=self.produto, empresa_compradora=self.compradora, modalidade="compromisso",
            situacao="finalizada", quantidade_reservada=10, preco_unitario=2,
            nome_comprador="Compradora de teste", numero_comprador=self.compradora.telefone_whatsapp,
        )

    def entrada(self, **campos):
        return {
            "empresa_compradora_id": self.compradora.pk, "material": "Material avulso", "unidade": "KG",
            "quantidade": "3.000", "origem": "Origem de teste", "destino": "Destino de teste",
            "peso_toneladas": "0.003", "cubagem_m3": "1.000", "quantidade_volumes": 1, **campos,
        }

    def novo(self, **campos):
        return criar_frete(self.vendedora, self.entrada(**campos), uuid.uuid4().hex)

    def comando(self, frete, acao, dados, *, empresa=None, chave=None):
        return executar_comando_frete(empresa or self.vendedora, frete.pk, acao, dados, chave or uuid.uuid4().hex)

    def contratado(self, **campos):
        return self.comando(self.novo(**campos), "classificar", {
            "modalidade": "contratado", "transportadora_id": self.transportadora.pk, "valor_referencia": "500.00",
        })

    def divergente(self):
        return self.comando(self.contratado(), "registrar-cte", {"numero": "CTE-TESTE-V1", "valor": "650.00"})

    def recebimento(self, **campos):
        return {"nome_recebedor": "Recebedor sintético", "dados_assinatura": assinatura_sintetica(), "tipo_recebimento": "completo", **campos}

    def cliente(self, empresa=None):
        cliente = APIClient()
        if empresa:
            cliente.credentials(HTTP_AUTHORIZATION="Bearer " + gerar_token(empresa))
        return cliente


class TestesPersistenciaFretes(CenarioFretes, TestCase):
    def test_cria_avulso_sem_criar_cadastros_comerciais(self):
        frete = self.novo()
        self.assertIsNone(frete.pedido_id)
        self.assertEqual(frete.empresa_vendedora, self.vendedora)
        self.assertEqual(Pedido.objects.count(), 1)
        self.assertEqual(Produto.objects.count(), 1)
        self.assertEqual(Reserva.objects.count(), 1)
        self.assertEqual(frete.historico.get().autora, self.vendedora)

    def test_pedido_define_material_compradora_unidade_e_limita_remessas(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        self.assertEqual(frete.material, self.pedido.nome_material_negociado)
        self.assertEqual(frete.unidade, "KG")
        with self.assertRaises(ErroConflito):
            self.novo(pedido_id=str(self.pedido.pk), quantidade="4.000")
        self.novo(pedido_id=str(self.pedido.pk), quantidade="3.000")
        self.assertEqual(Frete.objects.count(), 2)

    def test_unidade_incompativel_e_pedido_de_terceiro_sao_rejeitados(self):
        with self.assertRaises(ErroRegraNegocio):
            self.novo(pedido_id=str(self.pedido.pk), unidade="TON")
        with self.assertRaises(ErroRegraNegocio):
            criar_frete(self.terceira, self.entrada(pedido_id=str(self.pedido.pk)), "pedido-terceiro")
        self.assertEqual(Frete.objects.count(), 0)

    def test_classificacao_contratada_exige_referencia_sem_cotacao_ficticia(self):
        frete = self.novo()
        with self.assertRaises(ErroRegraNegocio):
            self.comando(frete, "classificar", {"modalidade": "contratado"})
        frete = self.comando(frete, "classificar", {
            "modalidade": "contratado", "valor_referencia": "500", "transportadora_id": self.transportadora.pk,
        })
        self.assertEqual(frete.situacao, "aguardando_conferencia")
        self.assertFalse(frete.cotacoes.exists())

    def test_cotacao_aprovada_e_referencia_persistente(self):
        frete = self.comando(self.novo(), "classificar", {"modalidade": "cotar"})
        frete = self.comando(frete, "cotacoes", {"transportadora_id": self.transportadora.pk, "valor": "500", "prazo_dias": 2})
        cotacao = frete.cotacoes.get()
        frete = self.comando(frete, "aprovar-cotacao", {"cotacao_id": str(cotacao.pk)})
        self.assertEqual(frete.valor_referencia, Decimal("500.00"))
        self.assertEqual(frete.transportadora, self.transportadora)
        self.assertTrue(frete.cotacoes.get().aprovada)
        with self.assertRaises(ErroConflito):
            self.comando(frete, "aprovar-cotacao", {"cotacao_id": str(cotacao.pk)})

    def test_tolerancia_positiva_e_negativa_em_persistencia(self):
        for valor, aberta in (("505.00", False), ("495.00", False), ("505.01", True), ("494.99", True)):
            with self.subTest(valor=valor):
                frete = self.comando(self.contratado(), "registrar-cte", {"numero": "CTE-TESTE", "valor": valor})
                self.assertEqual(frete.divergencia_aberta, aberta)
                self.assertEqual(frete.documentos.count(), 1)

    def test_correcao_ainda_divergente_preserva_documentos_e_substitui_analise(self):
        frete = self.divergente()
        anterior = frete.divergencias.get()
        frete = self.comando(frete, "registrar-cte", {"numero": "CTE-TESTE-V2", "valor": "620.00"})
        anterior.refresh_from_db()
        self.assertEqual(anterior.tipo_resolucao, "cte_corrigido")
        self.assertEqual(anterior.documento_correcao.versao, 2)
        self.assertEqual(anterior.valor_cobrado, Decimal("650.00"))
        nova = frete.divergencias.get(resolvida_em__isnull=True)
        self.assertEqual(nova.valor_referencia, Decimal("500.00"))
        self.assertEqual(nova.diferenca, Decimal("120.00"))
        self.assertEqual(frete.documentos.count(), 2)
        self.assertEqual(frete.situacao, "com_divergencia")
        self.assertEqual(frete.historico.filter(acao="registrar-cte").count(), 2)

    def test_correcao_dentro_tolerancia_resolve_sem_apagar_analise(self):
        frete = self.comando(self.divergente(), "registrar-cte", {"numero": "CTE-TESTE-V2", "valor": "500.00"})
        self.assertFalse(frete.divergencia_aberta)
        self.assertEqual(frete.divergencias.count(), 1)
        self.assertEqual(frete.situacao, "aguardando_entrega")

    def test_aceite_justificado_preserva_diferenca_factual(self):
        frete = self.comando(self.divergente(), "resolver-divergencia", {"justificativa": "Custo adicional conferido."})
        self.assertTrue(frete.divergente)
        self.assertFalse(frete.divergencia_aberta)
        self.assertEqual(frete.valor_referencia, Decimal("500.00"))
        self.assertEqual(frete.divergencias.get().empresa_resolvedora, self.vendedora)

    def test_recebimento_divergente_e_resolucao_posterior_sem_nova_baixa(self):
        frete = self.divergente()
        frete = self.comando(frete, "retirada", {"nome_foto": "foto-teste.png"})
        frete = self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora)
        self.assertEqual(frete.situacao, "com_divergencia")
        self.assertTrue(frete.recebimento_confirmado)
        frete = self.comando(frete, "resolver-divergencia", {"justificativa": "Aceito após recebimento."})
        self.assertEqual(frete.situacao, "concluido")
        self.assertEqual(ConfirmacaoEntrega.objects.count(), 1)
        self.produto.refresh_from_db(); self.pedido.refresh_from_db(); self.reserva.refresh_from_db(); self.anuncio.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("100.000"))
        self.assertEqual(self.pedido.situacao, Pedido.Situacao.PAGO)
        self.assertEqual(self.reserva.situacao, "finalizada")
        self.assertEqual(self.anuncio.nr_qtd, Decimal("100.000"))
        self.assertFalse(MovimentacaoEstoque.objects.exists())

    def test_correcao_posterior_ao_recebimento_conclui_auditoria(self):
        frete = self.comando(self.divergente(), "confirmar-entrega", self.recebimento(), empresa=self.compradora)
        frete = self.comando(frete, "registrar-cte", {"numero": "CTE-TESTE-V2", "valor": "500"})
        self.assertEqual(frete.situacao, "concluido")

    def test_retirada_cliente_dispensa_cte_e_cotacao(self):
        frete = self.comando(self.novo(), "classificar", {"modalidade": "retirada_cliente"})
        self.assertIsNone(frete.valor_referencia)
        with self.assertRaises(ErroConflito):
            self.comando(frete, "registrar-cte", {"numero": "INDEVIDO", "valor": "0"})
        frete = self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora)
        self.assertEqual(frete.situacao, "concluido")
        self.assertEqual(frete.cotacoes.count(), 0)
        self.assertEqual(frete.documentos.count(), 0)

    def test_cancelamento_libera_alocacao_sem_efeito_comercial(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="10.000")
        self.comando(frete, "cancelar", {"justificativa": "Coleta desnecessária."})
        self.novo(pedido_id=str(self.pedido.pk), quantidade="10.000")
        self.pedido.refresh_from_db(); self.reserva.refresh_from_db()
        self.assertEqual(self.pedido.situacao, Pedido.Situacao.PAGO)
        self.assertEqual(self.reserva.situacao, "finalizada")
        self.assertEqual(MovimentacaoEstoque.objects.count(), 0)

    def test_cancelamento_bloqueado_apos_retirada_ou_recebimento(self):
        for acao in ("retirada", "confirmar-entrega"):
            frete = self.divergente()
            frete = self.comando(frete, acao, {"nome_foto": "teste.png"} if acao == "retirada" else self.recebimento(), empresa=self.vendedora if acao == "retirada" else self.compradora)
            with self.assertRaises(ErroConflito):
                self.comando(frete, "cancelar", {"justificativa": "Cancelamento indevido."})

    def test_falha_no_historico_reverte_correcao_documento_e_analises(self):
        frete = self.divergente()
        quantidade_historico = frete.historico.count()
        with patch("fretes.servicos._historico", side_effect=RuntimeError("falha sintética após gravações reais")):
            with self.assertRaises(RuntimeError):
                self.comando(frete, "registrar-cte", {"numero": "CTE-TESTE-V2", "valor": "620"})
        self.assertEqual(DocumentoCTe.objects.filter(frete=frete).count(), 1)
        self.assertEqual(DivergenciaFrete.objects.filter(frete=frete).count(), 1)
        self.assertIsNone(DivergenciaFrete.objects.get(frete=frete).resolvida_em)
        self.assertEqual(HistoricoFrete.objects.filter(frete=frete).count(), quantidade_historico)

    def test_falha_no_historico_reverte_confirmacao(self):
        frete = self.divergente()
        with patch("fretes.servicos._historico", side_effect=RuntimeError("falha sintética")):
            with self.assertRaises(RuntimeError):
                self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora)
        self.assertFalse(ConfirmacaoEntrega.objects.filter(frete=frete).exists())

    def test_idempotencia_na_criacao_comandos_e_conflito_de_conteudo(self):
        dados = self.entrada()
        primeiro = criar_frete(self.vendedora, dados, "criacao-repetida")
        segundo = criar_frete(self.vendedora, dados, "criacao-repetida")
        self.assertEqual(primeiro.pk, segundo.pk)
        with self.assertRaises(ErroConflito):
            criar_frete(self.vendedora, {**dados, "quantidade": "4"}, "criacao-repetida")
        for _ in range(2):
            self.comando(primeiro, "tratativas", {"observacao": "Contato interno."}, chave="mesma-tratativa")
        self.assertEqual(HistoricoFrete.objects.filter(frete=primeiro, acao="tratativas").count(), 1)
        with self.assertRaises(ErroConflito):
            self.comando(primeiro, "tratativas", {"observacao": "Outro conteúdo."}, chave="mesma-tratativa")
        with self.assertRaises(ErroConflito):
            self.comando(self.novo(), "tratativas", {"observacao": "Contato interno."}, chave="mesma-tratativa")

    def test_constraints_reais_impedem_quantidade_e_cancelamento_invalidos(self):
        frete = self.novo()
        for alteracoes in ({"quantidade": -1}, {"situacao": "cancelado"}):
            with self.subTest(alteracoes=alteracoes):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Frete.objects.filter(pk=frete.pk).update(**alteracoes)

    def test_repeticao_cte_nao_cria_documento_ou_historico_duplicado(self):
        frete = self.contratado()
        for _ in range(2):
            self.comando(frete, "registrar-cte", {"numero": "CTE-IDEMPOTENTE", "valor": "650"}, chave="cte-repetido")
        self.assertEqual(DocumentoCTe.objects.count(), 1)
        self.assertEqual(DivergenciaFrete.objects.count(), 1)
        self.assertEqual(HistoricoFrete.objects.filter(acao="registrar-cte").count(), 1)

    def test_falha_na_criacao_nao_reserva_chave_nem_deixa_frete_parcial(self):
        with patch("fretes.servicos._historico", side_effect=RuntimeError("falha sintética")):
            with self.assertRaises(RuntimeError):
                criar_frete(self.vendedora, self.entrada(), "criacao-com-falha")
        self.assertEqual(Frete.objects.count(), 0)
        self.assertEqual(HistoricoFrete.objects.count(), 0)
        criar_frete(self.vendedora, self.entrada(), "criacao-com-falha")
        self.assertEqual(Frete.objects.count(), 1)

    def test_constraints_reais_da_divergencia_e_documento(self):
        frete = self.divergente()
        divergencia = frete.divergencias.get()
        for alteracoes in ({"diferenca": 1}, {"documento_correcao_id": divergencia.documento_id, "tipo_resolucao": "cte_corrigido", "resolvida_em": timezone.now(), "empresa_resolvedora": self.vendedora}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                DivergenciaFrete.objects.filter(pk=divergencia.pk).update(**alteracoes)
        with self.assertRaises(IntegrityError), transaction.atomic():
            DocumentoCTe.objects.create(frete=frete, versao=1, numero="DUPLICADO", valor=1)


class TestesAPIFretes(CenarioFretes, TestCase):
    def test_fluxo_http_cotacao_documentos_recebimento_e_auditoria(self):
        cliente = self.cliente(self.vendedora)
        resposta = cliente.post("/api/fretes/", self.entrada(pedido_id=str(self.pedido.pk)), format="json", HTTP_IDEMPOTENCY_KEY="fluxo-http-criar")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        identificador = resposta.json()["id"]
        def enviar(acao, dados, autor=cliente):
            resposta = autor.post(f"/api/fretes/{identificador}/{acao}/", dados, format="json", HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex)
            self.assertEqual(resposta.status_code, 200, resposta.data)
            return resposta.json()
        enviar("classificar", {"modalidade": "cotar"})
        cotacoes = enviar("cotacoes", {"transportadora_id": self.transportadora.pk, "valor": "500.00", "prazo_dias": 2})
        enviar("aprovar-cotacao", {"cotacao_id": cotacoes["cotacoes"][0]["id"]})
        enviar("registrar-cte", {"numero": "CTE-HTTP-1", "valor": "650.00"})
        enviar("retirada", {"nome_foto": "retirada-teste.png"})
        recebido = enviar("confirmar-entrega", self.recebimento(), self.cliente(self.compradora))
        self.assertEqual(recebido["situacao"], "com_divergencia")
        corrigido = enviar("registrar-cte", {"numero": "CTE-HTTP-2", "valor": "620.00"})
        self.assertEqual(len(corrigido["documentos"]), 2)
        concluido = enviar("resolver-divergencia", {"justificativa": "Cobrança corrigida aceita."})
        self.assertEqual(concluido["situacao"], "concluido")
        self.assertEqual(concluido["valor_referencia"], "500.00")
        self.assertEqual(len(concluido["divergencias"]), 2)
        self.assertTrue(concluido["entrega"]["assinatura_registrada"])
        self.assertEqual(cliente.get("/api/fretes/compradoras/").status_code, 200)
        outro = self.novo()
        resposta = cliente.post(f"/api/fretes/{outro.pk}/cancelar/", {"justificativa": "Cancelamento HTTP autorizado."}, format="json", HTTP_IDEMPOTENCY_KEY="cancelar-http")
        self.assertEqual(resposta.status_code, 200, resposta.data)

    def test_api_criacao_detalhe_e_decimais_compativeis(self):
        cliente = self.cliente(self.vendedora)
        resposta = cliente.post("/api/fretes/", self.entrada(previsao_entrega=""), format="json", HTTP_IDEMPOTENCY_KEY="criar-api")
        self.assertEqual(resposta.status_code, 201, resposta.data)
        dados = resposta.json()
        self.assertEqual(dados["quantidade"], "3.000")
        self.assertEqual(dados["peso_toneladas"], "0.003")
        self.assertIsNone(dados["modalidade"])
        self.assertEqual(cliente.get(f"/api/fretes/{dados['id']}/").status_code, 200)
        self.assertEqual(cliente.patch(f"/api/fretes/{dados['id']}/", {"situacao": "concluido"}, format="json").status_code, 405)

    def test_todas_as_rotas_exigem_empresa_e_token_invalido_retorna_401(self):
        frete = self.novo()
        cliente = self.cliente()
        for caminho in ("", "compradoras/", "transportadoras/", "pedidos-disponiveis/", "demandas/", f"{frete.pk}/"):
            self.assertEqual(cliente.get("/api/fretes/" + caminho).status_code, 401)
        cliente.credentials(HTTP_AUTHORIZATION="Bearer token-invalido-de-teste")
        self.assertEqual(cliente.get("/api/fretes/").status_code, 401)

    def test_isolamento_detalhe_listas_comandos_e_assinatura(self):
        frete = self.divergente()
        cliente = self.cliente(self.terceira)
        self.assertEqual(cliente.get(f"/api/fretes/{frete.pk}/").status_code, 404)
        self.assertEqual(cliente.get("/api/fretes/").json()["paginacao"]["total"], 0)
        self.assertEqual(cliente.post(f"/api/fretes/{frete.pk}/cancelar/", {"justificativa": "Acesso indevido"}, format="json", HTTP_IDEMPOTENCY_KEY="indevido").status_code, 404)
        self.assertEqual(self.cliente(self.vendedora).post(f"/api/fretes/{frete.pk}/confirmar-entrega/", self.recebimento(), format="json", HTTP_IDEMPOTENCY_KEY="indevido-receber").status_code, 403)
        self.vendedora.ativo = False; self.vendedora.save()
        self.assertEqual(self.cliente(self.vendedora).get("/api/fretes/").status_code, 401)

    def test_assinatura_ausente_invalida_e_ressalva_sem_texto(self):
        frete = self.divergente()
        cliente = self.cliente(self.compradora)
        for dados in ({"nome_recebedor": "Teste", "tipo_recebimento": "completo"}, self.recebimento(dados_assinatura="imagem-invalida"), self.recebimento(tipo_recebimento="com_ressalva", ressalva="")):
            resposta = cliente.post(f"/api/fretes/{frete.pk}/confirmar-entrega/", dados, format="json", HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex)
            self.assertEqual(resposta.status_code, 400, resposta.data)
        self.assertFalse(ConfirmacaoEntrega.objects.exists())

    def test_recebimento_http_idempotente_sem_exposicao_da_imagem(self):
        frete = self.divergente()
        cliente = self.cliente(self.compradora)
        for _ in range(2):
            resposta = cliente.post(f"/api/fretes/{frete.pk}/confirmar-entrega/", self.recebimento(tipo_recebimento="com_ressalva", ressalva="Conferência de teste."), format="json", HTTP_IDEMPOTENCY_KEY="receber-uma-vez")
            self.assertEqual(resposta.status_code, 200, resposta.data)
            self.assertEqual(resposta.json()["situacao"], "com_divergencia")
            self.assertTrue(resposta.json()["entrega"]["assinatura_registrada"])
            self.assertNotIn("data:image", resposta.content.decode())
        self.assertEqual(ConfirmacaoEntrega.objects.count(), 1)
        self.assertNotIn("data:image", json.dumps(list(HistoricoFrete.objects.values_list("detalhes", flat=True))))

    def test_transportadora_ve_somente_cotacoes_proprias_inclusive_historico(self):
        frete = self.comando(self.novo(), "classificar", {"modalidade": "cotar"})
        for empresa, valor in ((self.transportadora, "500"), (self.concorrente, "999")):
            frete = self.comando(frete, "cotacoes", {"transportadora_id": empresa.pk, "valor": valor, "prazo_dias": 2})
        for empresa in (self.vendedora, self.compradora):
            self.assertEqual(len(self.cliente(empresa).get(f"/api/fretes/{frete.pk}/").json()["cotacoes"]), 2)
        dados = self.cliente(self.transportadora).get(f"/api/fretes/{frete.pk}/").json()
        self.assertEqual(len(dados["cotacoes"]), 1)
        self.assertEqual(dados["cotacoes"][0]["transportadora"]["id"], self.transportadora.pk)
        self.assertEqual(len([e for e in dados["historico"] if e["tipo"] == "cotacoes"]), 1)
        resposta = self.cliente(self.transportadora).post(f"/api/fretes/{frete.pk}/cancelar/", {"justificativa": "Sem gestão"}, format="json", HTTP_IDEMPOTENCY_KEY="transportadora-cancelar")
        self.assertEqual(resposta.status_code, 403)

    def test_paginacao_filtros_indicadores_e_diretorios_minimos(self):
        self.novo(material="Filtro especial")
        self.novo(); self.novo()
        cliente = self.cliente(self.vendedora)
        dados = cliente.get("/api/fretes/?tamanho_pagina=1&pagina=2").json()
        self.assertEqual(len(dados["resultados"]), 1)
        self.assertEqual(dados["paginacao"]["total"], 3)
        dados = cliente.get("/api/fretes/?busca=especial").json()
        self.assertEqual(dados["paginacao"]["total"], 1)
        self.assertEqual(dados["indicadores"]["aguardando_classificacao"], 3)
        for consulta in ("situacao=cancelado", "transportadora_id=999999", "data_inicio=2099-01-01", "data_fim=2000-01-01"):
            self.assertEqual(cliente.get("/api/fretes/?" + consulta).json()["paginacao"]["total"], 0)
        for consulta in ("pagina=0", "tamanho_pagina=101", "pagina=999", "data_inicio=2099-01-01&data_fim=2000-01-01"):
            self.assertEqual(cliente.get("/api/fretes/?" + consulta).status_code, 400)
        empresas = cliente.get("/api/fretes/transportadoras/?tamanho_pagina=1").json()
        self.assertEqual(empresas["paginacao"]["total"], 2)
        self.assertEqual(set(empresas["resultados"][0]), {"id", "razao_social"})

    def test_demanda_tratativa_pedidos_e_sem_alteracao_arbitraria(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7")
        cliente = self.cliente(self.vendedora)
        self.assertEqual(cliente.get("/api/fretes/pedidos-disponiveis/").json()["resultados"][0]["quantidade_restante"], "3.000")
        for acao, dados in (("tratativas", {"observacao": "Contato interno"}), ("publicar-demanda", {"valor_sugerido": "123.00", "janela_coleta": "A combinar", "tipo_veiculo": "Caminhão", "observacoes": "Teste"})):
            resposta = cliente.post(f"/api/fretes/{frete.pk}/{acao}/", dados, format="json", HTTP_IDEMPOTENCY_KEY=acao)
            self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(cliente.get("/api/fretes/demandas/").json()["paginacao"]["total"], 1)
        self.assertEqual(self.cliente(self.terceira).get("/api/fretes/demandas/").json()["paginacao"]["total"], 0)
        self.assertEqual(cliente.post("/api/fretes/", self.entrada(situacao="concluido"), format="json", HTTP_IDEMPOTENCY_KEY="status-arbitrario").status_code, 400)
        self.assertEqual(cliente.post("/api/fretes/", self.entrada(), format="json").status_code, 400)


class TestesConcorrenciaFretes(CenarioFretes, TransactionTestCase):
    def simultaneos(self, operacao):
        barreira = Barrier(2)
        def executar(indice):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '5s'")
                barreira.wait(timeout=10)
                try:
                    return str(operacao(indice).pk)
                except ErroConflito:
                    return "conflito"
            finally:
                connection.close()
        with ThreadPoolExecutor(max_workers=2) as executor:
            resultados = [executor.submit(executar, i) for i in range(2)]
            return [futuro.result(timeout=20) for futuro in resultados]

    def test_alocacao_concorrente_nao_ultrapassa_pedido(self):
        resultados = self.simultaneos(lambda i: criar_frete(self.vendedora, self.entrada(pedido_id=str(self.pedido.pk), quantidade="7"), f"alocacao-{i}"))
        self.assertEqual(resultados.count("conflito"), 1)
        self.assertEqual(Frete.objects.get().quantidade, Decimal("7.000"))

    def test_criacao_concorrente_mesma_chave_nao_duplica(self):
        resultados = self.simultaneos(lambda i: criar_frete(self.vendedora, self.entrada(), "mesma-criacao"))
        self.assertEqual(len(set(resultados)), 1)
        self.assertEqual(Frete.objects.count(), 1)
        self.assertEqual(HistoricoFrete.objects.count(), 1)

    def test_aprovacao_concorrente_mantem_uma_cotacao_aprovada(self):
        frete = self.comando(self.novo(), "classificar", {"modalidade": "cotar"})
        for valor in ("500", "600"):
            frete = self.comando(frete, "cotacoes", {"transportadora_id": self.transportadora.pk, "valor": valor, "prazo_dias": 1})
        ids = list(frete.cotacoes.values_list("pk", flat=True))
        resultados = self.simultaneos(lambda i: self.comando(frete, "aprovar-cotacao", {"cotacao_id": str(ids[i])}, chave=f"aprovar-{i}"))
        self.assertEqual(resultados.count("conflito"), 1)
        self.assertEqual(CotacaoFrete.objects.filter(aprovada=True).count(), 1)

    def test_correcoes_concorrentes_versionam_sem_perder_analises(self):
        frete = self.divergente()
        self.simultaneos(lambda i: self.comando(frete, "registrar-cte", {"numero": f"CTE-CONCORRENTE-{i}", "valor": str(620 + i)}, chave=f"cte-{i}"))
        self.assertEqual(list(DocumentoCTe.objects.order_by("versao").values_list("versao", flat=True)), [1, 2, 3])
        self.assertEqual(DivergenciaFrete.objects.filter(resolvida_em__isnull=True).count(), 1)
        self.assertEqual(DivergenciaFrete.objects.count(), 3)

    def test_confirmacao_concorrente_nao_duplica_entrega(self):
        frete = self.divergente()
        resultados = self.simultaneos(lambda i: self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora, chave=f"entrega-{i}"))
        self.assertEqual(resultados.count("conflito"), 1)
        self.assertEqual(ConfirmacaoEntrega.objects.count(), 1)
        self.assertEqual(HistoricoFrete.objects.filter(acao="confirmar-entrega").count(), 1)

    def test_confirmacao_concorrente_mesma_chave_retorna_o_mesmo_resultado(self):
        frete = self.divergente()
        resultados = self.simultaneos(lambda i: self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora, chave="entrega-concorrente-repetida"))
        self.assertNotIn("conflito", resultados)
        self.assertEqual(len(set(resultados)), 1)
        self.assertEqual(ConfirmacaoEntrega.objects.count(), 1)
        self.assertEqual(HistoricoFrete.objects.filter(acao="confirmar-entrega").count(), 1)

    def test_aceite_e_recebimento_concorrentes_concluem_auditoria(self):
        frete = self.divergente()
        def operacao(indice):
            if indice == 0:
                return self.comando(frete, "resolver-divergencia", {"justificativa": "Aceite concorrente."}, chave="aceitar-concorrente")
            return self.comando(frete, "confirmar-entrega", self.recebimento(), empresa=self.compradora, chave="receber-concorrente")
        resultados = self.simultaneos(operacao)
        self.assertNotIn("conflito", resultados)
        frete.refresh_from_db()
        self.assertEqual(frete.situacao, "concluido")
        self.assertEqual(ConfirmacaoEntrega.objects.count(), 1)
        self.assertFalse(DivergenciaFrete.objects.filter(resolvida_em__isnull=True).exists())

    def test_cancelamento_concorrente_com_retirada_nao_permite_ambos(self):
        frete = self.divergente()
        def operacao(indice):
            return self.comando(frete, "retirada", {"nome_foto": "teste.png"}) if indice else self.comando(frete, "cancelar", {"justificativa": "Cancelamento concorrente."})
        resultados = self.simultaneos(operacao)
        self.assertEqual(resultados.count("conflito"), 1)
        frete.refresh_from_db()
        self.assertFalse(frete.situacao == "cancelado" and frete.retirado_em is not None)


class TestesMigracoesFretes(CenarioFretes, TransactionTestCase):
    def test_criacao_reversao_e_avanco_preservam_dados_compativeis(self):
        destinos = MigrationExecutor(connection).loader.graph.leaf_nodes()
        tabelas = {modelo._meta.db_table for modelo in (Frete, CotacaoFrete, DocumentoCTe, DivergenciaFrete, ConfirmacaoEntrega, HistoricoFrete, DemandaTransporte)}
        try:
            MigrationExecutor(connection).migrate([("fretes", None)])
            self.assertFalse(tabelas & set(connection.introspection.table_names()))
            executor = MigrationExecutor(connection)
            executor.migrate([("fretes", "0001_initial")])
            self.assertTrue(tabelas <= set(connection.introspection.table_names()))
            antigo = executor.loader.project_state([("fretes", "0001_initial")]).apps
            frete = antigo.get_model("fretes", "Frete").objects.create(
                empresa_vendedora_id=self.vendedora.pk, empresa_compradora_id=self.compradora.pk,
                origem_cadastro="avulso", numero_pedido="MIGRACAO-TESTE", material="Material de teste", unidade="KG", quantidade=1,
                origem="Origem", destino="Destino",
            )
            MigrationExecutor(connection).migrate(destinos)
            self.assertEqual(Frete.objects.get(pk=frete.pk).numero_pedido, "MIGRACAO-TESTE")
            self.assertIn("divergencia_tipo_resolucao", {coluna.name for coluna in connection.introspection.get_table_description(connection.cursor(), DivergenciaFrete._meta.db_table)})
            MigrationExecutor(connection).migrate([("fretes", "0001_initial")])
            self.assertNotIn("divergencia_tipo_resolucao", {coluna.name for coluna in connection.introspection.get_table_description(connection.cursor(), DivergenciaFrete._meta.db_table)})
        finally:
            MigrationExecutor(connection).migrate(destinos)
