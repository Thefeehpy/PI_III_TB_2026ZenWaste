"""MTR-03: diagnostico integral, evidencias externas e ausencia de efeitos colaterais."""
from datetime import timedelta
from hashlib import sha256
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
import json
import re

from django.apps import apps
from django.conf import settings
from django.db import connection
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from fretes.models import Frete
from mtr.models import DespachoSIGOR, RascunhoMTR, RevisaoAmbientalSIGOR, EventoDespachoSIGOR
from mtr.servicos_mvp import hash_dados, primitivo
from mtr.sigor import ambiental as a
from mtr.sigor.diagnostico import EstadoDiagnostico as E, classificar, diagnosticar_cenario
from mtr.sigor_contrato import json_wire
from mtr.testes.test_sigor_preparacao import FluxoSIGOR


class TestesEstadosDiagnostico(SimpleTestCase):
    def test_distingue_bloqueio_pendencia_externa_e_aptidao_tecnica(self):
        self.assertEqual(classificar(True, True), E.BLOQUEADO)
        self.assertEqual(classificar(False, True), E.EXTERNA)
        self.assertEqual(classificar(False, False), E.APTO)


class TestesDiagnosticoCenario(FluxoSIGOR, TestCase):
    def setUp(self):
        super().setUp()
        # Referencia fornecida pelo operador, sem inventar codigo nem classificar a carga.
        c = self.post('sigor/catalogos/referencia-operador/', {})
        self.assertEqual(c.status_code, 201, c.data)
        self.assertTrue(any(row['codigo'] == '150104' for row in c.data['itens']))
        self.capturas['residuos'] = c.data['id']
        rel = a.capturar(self.vendedora, 'classes-por-residuo', [{'claCodigo':9005, 'claDescricao':'FICTICIO'}],
            parametro='150104', simulado=True, origem='SIMULACAO', metodo='POST')
        self.capturas['classes-por-residuo'] = str(rel.pk)
        self.r = self.salvar(self.r, {**self.r['dados'], 'resCodigoIbama':'150104', 'origem_codigo':'referencia_operador_homologacao'})
        self.despacho = self.preparado_sig()

    def consultar(self, *, ator=True, cliente=None, query=''):
        headers = {'HTTP_X_MTR_ACTOR_TOKEN':self.token} if ator else {}
        return (cliente or self.api).get(f'/api/mtr/sigor/rascunhos/{self.r["id"]}/diagnostico/{query}', **headers)

    def alterar(self, campo, valor=None, *, omitir=False):
        r = RascunhoMTR.objects.get(pk=self.r['id'])
        dados = dict(r.dados)
        if omitir: dados.pop(campo, None)
        else: dados[campo] = valor
        # Exclusivamente massa de teste; nunca um update do diagnostico.
        RascunhoMTR.objects.filter(pk=r.pk).update(dados=dados)

    def bloqueado(self, response, codigo=None):
        self.assertEqual(response.status_code, 422, response.data)
        self.assertEqual(response.data['estado'], E.BLOQUEADO.value)
        self.assertFalse(response.data['pode_despachar'])
        if codigo: self.assertIn(codigo, [c['codigo'] for c in response.data['bloqueios']])
        self.despacho.refresh_from_db()
        self.assertEqual(self.despacho.tentativas, 0)

    def test_cenario_completo_coerente_mas_pendente_de_evidencia_externa(self):
        x = self.consultar()
        self.assertEqual(x.status_code, 200, x.data)
        self.assertEqual(x.data['estado_interno'], E.APTO.value)
        self.assertEqual(x.data['estado'], E.EXTERNA.value)
        self.assertEqual(x.data['codigo_residuo'], '150104')
        self.assertEqual(x.data['natureza_preparacao'], 'SIMULACAO')
        self.assertEqual(x.data['bloqueios'], [])

    def test_frete_sem_transportadora(self):
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=None)
        x = self.consultar(); self.bloqueado(x, 'TRANSPORTADORA_NAO_DEFINIDA')
        self.assertEqual(x.data['codigo'], 'TRANSPORTADORA_NAO_DEFINIDA')

    def test_transportador_ambiental_divergente(self):
        self.alterar('transportador_cnpj', self.concorrente.cnpj)
        self.bloqueado(self.consultar(), 'TRANSPORTADOR_DIVERGENTE_FRETE')

    def test_documento_com_mascara_e_comparado_por_valor_na_da01(self):
        self.alterar('transportador_cnpj', '00.000.000/0000-03')
        x = self.consultar()
        da01 = next(c for c in x.data['verificacoes'] if c['requisito'] == 'DA01')
        self.assertEqual(da01['situacao'], 'VERIFICADO INTERNAMENTE')
        # A alteracao apos a revisao exige novo snapshot, mesmo com documento equivalente.
        self.bloqueado(x, 'SNAPSHOT_ATUAL')

    def test_zeros_iniciais_nao_sao_removidos(self):
        antes = RascunhoMTR.objects.get(pk=self.r['id']).dados['transportador_cnpj']
        x = self.consultar()
        self.assertEqual(x.status_code, 200, x.data)
        self.assertEqual(antes, '00000000000003')
        self.assertEqual(RascunhoMTR.objects.get(pk=self.r['id']).dados['transportador_cnpj'], antes)

    def test_gerador_sem_unidade(self):
        self.alterar('gerador_unidade', omitir=True)
        self.bloqueado(self.consultar(), 'VINCULO_GERADOR')

    def test_destinador_declarado_nao_comprova_habilitacao(self):
        x = self.consultar()
        row = next(c for c in x.data['pendencias_externas'] if c['codigo'] == 'HABILITACAO_EXTERNA_DESTINADOR')
        self.assertEqual(row['situacao'], E.EXTERNA.value)
        self.assertFalse(x.data['emissao_real_habilitada'])

    def test_usuario_empresarial_sem_pessoa_identificada(self):
        self.bloqueado(self.consultar(ator=False), 'OPERADOR_AUTORIZADO')

    def test_usuario_individual_revogado_ou_sem_capacidade(self):
        self.op.pode_autorizar = False; self.op.save()
        self.bloqueado(self.consultar(), 'OPERADOR_AUTORIZADO')

    def test_codigo_ibama_desconhecido(self):
        self.alterar('resCodigoIbama', '999999')
        self.bloqueado(self.consultar(), 'CAMPO_INVALIDO_resCodigoIbama')

    def test_combinacao_de_classe_nao_validada(self):
        self.alterar('claCodigo', '999')
        self.bloqueado(self.consultar(), 'COMBINACAO_INCOMPATIVEL')

    def test_quantidade_invalida(self):
        self.alterar('marQuantidade', '-1.000')
        self.bloqueado(self.consultar(), 'CAMPO_INVALIDO_marQuantidade')

    def test_unidade_de_medida_ausente(self):
        self.alterar('uniCodigo', omitir=True)
        self.bloqueado(self.consultar(), 'CAMPO_INVALIDO_uniCodigo')

    def test_unidade_de_medida_fora_do_catalogo(self):
        self.alterar('uniCodigo', '999')
        self.bloqueado(self.consultar(), 'CAMPO_INVALIDO_uniCodigo')

    def test_campo_obrigatorio_ausente(self):
        self.alterar('destinador_cnpj', omitir=True)
        self.bloqueado(self.consultar(), 'CAMPO_INVALIDO_destinador_cnpj')

    def test_payload_com_quantidade_string_e_hash_recalculado_nao_passam(self):
        p = json.loads(self.despacho.payload_wire)
        p[0]['listaManifestoResiduos'][0]['marQuantidade'] = '7.000'
        wire = json_wire(p)
        DespachoSIGOR.objects.filter(pk=self.despacho.pk).update(payload_wire=wire, resumo=sha256(wire.encode()).hexdigest())
        self.bloqueado(self.consultar(), 'PAYLOAD_COERENTE_REVISAO')

    def test_troca_transportadora_apos_revisao(self):
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.concorrente)
        x = self.consultar(); self.bloqueado(x, 'TRANSPORTADOR_DIVERGENTE_FRETE')
        self.assertIn('SNAPSHOT_ATUAL', [c['codigo'] for c in x.data['bloqueios']])

    def test_troca_transportadora_apos_preparacao_nao_consume_tentativa(self):
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.concorrente)
        antes = EventoDespachoSIGOR.objects.filter(despacho=self.despacho).count()
        self.bloqueado(self.consultar(), 'TRANSPORTADOR_DIVERGENTE_FRETE')
        self.assertEqual(EventoDespachoSIGOR.objects.filter(despacho=self.despacho).count(), antes)

    def test_snapshot_desatualizado(self):
        RascunhoMTR.objects.filter(pk=self.r['id']).update(versao=self.r['versao'] + 1)
        self.bloqueado(self.consultar(), 'SNAPSHOT_ATUAL')

    def test_preparacao_apta_internamente_nao_autoriza_emissao(self):
        x = self.consultar()
        self.assertEqual(x.data['estado_interno'], E.APTO.value)
        self.assertEqual(x.data['estado'], E.EXTERNA.value)
        for key in ['pode_despachar', 'autorizacao_de_emissao', 'emissao_real_habilitada']:
            self.assertIs(x.data[key], False)

    def test_nao_chama_rede_segredos_escrita_ou_recuperacao(self):
        with patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Rede proibida')) as rede, \
             patch('mtr.sigor.configuracao.provedor_ambiente', side_effect=AssertionError('Nao ler segredo')) as segredo, \
             patch('mtr.sigor.protocolo.AdaptadorEmissaoSIGORBloqueado.enviar', side_effect=AssertionError('Nao emitir')) as escrita, \
             patch('mtr.sigor.despacho.recuperar_interrompido', side_effect=AssertionError('Nao recuperar estado')) as recuperar:
            self.assertEqual(self.consultar().status_code, 200)
            for spy in [rede, segredo, escrita, recuperar]: spy.assert_not_called()

    def test_somente_select_preserva_dados_recibos_e_historicos(self):
        def estado():
            return {m._meta.label: hash_dados(primitivo(list(m.objects.order_by('pk').values()))) for m in apps.get_models()}
        antes = estado(); consultas = []
        def somente_leitura(execute, sql, params, many, context):
            verbo = re.match(r'\s*([A-Za-z]+)', sql).group(1).upper()
            self.assertEqual(verbo, 'SELECT'); self.assertNotIn('FOR UPDATE', sql.upper()); consultas.append(verbo)
            return execute(sql, params, many, context)
        with connection.execute_wrapper(somente_leitura):
            self.assertEqual(self.consultar().status_code, 200)
        self.assertTrue(consultas); self.assertEqual(estado(), antes)

    def test_worker_vencido_nao_e_recuperado_pelo_diagnostico(self):
        DespachoSIGOR.objects.filter(pk=self.despacho.pk).update(estado='EM_DESPACHO', tentativas=1, trabalhador=uuid4(),
            iniciada_em=timezone.now()-timedelta(minutes=2), limite_trabalhador=timezone.now()-timedelta(minutes=1))
        antes = EventoDespachoSIGOR.objects.filter(despacho=self.despacho).count()
        x = self.consultar()
        self.assertEqual(x.status_code, 422); self.assertIn('SEM_TENTATIVA_PREVIA', [c['codigo'] for c in x.data['bloqueios']])
        self.despacho.refresh_from_db(); self.assertEqual(self.despacho.estado, 'EM_DESPACHO')
        self.assertEqual(self.despacho.tentativas, 1)
        self.assertEqual(EventoDespachoSIGOR.objects.filter(despacho=self.despacho).count(), antes)

    def test_outra_empresa_e_nao_autenticado_nao_consultam(self):
        for empresa in [self.compradora, self.transportadora, self.terceira]:
            self.assertEqual(self.consultar(cliente=self.cliente(empresa)).status_code, 404)
        self.assertEqual(self.consultar(cliente=self.cliente()).status_code, 401)

    def test_query_desconhecida_duplicada_ou_revisao_de_outro_contexto(self):
        for query in ['?autorizado=true', '?revisao_id=a&revisao_id=b', '?revisao_id=invalido']:
            self.assertEqual(self.consultar(query=query).status_code, 400)
        self.assertEqual(self.consultar(query='?revisao_id='+str(uuid4())).status_code, 404)

    def test_sem_revisao_nao_seleciona_vinculos_automaticamente(self):
        r = self.post('rascunhos/', {'frete_id':str(self.novo().pk)}).data
        x = self.api.get(f'/api/mtr/sigor/rascunhos/{r["id"]}/diagnostico/', HTTP_X_MTR_ACTOR_TOKEN=self.token)
        self.assertEqual(x.status_code, 422)
        self.assertIn('REVISAO_INTEGRA', [c['codigo'] for c in x.data['bloqueios']])

    def test_opcionais_ausentes_nao_viram_obrigatorios_de_emissao(self):
        x = self.consultar(); self.assertEqual(x.status_code, 200, x.data)
        self.assertFalse(any(c['requisito'] in ['quantidade_recebida', 'dataExpedicao', 'nomeMotorista', 'placaVeiculo'] for c in x.data['bloqueios']))

    def test_hash_corrompido_do_catalogo_nao_e_ignorado(self):
        with connection.cursor() as cursor:
            cursor.execute('UPDATE mtr_capturacatalogosigor SET resumo=%s WHERE id=%s', ['0'*64, self.capturas['classes']])
        self.bloqueado(self.consultar(), 'CATALOGO_INCONSISTENTE')

    def test_revogacao_do_vinculo_bloqueia_diagnostico(self):
        x = self.post(f'sigor/vinculos/{self.vinculos["GERADOR"]}/revogacao/', {})
        self.assertEqual(x.status_code, 200)
        self.bloqueado(self.consultar(), 'VINCULO_GERADOR')

    def test_booleano_local_nao_substitui_identidade_e_habilitacao_externas(self):
        self.op.verificado_homologacao = True; self.op.save()
        x = self.consultar()
        self.assertEqual(x.data['estado'], E.EXTERNA.value)
        self.assertIn('IDENTIDADE_EXTERNA_PENDENTE', [c['codigo'] for c in x.data['pendencias_externas']])

    def test_resposta_nao_expoe_financeiro_credenciais_ou_payload_bruto(self):
        x = self.consultar(); texto = json.dumps(x.data)
        for proibido in ['SENHA-FICTICIA', 'Bearer ', 'Authorization', 'valor_referencia', 'senha', 'token_operador']:
            self.assertNotIn(proibido, texto)
        def chaves(v):
            if isinstance(v, dict): return set(v) | set().union(*(chaves(x) for x in v.values()))
            if isinstance(v, list): return set().union(*(chaves(x) for x in v))
            return set()
        self.assertNotIn('payload_wire', chaves(x.data))
        self.assertNotIn('json_wire', chaves(x.data))
        self.assertNotIn(self.despacho.payload_wire, texto)

    def test_json_de_payload_com_chaves_duplicadas_e_bloqueado(self):
        wire = '[{"nomeResponsavel":"X","nomeResponsavel":"Y"}]'
        DespachoSIGOR.objects.filter(pk=self.despacho.pk).update(payload_wire=wire, resumo=sha256(wire.encode()).hexdigest())
        self.bloqueado(self.consultar(), 'PAYLOAD_COERENTE_REVISAO')
