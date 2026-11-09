"""Regras e relacionamentos validados sem conexão, migrations ou fixtures reais."""

from dataclasses import FrozenInstanceError
from decimal import Decimal

from django.apps import apps
from django.core.exceptions import ValidationError
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.state import ProjectState
from django.test import SimpleTestCase
from django.utils import timezone

from app.excecoes import ErroRegraNegocio
from empresas.models import Empresa
from fretes.dominio import ConferenciaFrete, SituacaoFrete, situacao_apos_conferencia
from fretes.models import ConfirmacaoEntrega, DivergenciaFrete, DocumentoCTe, Frete
from fretes.permissoes import ErroAcessoFrete, exigir_confirmacao_entrega, permissoes_frete
from fretes.serializers import SerializadorConsultaFretes


class TestesConferenciaFrete(SimpleTestCase):
    def test_tolerancia_absoluta_preserva_limites_e_sinal_da_diferenca(self):
        for cobrado, diferenca, divergente in (
            ("500.00", "0.00", False),
            ("505.00", "5.00", False),
            ("495.00", "-5.00", False),
            ("505.01", "5.01", True),
            ("494.99", "-5.01", True),
            ("650.00", "150.00", True),
        ):
            with self.subTest(cobrado=cobrado):
                conferencia = ConferenciaFrete(Decimal("500.00"), Decimal(cobrado))
                self.assertEqual(conferencia.diferenca, Decimal(diferenca))
                self.assertEqual(conferencia.divergente, divergente)

    def test_aceita_texto_decimal_sem_arredondamento(self):
        conferencia = ConferenciaFrete("500", "505.010")
        self.assertEqual(conferencia.valor_cobrado, Decimal("505.01"))
        self.assertTrue(conferencia.divergente)

    def test_rejeita_valores_invalidos_em_ambos_os_lados(self):
        for campo in ("valor_referencia", "valor_cobrado"):
            for valor in (None, True, 500.01, "NaN", "Infinity", "-0.01", "1.001", "10000000000.00"):
                with self.subTest(campo=campo, valor=valor):
                    dados = {"valor_referencia": "500.00", "valor_cobrado": "650.00", campo: valor}
                    with self.assertRaises(ErroRegraNegocio):
                        ConferenciaFrete(**dados)

    def test_snapshot_nao_pode_ser_alterado_apos_conferencia(self):
        conferencia = ConferenciaFrete("500", "650")
        with self.assertRaises(FrozenInstanceError):
            conferencia.valor_referencia = Decimal("650.00")


