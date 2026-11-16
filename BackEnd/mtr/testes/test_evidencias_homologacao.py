"""MTR-04A: evidencia local nao e habilitacao governamental. PostgreSQL isolado."""
from uuid import uuid4
from unittest.mock import patch
import json

from django.apps import apps
from django.db import connection
from django.test import TestCase, TransactionTestCase
from fretes.models import Frete
from mtr.models import DespachoSIGOR, RevisaoAmbientalSIGOR, ReciboMTR
from mtr.servicos_mvp import hash_dados, primitivo
from mtr.sigor import ambiental as a, despacho as d
from mtr.sigor.diagnostico import diagnosticar_cenario
from mtr.sigor.protocolo import AdaptadorEmissaoSIGORBloqueado, politica_escrita_permite
from mtr.sigor.privacidade import Segredo
from mtr.sigor.simulacao import TransporteDespachoSimulado
from mtr.testes.test_sigor_preparacao import FluxoSIGOR


class CenarioEvidencias(FluxoSIGOR):
    def setUp(self):
        super().setUp()
        captura = self.post('sigor/catalogos/referencia-operador/', {})
        self.assertEqual(captura.status_code, 201)
        self.capturas['residuos'] = captura.data['id']
        relacao = a.capturar(self.vendedora, 'classes-por-residuo',
            [{'claCodigo':9005, 'claDescricao':'FICTICIO'}], parametro='150104',
            simulado=True, origem='SIMULACAO', metodo='POST')
        self.capturas['classes-por-residuo'] = str(relacao.pk)
        self.r = self.salvar(self.r, {**self.r['dados'], 'resCodigoIbama':'150104',
            'origem_codigo':'referencia_operador_homologacao'})

    def preparar(self):
        self.despacho = self.preparado_sig()
        return self.despacho

    def diagnosticar(self):
        return diagnosticar_cenario(self.vendedora, self.r['id'], self.op)

    def externa(self, codigo):
        resultado = self.diagnosticar()
        self.assertIn(codigo, [c['codigo'] for c in resultado['pendencias_externas']])
        self.assertEqual(resultado['estado'], 'PENDENTE DE EVIDÊNCIA EXTERNA')
        self.assertFalse(resultado['pode_despachar'])
        return resultado

    def estado_tabelas(self):
        return {m._meta.label:hash_dados(primitivo(list(m.objects.order_by('pk').values()))) for m in apps.get_models()}


