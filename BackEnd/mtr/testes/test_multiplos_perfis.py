"""MTR-04A.1: papeis distintos com identidade compartilhada, somente prova local."""
import json
from unittest.mock import patch

from django.test import TestCase, override_settings
from app.excecoes import ErroRegraNegocio
from empresas.models import EmpresaPapel, PapelEmpresa
from fretes.models import Frete
from mtr.models import VinculoAmbientalSIGOR, DespachoSIGOR, ReciboMTR
from mtr.sigor.configuracao import conta_da_empresa
from mtr.sigor.protocolo import AdaptadorEmissaoSIGORBloqueado, politica_escrita_permite
from mtr.sigor.privacidade import Segredo
from mtr.testes.test_evidencias_homologacao import CenarioEvidencias


class TestesMultiplosPerfis(CenarioEvidencias, TestCase):
    def contratado(self, **campos):
        # Somente fixture isolada: servico comercial existente, sem editar o frete.
        papel, _ = PapelEmpresa.objects.get_or_create(codigo='transportadora', defaults={'descricao':'Transportadora'})
        EmpresaPapel.objects.get_or_create(empresa=self.vendedora, papel=papel)
        return self.comando(self.novo(**campos), 'classificar', {
            'modalidade':'contratado', 'transportadora_id':self.vendedora.pk, 'valor_referencia':'500.00'})

    def setUp(self):
        super().setUp()
        dados=dict(self.r['dados'])
        for prefixo in ['gerador','transportador','destinador']:
            dados[prefixo+'_cnpj']=self.vendedora.cnpj
            dados[prefixo+'_unidade']='99001'
        self.r=self.salvar(self.r,dados)
        # Tres fatos/UUIDs/papeis; igualdade documental nao os transforma num papel unico.
        for papel in ['GERADOR','TRANSPORTADOR','DESTINADOR']:
            x=self.post('sigor/vinculos/', {'papel':papel,'cpf_cnpj':self.vendedora.cnpj,'unidade':99001,
                'simulado':True,'evidencia_sha256':'e'*64,'confirmar_habilitacao':True})
            self.assertEqual(x.status_code,201,x.data)
            self.vinculos[papel]=x.data['id']

    def test_uma_configuracao_de_conta_para_tres_papeis_sem_carregar_segredo(self):
        self.preparar()
        conta={'unidade':99001,'gerador_cnpj':self.vendedora.cnpj,'operador_id':self.op.pk,'credencial_ref':'REF_FICTICIA'}
        gerador=VinculoAmbientalSIGOR.objects.get(pk=self.vinculos['GERADOR'])
        with override_settings(MTR_SIGOR_CONTAS={str(self.vendedora.pk):conta}), \
             patch('mtr.sigor.configuracao.provedor_ambiente',side_effect=AssertionError('Sem segredo')) as segredo:
            local=conta_da_empresa(self.vendedora,gerador,self.op)
            self.assertEqual(local.unidade,99001)
            self.assertEqual(local.empresa_id,self.vendedora.pk)
            segredo.assert_not_called()
        self.externa('CONFIGURACAO_EXTERNA_PENDENTE')

    def test_tres_papeis_preservados_com_mesmo_cnpj(self):
        despacho=self.preparar()
        v=despacho.revisao.snapshot['vinculos']
        self.assertEqual(set(v),{'GERADOR','TRANSPORTADOR','DESTINADOR'})
        self.assertEqual({p['cpf_cnpj'] for p in v.values()},{self.vendedora.cnpj})
        self.assertEqual(len({p['id'] for p in v.values()}),3)

    def test_mesma_unidade_serializada_sem_apagar_papeis(self):
        despacho=self.preparar()
        v=despacho.revisao.snapshot['vinculos']
        self.assertEqual({p['unidade'] for p in v.values()},{99001})
        payload=json.loads(despacho.payload_wire)[0]
        self.assertEqual(payload['transportador']['unidade'],99001)
        self.assertEqual(payload['destinador']['unidade'],99001)
        self.assertNotIn('gerador',payload)

    def test_perfis_locais_nao_comprovam_habilitacao(self):
        self.preparar()
        for papel in ['GERADOR','TRANSPORTADOR','DESTINADOR']:
            self.externa('HABILITACAO_EXTERNA_'+papel)

    def test_gerador_sem_representacao_externa_continua_pendente(self):
        self.preparar()
        self.op.verificado_homologacao=True;self.op.save()
        self.externa('IDENTIDADE_EXTERNA_PENDENTE')

    def test_da01_satisfeita_para_mesma_empresa_por_fluxo_existente(self):
        self.preparar()
        self.frete.refresh_from_db()
        self.assertEqual(self.frete.transportadora_id,self.vendedora.pk)
        self.assertNotEqual(self.frete.empresa_compradora_id,self.vendedora.pk)
        resultado=self.diagnosticar()
        self.assertEqual(resultado['estado_interno'],'APTO TECNICAMENTE')
        self.assertTrue(any(c['codigo']=='TRANSPORTADOR_COINCIDE_FRETE' and c['situacao']=='VERIFICADO INTERNAMENTE' for c in resultado['verificacoes']))

    def test_da01_divergente_nao_e_corrigida_por_identidade_da_conta(self):
        despacho=self.preparar()
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.transportadora)
        x=self.api.get(f'/api/mtr/sigor/rascunhos/{self.r["id"]}/diagnostico/',HTTP_X_MTR_ACTOR_TOKEN=self.token)
        self.assertEqual(x.status_code,422)
        self.assertEqual(x.data['codigo'],'TRANSPORTADOR_DIVERGENTE_FRETE')
        self.frete.refresh_from_db();despacho.refresh_from_db()
        self.assertEqual(self.frete.transportadora_id,self.transportadora.pk)
        self.assertEqual(despacho.tentativas,0)

    def test_sem_transportadora_comercial_nao_usa_a_conta_como_substituta(self):
        self.preparar()
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=None)
        x=self.api.get(f'/api/mtr/sigor/rascunhos/{self.r["id"]}/diagnostico/',HTTP_X_MTR_ACTOR_TOKEN=self.token)
        self.assertEqual(x.status_code,422)
        self.assertEqual(x.data['codigo'],'TRANSPORTADORA_NAO_DEFINIDA')
        self.frete.refresh_from_db();self.assertIsNone(self.frete.transportadora_id)

    def test_destinador_com_mesma_identidade_nao_atesta_aptidao_ao_residuo(self):
        self.preparar()
        self.externa('HABILITACAO_EXTERNA_DESTINADOR')

    def test_frete_da_mesma_vendedora_e_compradora_e_rejeitado_sem_contornar(self):
        papel,_=PapelEmpresa.objects.get_or_create(codigo='compradora',defaults={'descricao':'Compradora'})
        EmpresaPapel.objects.get_or_create(empresa=self.vendedora,papel=papel)
        antes=Frete.objects.count()
        with self.assertRaises(ErroRegraNegocio) as erro:
            self.novo(empresa_compradora_id=self.vendedora.pk)
        self.assertIn('distintas',str(erro.exception))
        self.assertEqual(Frete.objects.count(),antes)

    def test_identificadores_repetidos_nao_comprovam_aceite_do_contrato(self):
        self.preparar()
        self.externa('CONTRATO_VIGENTE_PENDENTE')

    def test_codigo_referencial_nao_e_classificacao_para_unidade_compartilhada(self):
        self.preparar()
        x=self.externa('CLASSIFICACAO_EXTERNA_PENDENTE')
        self.assertEqual(x['codigo_residuo'],'150104')

    def test_confirmacoes_humanas_de_fixture_nao_promovem_classificacao(self):
        despacho=self.preparar()
        self.assertTrue(despacho.revisao.snapshot['confirmacoes']['classificacao'])
        self.externa('CLASSIFICACAO_EXTERNA_PENDENTE')

    def test_contrato_sem_versao_nao_se_torna_confirmado_com_tres_perfis(self):
        self.preparar()
        self.externa('CONTRATO_VIGENTE_PENDENTE')

    def test_politica_escrita_nao_e_alterada_para_a_mesma_conta(self):
        despacho=self.preparar()
        adaptador=AdaptadorEmissaoSIGORBloqueado()
        requisicao=adaptador.preparar_requisicao(despacho.payload_wire,Segredo('TOKEN-FICTICIO-SEM-VALIDADE'))
        with patch('urllib.request.build_opener',side_effect=AssertionError('Sem rede')) as rede:
            with self.assertRaises(PermissionError):adaptador.enviar(requisicao)
            rede.assert_not_called()
        self.assertIs(politica_escrita_permite(),False)

    def test_diagnostico_nao_consume_tentativa_nem_cria_recibo(self):
        despacho=self.preparar();recibos=ReciboMTR.objects.count()
        self.diagnosticar();self.diagnosticar()
        despacho.refresh_from_db()
        self.assertEqual(despacho.tentativas,0)
        self.assertEqual(ReciboMTR.objects.count(),recibos)

    def test_diagnostico_preserva_snapshots_e_todas_as_tabelas(self):
        self.preparar();antes=self.estado_tabelas()
        self.diagnosticar()
        self.assertEqual(antes,self.estado_tabelas())

    def test_tres_papeis_simulados_nao_podem_preparar_homologacao(self):
        rev=self.revisao();self.assertEqual(rev.status_code,201)
        x=self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',
            {'revisao_id':rev.data['id'],'modo':'HOMOLOGACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,422)
        self.assertEqual(x.data['codigo'],'DADO_FICTICIO_BLOQUEADO')
        self.assertFalse(DespachoSIGOR.objects.exists())
