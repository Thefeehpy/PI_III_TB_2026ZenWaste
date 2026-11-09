from dataclasses import asdict
from decimal import Decimal

from django.apps import apps
from django.db import connection
from django.test import TestCase

from anuncios.models import Reserva
from empresas.models import Empresa
from fretes.models import Frete
from fretes.permissoes import ErroAcessoFrete, ErroFreteNaoEncontrado
from fretes.test_integracao import CenarioFretes
from mtr.consultas import consultar_pre_preenchimento
from mtr.dominio import ErroValidacaoMTR, SituacaoInformacao


class TestesPrePreenchimentoMTR(CenarioFretes, TestCase):
    def test_reutiliza_origens_e_identificadores_sem_inferir_pesagem(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(dados.obter("empresa_vendedora").identificador_origem, str(self.vendedora.pk))
        self.assertEqual(dados.obter("material_comercial").valor, self.pedido.nome_material_negociado)
        self.assertEqual(dados.obter("quantidade_negociada").valor, Decimal("10.000"))
        self.assertEqual(dados.obter("quantidade_remessa").valor, Decimal("7.000"))
        self.assertEqual(dados.obter("quantidade_ofertada").valor, Decimal("100.000"))
        self.assertEqual(dados.obter("quantidade_reservada").valor, Decimal("10.000"))
        self.assertIsNone(dados.obter("quantidade_expedida").valor)
        self.assertIsNone(dados.obter("quantidade_recebida").valor)

    def test_compradora_nao_e_destinadora_nem_empresa_autorizacao_ambiental(self):
        frete = self.novo()
        dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(dados.obter("empresa_compradora").valor, self.compradora.razao_social)
        for campo in ("destinador", "responsavel_ambiental", "unidade_geradora_sigor", "codigo_ibama_aprovado"):
            self.assertIsNone(dados.obter(campo).valor)
            self.assertEqual(dados.obter(campo).situacao, SituacaoInformacao.NAO_INFERIR)
            self.assertTrue(dados.obter(campo).requer_validacao_humana)

    def test_avulso_sem_cadastros_comerciais_inventados(self):
        frete = self.novo()
        dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(dados.obter("quantidade_negociada").situacao, SituacaoInformacao.AUSENTE)
        self.assertEqual(dados.obter("categoria_comercial").situacao, SituacaoInformacao.AUSENTE)
        self.assertEqual(dados.obter("origem_comercial").situacao, SituacaoInformacao.INSUFICIENTE)
        self.assertIsNone(dados.obter("empresa_transportadora").valor)

    def test_terceira_empresa_rejeitada(self):
        frete = self.novo()
        with self.assertRaises(ErroFreteNaoEncontrado):
            consultar_pre_preenchimento(self.terceira.pk, frete.pk)

    def test_compradora_e_transportadora_nao_preparam_dados_de_gestao(self):
        frete = self.contratado()
        for empresa in (self.compradora, self.transportadora):
            with self.subTest(empresa=empresa.pk), self.assertRaises(ErroAcessoFrete):
                consultar_pre_preenchimento(empresa.pk, frete.pk)

    def test_empresa_inativa_e_autenticacao_ausente(self):
        frete = self.novo()
        Empresa.objects.filter(pk=self.vendedora.pk).update(ativo=False)
        for empresa_id in (self.vendedora.pk, None):
            with self.subTest(empresa_id=empresa_id), self.assertRaises(ErroAcessoFrete):
                consultar_pre_preenchimento(empresa_id, frete.pk)

    def test_relacao_comercial_incorreta_exige_revisao(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        Frete.objects.filter(pk=frete.pk).update(empresa_compradora=self.terceira)
        with self.assertRaises(ErroValidacaoMTR) as erro:
            consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(erro.exception.codigo, "relacao_comercial_inconsistente")

    def test_reserva_de_compradora_incompativel_detectada(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        Reserva.objects.filter(pk=self.reserva.pk).update(empresa_compradora=self.terceira)
        with self.assertRaises(ErroValidacaoMTR) as erro:
            consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(erro.exception.codigo, "reserva_inconsistente")

    def test_pedido_legado_sem_reserva_e_informacao_ausente(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        self.reserva.delete()
        dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertIsNone(dados.obter("quantidade_reservada").valor)

    def test_unidade_desconhecida_e_textos_comerciais_insuficientes(self):
        frete = self.novo(unidade="ZZ")
        dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(dados.obter("unidade_comercial").situacao, SituacaoInformacao.INSUFICIENTE)
        self.assertTrue(dados.obter("unidade_comercial").pendencias)
        self.assertIsNone(dados.obter("data_expedicao_prevista").valor)

    def test_consulta_executa_somente_select_e_preserva_vinte_models(self):
        frete = self.novo(pedido_id=str(self.pedido.pk), quantidade="7.000")
        modelos = [m for m in apps.get_models() if m._meta.app_label in {"empresas", "produtos", "anuncios", "pedidos", "fretes"}]
        def snapshot():
            return {m._meta.label: list(m.objects.order_by(m._meta.pk.name).values()) for m in modelos}
        antes = snapshot()
        def somente_leitura(executar, sql, parametros, many, contexto):
            self.assertTrue(sql.lstrip().upper().startswith("SELECT"), "Consulta MTR tentou executar escrita.")
            return executar(sql, parametros, many, contexto)
        with connection.execute_wrapper(somente_leitura):
            dados = consultar_pre_preenchimento(self.vendedora.pk, frete.pk)
        self.assertEqual(snapshot(), antes)
        self.assertEqual(len(modelos), 20)
        texto = repr(asdict(dados))
        self.assertNotIn("hash-sintetico-sem-login", texto)
        self.assertNotIn("dados_assinatura", texto)
        self.assertNotIn("valor_referencia", texto)