class TestesEvidenciasHomologacao(CenarioEvidencias, TestCase):
    def test_participante_declarado_sem_cadastro_oficial_verificado(self):
        self.preparar()
        self.externa('HABILITACAO_EXTERNA_GERADOR')

    def test_unidade_existente_localmente_nao_atesta_habilitacao(self):
        self.preparar()
        r = self.externa('HABILITACAO_EXTERNA_DESTINADOR')
        self.assertTrue(any(c['codigo']=='VINCULO_DESTINADOR' and c['situacao']=='VERIFICADO INTERNAMENTE' for c in r['verificacoes']))

    def test_representacao_individual_nao_e_comprovada_por_flag_local(self):
        self.preparar()
        self.op.verificado_homologacao = True
        self.op.save()
        self.externa('IDENTIDADE_EXTERNA_PENDENTE')

    def test_transportadora_da01_divergente_bloqueia_sem_tentativa(self):
        despacho = self.preparar()
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.concorrente)
        resultado = self.diagnosticar()
        self.assertEqual(resultado['estado'], 'BLOQUEADO')
        self.assertEqual(resultado['codigo'], 'TRANSPORTADOR_DIVERGENTE_FRETE')
        despacho.refresh_from_db()
        self.assertEqual(despacho.tentativas, 0)
        self.assertEqual(despacho.estado, 'PREPARADA')

    def test_ibama_referencial_preserva_origem_sem_aprovar_carga(self):
        self.preparar()
        resultado = self.externa('CLASSIFICACAO_EXTERNA_PENDENTE')
        self.assertEqual(resultado['codigo_residuo'], '150104')
        from mtr.models import CapturaCatalogoSIGOR
        captura = CapturaCatalogoSIGOR.objects.get(pk=self.capturas['residuos'])
        self.assertEqual(captura.origem, 'OPERADOR_REFERENCIA')
        self.assertFalse(captura.simulado)
        self.assertEqual(len(captura.itens), 895)

    def test_codigo_da_referencia_nao_homologa_relacoes_simuladas(self):
        self.preparar()
        resultado = self.externa('CATALOGOS_EXTERNOS_PENDENTES')
        self.assertEqual(resultado['estado_interno'], 'APTO TECNICAMENTE')
        self.assertTrue(any(c['codigo']=='CATALOGOS_COMPATIVEIS' and c['situacao']=='VERIFICADO INTERNAMENTE' for c in resultado['verificacoes']))

    def test_contrato_sem_versao_vigente_nao_e_promovido_a_comprovado(self):
        self.preparar()
        self.externa('CONTRATO_VIGENTE_PENDENTE')

    def test_prontidao_interna_independente_da_prontidao_governamental(self):
        self.preparar()
        resultado = self.diagnosticar()
        self.assertEqual(resultado['estado_interno'], 'APTO TECNICAMENTE')
        self.assertEqual(resultado['estado'], 'PENDENTE DE EVIDÊNCIA EXTERNA')
        for campo in ['pode_despachar','emissao_real_habilitada','autorizacao_de_emissao']:
            self.assertIs(resultado[campo], False)

    def test_fixtures_nao_podem_ser_preparadas_como_homologacao(self):
        revisao = self.revisao()
        self.assertEqual(revisao.status_code, 201)
        resumo = RevisaoAmbientalSIGOR.objects.get(pk=revisao.data['id']).resumo
        x = self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',
            {'revisao_id':revisao.data['id'], 'modo':'HOMOLOGACAO', 'confirmar_preparacao':True})
        self.assertEqual(x.status_code, 422)
        self.assertFalse(DespachoSIGOR.objects.exists())
        self.assertEqual(RevisaoAmbientalSIGOR.objects.get(pk=revisao.data['id']).resumo, resumo)

    def test_diagnostico_nao_carrega_nem_expoe_segredos(self):
        self.preparar()
        with patch('mtr.sigor.configuracao.provedor_ambiente', side_effect=AssertionError('Proibido carregar segredo')) as segredo, \
             patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Rede proibida')) as rede:
            texto = json.dumps(self.diagnosticar())
            segredo.assert_not_called()
            rede.assert_not_called()
        for valor in ['Authorization','Bearer ','SENHA-FICTICIA','token_operador']:
            self.assertNotIn(valor, texto)

    def test_escrita_governamental_bloqueada_antes_do_transporte(self):
        despacho = self.preparar()
        adaptador = AdaptadorEmissaoSIGORBloqueado()
        requisicao = adaptador.preparar_requisicao(despacho.payload_wire, Segredo('TOKEN-FICTICIO-SEM-VALIDADE'))
        with patch('urllib.request.build_opener', side_effect=AssertionError('Nenhuma rede')) as rede:
            with self.assertRaises(PermissionError): adaptador.enviar(requisicao)
            rede.assert_not_called()
        self.assertIs(politica_escrita_permite(), False)

    def test_executor_so_admite_postgresql_descartavel(self):
        self.assertEqual(connection.vendor, 'postgresql')
        self.assertTrue(connection.settings_dict['NAME'].startswith('test_zenwaste_fretes_'))
        self.assertEqual(connection.settings_dict['HOST'], '127.0.0.1')
        # A prova de nenhum acesso ao principal tambem depende da allowlist do executor,
        # que identifica diretorio/porta/system_id antes de cada conexao.
        self.preparar()
        verbos = []
        def somente_select(execute, sql, params, many, context):
            verbo = sql.strip().split()[0].upper()
            self.assertEqual(verbo, 'SELECT')
            verbos.append(verbo)
            return execute(sql, params, many, context)
        with connection.execute_wrapper(somente_select): self.diagnosticar()
        self.assertTrue(verbos)

    def test_preparacoes_snapshots_e_dados_anteriores_preservados(self):
        self.preparar()
        antes = self.estado_tabelas()
        self.diagnosticar()
        self.assertEqual(self.estado_tabelas(), antes)

    def test_diagnostico_repetido_nao_consume_tentativa_ou_recibo(self):
        despacho = self.preparar()
        recibos = ReciboMTR.objects.count()
        for _ in range(3): self.diagnosticar()
        despacho.refresh_from_db()
        self.assertEqual(despacho.tentativas, 0)
        self.assertEqual(ReciboMTR.objects.count(), recibos)


class TestesReconciliacaoEvidencias(CenarioEvidencias, TransactionTestCase):
    def test_consulta_simulada_inconclusiva_nunca_reenvia_emissao(self):
        despacho = self.preparar()
        d.despachar_simulado(self.vendedora, despacho.pk, self.op, uuid4(), 'timeout')
        class Vazia(TransporteDespachoSimulado):
            def consultar(self, wire, consulta, gerador):
                from mtr.sigor.leitura import RespostaPrivada
                return RespostaPrivada(200, 'application/json', b'{"erro":false,"objetoResposta":null}')
            def enviar(self, wire): raise AssertionError('Reconciliação não envia manifesto')
        r = d.reconciliar(self.vendedora, despacho.pk, self.op, transporte=Vazia())
        self.assertEqual(r['estado'], 'INDETERMINADA')
        self.assertIs(r['simulado'], True)
        despacho.refresh_from_db()
        self.assertEqual(despacho.tentativas, 1)  # Unica tentativa, exclusivamente MOCK.
        self.assertEqual(despacho.referencia, r['referencia'])