class TestesModelagemFretes(SimpleTestCase):
    def setUp(self):
        self.vendedora = Empresa(id_empresa=101)
        self.compradora = Empresa(id_empresa=102)
        self.frete = Frete(
            empresa_vendedora=self.vendedora,
            empresa_compradora=self.compradora,
            origem_cadastro=Frete.OrigemCadastro.AVULSO,
            numero_pedido="FRETE-TESTE-MODELAGEM",
            material="Resíduo sintético de teste",
            unidade="KG",
            quantidade=Decimal("10.000"),
            valor_referencia=Decimal("500.00"),
        )
        self.documento = DocumentoCTe(frete=self.frete, versao=1, numero="CTE-TESTE-V1", valor=Decimal("650.00"))
        self.divergencia = DivergenciaFrete(
            frete=self.frete, documento=self.documento,
            valor_referencia=Decimal("500.00"), valor_cobrado=Decimal("650.00"), diferenca=Decimal("150.00"),
        )

    def resolver_por_aceite(self):
        self.divergencia.tipo_resolucao = DivergenciaFrete.TipoResolucao.ACEITE_JUSTIFICADO
        self.divergencia.justificativa = "Custo adicional conferido e aceito pela vendedora."
        self.divergencia.empresa_resolvedora = self.vendedora
        self.divergencia.resolvida_em = timezone.now()

    def resolver_por_correcao(self, **campos):
        self.divergencia.tipo_resolucao = DivergenciaFrete.TipoResolucao.CTE_CORRIGIDO
        self.divergencia.empresa_resolvedora = self.vendedora
        self.divergencia.resolvida_em = timezone.now()
        self.divergencia.documento_correcao = DocumentoCTe(**{
            "frete": self.frete, "versao": 2, "numero": "CTE-TESTE-V2", "valor": Decimal("500.00"), **campos,
        })

    def recebimento_em_memoria(self):
        return ConfirmacaoEntrega(
            frete=self.frete, empresa_confirmadora=self.compradora, confirmado_em=timezone.now(),
        )

    def test_cancelamento_permitido_em_cada_etapa_ativa_antes_da_retirada(self):
        for situacao in SituacaoFrete:
            with self.subTest(situacao=situacao):
                self.frete.situacao = situacao
                self.assertEqual(self.frete.pode_cancelar, situacao not in (SituacaoFrete.CONCLUIDO, SituacaoFrete.CANCELADO))

    def test_retirada_impede_cancelamento_em_todas_as_situacoes(self):
        self.frete.retirado_em = timezone.now()
        for situacao in SituacaoFrete:
            with self.subTest(situacao=situacao):
                self.frete.situacao = situacao
                self.assertFalse(self.frete.pode_cancelar)

    def test_situacao_desconhecida_nao_autoriza_cancelamento(self):
        self.frete.situacao = "situacao_inexistente"
        self.assertFalse(self.frete.pode_cancelar)

    def test_cancelamento_valido_exige_instante_e_justificativa(self):
        self.frete.situacao = Frete.Situacao.CANCELADO
        self.frete.cancelado_em = timezone.now()
        self.frete.justificativa_cancelamento = "Coleta desnecessária."
        self.frete.clean()

    def test_cancelamento_invalido_informa_os_campos_sem_gravar(self):
        self.frete.situacao = Frete.Situacao.CANCELADO
        self.frete.retirado_em = timezone.now()
        self.frete.justificativa_cancelamento = "   "
        with self.assertRaises(ValidationError) as contexto:
            self.frete.clean()
        self.assertEqual(set(contexto.exception.message_dict), {"retirado_em", "cancelado_em", "justificativa_cancelamento"})

    def test_frete_concluido_nao_pode_conter_cancelamento(self):
        self.frete.situacao = Frete.Situacao.CONCLUIDO
        self.frete.cancelado_em = timezone.now()
        with self.assertRaises(ValidationError):
            self.frete.clean()

    def test_divergencia_aberta_nao_inventa_resolucao(self):
        self.divergencia.clean()
        self.assertEqual(self.divergencia.tipo_resolucao, "")
        self.assertIsNone(self.divergencia.documento_correcao_id)

    def test_aceite_preserva_cobranca_referencia_e_documento(self):
        self.resolver_por_aceite()
        self.divergencia.clean()
        self.assertEqual(self.divergencia.documento, self.documento)
        self.assertEqual(self.documento.valor, Decimal("650.00"))
        self.assertEqual(self.divergencia.valor_referencia, Decimal("500.00"))
        self.assertEqual(self.divergencia.valor_cobrado, Decimal("650.00"))
        self.assertEqual(self.divergencia.diferenca, Decimal("150.00"))

    def test_aceite_sem_justificativa_ou_autoria_e_rejeitado(self):
        self.resolver_por_aceite()
        self.divergencia.justificativa = "   "
        self.divergencia.empresa_resolvedora = None
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertEqual(set(contexto.exception.message_dict), {"justificativa", "empresa_resolvedora"})

    def test_correcao_identifica_versao_posterior_sem_sobrescrever_original(self):
        self.resolver_por_correcao()
        self.divergencia.clean()
        self.assertEqual(self.documento.versao, 1)
        self.assertEqual(self.documento.valor, Decimal("650.00"))
        self.assertEqual(self.divergencia.documento_correcao.versao, 2)
        self.assertEqual(self.divergencia.diferenca, Decimal("150.00"))

    def test_correcao_ainda_divergente_prepara_novo_snapshot_aberto(self):
        self.resolver_por_correcao(valor=Decimal("620.00"))
        nova = self.divergencia.preparar_divergencia_da_correcao()
        nova.clean()
        self.assertNotEqual(nova.pk, self.divergencia.pk)
        self.assertEqual(nova.frete_id, self.frete.pk)
        self.assertEqual(nova.documento, self.divergencia.documento_correcao)
        self.assertEqual(nova.valor_referencia, Decimal("500.00"))
        self.assertEqual(nova.valor_cobrado, Decimal("620.00"))
        self.assertEqual(nova.diferenca, Decimal("120.00"))
        self.assertEqual(nova.tipo_resolucao, "")
        self.assertIsNone(nova.resolvida_em)
        self.assertIsNone(nova.empresa_resolvedora_id)
        self.assertEqual(self.divergencia.tipo_resolucao, "cte_corrigido")
        self.assertIsNotNone(self.divergencia.resolvida_em)
        self.assertEqual(self.divergencia.valor_cobrado, Decimal("650.00"))
        self.assertEqual(self.divergencia.diferenca, Decimal("150.00"))

    def test_correcao_dentro_da_tolerancia_nao_prepara_nova_divergencia(self):
        for valor in ("500.00", "495.00", "505.00"):
            with self.subTest(valor=valor):
                self.resolver_por_correcao(valor=Decimal(valor))
                self.assertIsNone(self.divergencia.preparar_divergencia_da_correcao())

    def test_correcoes_sucessivas_preservam_a_referencia_e_as_cobrancas(self):
        self.resolver_por_correcao(valor=Decimal("620.00"))
        segunda = self.divergencia.preparar_divergencia_da_correcao()
        segunda.tipo_resolucao = DivergenciaFrete.TipoResolucao.CTE_CORRIGIDO
        segunda.resolvida_em = timezone.now()
        segunda.empresa_resolvedora = self.vendedora
        segunda.documento_correcao = DocumentoCTe(
            frete=self.frete, versao=3, numero="CTE-TESTE-V3", valor=Decimal("490.00"),
        )
        terceira = segunda.preparar_divergencia_da_correcao()
        terceira.clean()
        self.assertEqual(terceira.valor_referencia, Decimal("500.00"))
        self.assertEqual(terceira.diferenca, Decimal("-10.00"))
        self.assertEqual(self.documento.valor, Decimal("650.00"))
        self.assertEqual(segunda.valor_cobrado, Decimal("620.00"))
        self.assertEqual(segunda.documento_correcao, terceira.documento)

    def test_preparar_divergencia_da_correcao_exige_substituicao_definida(self):
        with self.assertRaises(ValidationError):
            self.divergencia.preparar_divergencia_da_correcao()
        self.resolver_por_aceite()
        with self.assertRaises(ValidationError):
            self.divergencia.preparar_divergencia_da_correcao()

    def test_correcao_nao_pode_usar_versao_anterior_ou_a_mesma_versao(self):
        for versao in (1, 2):
            with self.subTest(versao=versao):
                self.documento.versao = 2
                self.resolver_por_correcao(versao=versao)
                with self.assertRaises(ValidationError):
                    self.divergencia.clean()

    def test_correcao_rejeita_o_mesmo_id_ainda_que_instancia_informe_versao_maior(self):
        self.resolver_por_correcao(id=self.documento.pk)
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertIn("documento_correcao", contexto.exception.message_dict)

    def test_correcao_nao_pode_apontar_para_outro_frete(self):
        self.resolver_por_correcao(frete=Frete())
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertIn("documento_correcao", contexto.exception.message_dict)

    def test_documento_original_deve_ser_do_mesmo_frete(self):
        self.documento.frete = Frete()
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertIn("documento", contexto.exception.message_dict)

    def test_resolucao_nao_pode_misturar_aceite_e_correcao(self):
        self.resolver_por_correcao()
        self.divergencia.tipo_resolucao = DivergenciaFrete.TipoResolucao.ACEITE_JUSTIFICADO
        self.divergencia.justificativa = "Aceite de teste."
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertIn("documento_correcao", contexto.exception.message_dict)

    def test_resolucao_exige_tipo_e_documento_quando_aplicavel(self):
        self.resolver_por_aceite()
        for tipo, campo in (("", "tipo_resolucao"), ("cte_corrigido", "documento_correcao")):
            with self.subTest(tipo=tipo):
                self.divergencia.tipo_resolucao = tipo
                with self.assertRaises(ValidationError) as contexto:
                    self.divergencia.clean()
                self.assertIn(campo, contexto.exception.message_dict)

    def test_divergencia_aberta_rejeita_resolucao_incompleta(self):
        self.divergencia.justificativa = "Não pode justificar uma resolução sem encerramento."
        with self.assertRaises(ValidationError):
            self.divergencia.clean()

    def test_snapshot_rejeita_cobranca_ou_diferenca_alteradas(self):
        for campo in ("valor_cobrado", "diferenca"):
            with self.subTest(campo=campo):
                original = getattr(self.divergencia, campo)
                setattr(self.divergencia, campo, Decimal("151.00"))
                with self.assertRaises(ValidationError):
                    self.divergencia.clean()
                setattr(self.divergencia, campo, original)

    def test_nao_cria_divergencia_para_diferenca_dentro_da_tolerancia(self):
        self.documento.valor = self.divergencia.valor_cobrado = Decimal("505.00")
        self.divergencia.diferenca = Decimal("5.00")
        with self.assertRaises(ValidationError) as contexto:
            self.divergencia.clean()
        self.assertIn("valor_cobrado", contexto.exception.message_dict)

    def test_divergencia_aberta_permite_retirada_e_confirmacao_pelos_participantes(self):
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        self.assertTrue(permissoes_frete(self.vendedora, self.frete)["registrar_retirada"])
        self.assertTrue(permissoes_frete(self.compradora, self.frete)["confirmar_entrega"])
        self.assertFalse(permissoes_frete(self.vendedora, self.frete)["confirmar_entrega"])
        self.assertFalse(permissoes_frete(self.compradora, self.frete)["registrar_retirada"])
        exigir_confirmacao_entrega(self.compradora, self.frete)
        with self.assertRaises(ErroAcessoFrete):
            exigir_confirmacao_entrega(self.vendedora, self.frete)

    def test_terceiros_e_empresa_inativa_nao_ganham_permissao_pela_divergencia(self):
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        transportadora = Empresa(id_empresa=103)
        self.frete.transportadora = transportadora
        for empresa in (None, transportadora, Empresa(id_empresa=104), Empresa(id_empresa=102, ativo=False)):
            with self.subTest(empresa=empresa):
                self.assertFalse(any(permissoes_frete(empresa, self.frete).values()))

    def test_registrar_retirada_nao_resolve_divergencia_ou_impede_recebimento(self):
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        self.frete.retirado_em = timezone.now()
        self.assertFalse(self.frete.pode_registrar_retirada)
        self.assertFalse(self.frete.pode_cancelar)
        self.assertTrue(self.frete.pode_confirmar_entrega)
        self.assertEqual(self.frete.situacao, Frete.Situacao.COM_DIVERGENCIA)

    def test_recebimento_com_divergencia_nao_conclui_auditoria(self):
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        self.recebimento_em_memoria()
        self.assertTrue(self.frete.recebimento_confirmado)
        self.assertEqual(self.frete.situacao, Frete.Situacao.COM_DIVERGENCIA)
        self.assertEqual(situacao_apos_conferencia(
            divergencia_aberta=True, recebimento_confirmado=self.frete.recebimento_confirmado,
        ), Frete.Situacao.COM_DIVERGENCIA)
        self.assertTrue(permissoes_frete(self.vendedora, self.frete)["gerenciar"])
        self.assertFalse(self.frete.pode_confirmar_entrega)
        self.assertFalse(self.frete.pode_registrar_retirada)

    def test_recebimento_impede_cancelar_mesmo_com_auditoria_ainda_pendente(self):
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        self.recebimento_em_memoria()
        self.assertFalse(self.frete.pode_cancelar)
        self.frete.situacao = Frete.Situacao.CANCELADO
        self.frete.cancelado_em = timezone.now()
        self.frete.justificativa_cancelamento = "Tentativa inválida após recebimento."
        with self.assertRaises(ValidationError) as contexto:
            self.frete.clean()
        self.assertIn("situacao", contexto.exception.message_dict)

    def test_situacao_apos_conferencia_distingue_analise_pendente_e_recebimento(self):
        for aberta, recebida, esperada in (
            (True, False, Frete.Situacao.COM_DIVERGENCIA),
            (True, True, Frete.Situacao.COM_DIVERGENCIA),
            (False, False, Frete.Situacao.AGUARDANDO_ENTREGA),
            (False, True, Frete.Situacao.CONCLUIDO),
        ):
            with self.subTest(divergencia_aberta=aberta, recebimento_confirmado=recebida):
                self.assertEqual(situacao_apos_conferencia(
                    divergencia_aberta=aberta, recebimento_confirmado=recebida,
                ), esperada)

    def test_permissao_de_confirmacao_considera_etapa_e_recebimento_previo(self):
        for situacao in Frete.Situacao:
            with self.subTest(situacao=situacao):
                self.frete.situacao = situacao
                esperada = situacao in (Frete.Situacao.COM_DIVERGENCIA, Frete.Situacao.AGUARDANDO_ENTREGA)
                self.assertEqual(permissoes_frete(self.compradora, self.frete)["confirmar_entrega"], esperada)
        self.frete.situacao = Frete.Situacao.COM_DIVERGENCIA
        self.recebimento_em_memoria()
        self.assertFalse(permissoes_frete(self.compradora, self.frete)["confirmar_entrega"])

    def test_api_e_model_compartilham_as_situacoes_existentes(self):
        for situacao in Frete.Situacao:
            with self.subTest(situacao=situacao):
                serializador = SerializadorConsultaFretes(data={"situacao": situacao.value})
                self.assertTrue(serializador.is_valid(), serializador.errors)

    def test_migrations_representam_os_models_sem_acessar_banco(self):
        carregador = MigrationLoader(None)
        detector = MigrationAutodetector(carregador.project_state(), ProjectState.from_apps(apps))
        alteracoes = detector.changes(graph=carregador.graph, trim_to_apps={"fretes"})
        self.assertNotIn("fretes", alteracoes)
