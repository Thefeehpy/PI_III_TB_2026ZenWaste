import json
from pathlib import Path
from unittest.mock import patch
from io import StringIO
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase,SimpleTestCase,TransactionTestCase,override_settings
from rest_framework.test import APIClient
from autenticacao.servicos import gerar_token
from empresas.models import Empresa
from mtr.models import OperadorMTR,RascunhoMTR,ConcessaoEmissaoSIGOR
from mtr.sigor import preparacao as p
from mtr.sigor.autoridade_api10 import AutoridadeHMACAPI10
from mtr.sigor.emissao_controlada import ClienteEmissaoSIGOR
from mtr.sigor.leitura import RespostaPrivada
from mtr.servicos_mvp import ErroMTR

META={'formato':p.FORMATO,'empresa_email':'empresa-api10@example.test','cnpj_informado':'1234567800019','unidade':99001,
      'responsavel_usuario':None,'responsavel_nome':None,'credencial_ref':'FICTICIO_API10','executor_ref':'TESTE-ISOLADO',
      'evidencia_representacao_sha256':None,'evidencia_ambiental_sha256':None,'representacao_confirmada':False,'ambiental_confirmada':False}


class TestesPreparacaoFinal(TestCase):
    def setUp(self):
        self.e=Empresa.objects.create(razao_social='FICTICIA SEM VINCULO SIGOR',cnpj='00000000000001',email='demo-api10@example.test',telefone_whatsapp='11000000003',senha='')
        self.api=APIClient();self.api.credentials(HTTP_AUTHORIZATION='Bearer '+gerar_token(self.e))

    @override_settings(MTR_SIGOR_CADASTRO_METADATA=META)
    def test_inspecao_nao_cria_empresa_pessoa_nem_normaliza_documento(self):
        antes=Empresa.objects.count();v=p.inspecionar(META['empresa_email'])
        self.assertFalse(v['empresa_encontrada']);self.assertEqual(v['cnpj_informado_digitos'],13)
        self.assertFalse(v['vinculo_aplicado']);self.assertEqual(Empresa.objects.count(),antes)
        self.assertEqual(p.metadata()['cnpj_informado'],'1234567800019');self.assertFalse(OperadorMTR.objects.exists())

    @override_settings(MTR_SIGOR_CADASTRO_METADATA=META)
    def test_projecao_publica_nao_vaza_email_documento_pessoa_ou_credencial(self):
        r=self.api.get('/api/mtr/sigor/contratos/');self.assertEqual(r.status_code,200)
        v=r.data['preparacao_controlada'];self.assertEqual(v['dados']['marQuantidade'],'5.5');self.assertEqual(v['unidade_proposta'],99001)
        self.assertIsNone(v['unidade_vinculada']);self.assertIsNone(v['referencia']);self.assertIsNone(v['payload_sha256'])
        texto=json.dumps(v);self.assertNotIn(META['empresa_email'],texto);self.assertNotIn(META['cnpj_informado'],texto);self.assertNotIn(META['credencial_ref'],texto)

    @override_settings(MTR_SIGOR_CADASTRO_METADATA=META)
    def test_criacao_sem_vinculo_nao_usa_empresa_demonstrativa(self):
        x=self.api.post('/api/mtr/rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE','cenario':'MTR05B_HOMOLOGACAO'},format='json',HTTP_IDEMPOTENCY_KEY='69f4bb6d-8bb4-4222-8b8c-64e9ff650ccb')
        self.assertEqual(x.status_code,422);self.assertFalse(RascunhoMTR.objects.exists())

    def test_metadata_com_senha_ou_flags_nao_booleanas_recusada(self):
        for errado in [{**META,'senha':'FICTICIA'},{**META,'representacao_confirmada':'true'}]:
            with override_settings(MTR_SIGOR_CADASTRO_METADATA=errado):
                with self.assertRaises(ErroMTR):p.metadata()

    def test_eu_mesmo_sem_nome_e_poderes_nao_identifica_usuario(self):
        v={**META,'empresa_email':self.e.email,'cnpj_informado':self.e.cnpj,'responsavel_usuario':'pessoa-ficticia','responsavel_nome':'eu mesmo'}
        u=get_user_model().objects.create_user(username='pessoa-ficticia',first_name='Pessoa',last_name='Ficticia')
        op=OperadorMTR.objects.create(empresa=self.e,usuario=u,pode_revisar=True,pode_autorizar=True)
        self.assertIn('PESSOA_INDIVIDUAL_NAO_IDENTIFICADA',p.pendencias(self.e,v,op))
        self.assertIn('CNPJ_COMPLETO_NAO_CONFIRMADO',p.pendencias(self.e,v,op))

    def test_candidato_apto_a_revisao_nao_cria_aprovacao_ou_intencao(self):
        # Documento sintético válido apenas no banco de teste, nunca identidade de homologação.
        self.e.cnpj='11222333000181';self.e.save()
        u=get_user_model().objects.create_user(username='revisor-ficticio',first_name='Pessoa',last_name='Ficticia')
        op=OperadorMTR.objects.create(empresa=self.e,usuario=u,pode_revisar=True,pode_autorizar=True,verificado_homologacao=True)
        v={**META,'empresa_email':self.e.email,'cnpj_informado':self.e.cnpj,'responsavel_usuario':u.username,'responsavel_nome':u.get_full_name(),
           'evidencia_representacao_sha256':'a'*64,'evidencia_ambiental_sha256':'b'*64,'representacao_confirmada':True,'ambiental_confirmada':True}
        with override_settings(MTR_SIGOR_CADASTRO_METADATA=v):
            x=self.api.post('/api/mtr/rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE','cenario':'MTR05B_HOMOLOGACAO'},format='json',HTTP_IDEMPOTENCY_KEY='13f4bb6d-8bb4-4222-8b8c-64e9ff650ccb')
        self.assertEqual(x.status_code,201,x.data);self.assertIsNone(x.data['revisao']);self.assertIsNone(x.data['despacho'])
        self.assertEqual(x.data['estado'],'RASCUNHO');self.assertEqual(x.data['dados']['marQuantidade'],'5.5')
        self.assertFalse(ConcessaoEmissaoSIGOR.objects.exists())

    def test_concessao_nao_interativa_nunca_autoriza(self):
        with patch('mtr.management.commands.mtr_conceder_api10.sys.stdin.isatty',return_value=False):
            with self.assertRaises(CommandError):call_command('mtr_conceder_api10',solicitacao='NAO-EXISTE',evidencia_aprovacao='c'*64,stdout=StringIO())
        self.assertFalse(ConcessaoEmissaoSIGOR.objects.exists())

    def test_guard_banco_principal_bloqueia_antes_de_cursor(self):
        with override_settings(DATABASES={'default':{'NAME':'principal','HOST':'127.0.0.1','PORT':'5432'}}),patch.object(connection,'cursor',side_effect=AssertionError('NAO CONECTAR')) as cursor:
            with self.assertRaises(ErroMTR):p.exigir_ambiente_mtr05()
            cursor.assert_not_called()

    def test_identidade_de_cluster_ausente_bloqueia_antes_de_conectar(self):
        with override_settings(MTR_ISOLADO_ESPERADO=None),patch.object(connection,'cursor',side_effect=AssertionError('NAO CONECTAR')) as cursor:
            with self.assertRaises(ErroMTR):p.exigir_ambiente_mtr05()
            cursor.assert_not_called()

    @override_settings(MTR_SIGOR_CADASTRO_METADATA=None)
    def test_unidade_privada_nao_tem_fallback_publico(self):
        proposta=p.proposta_publica(self.e)
        self.assertIsNone(proposta['unidade_proposta']);self.assertFalse(proposta['pode_criar_candidato'])


class TestesAutoridadeAPI10(SimpleTestCase):
    def scope(self):
        return {'finalidade':'API10_EMISSAO_HOMOLOGACAO','ambiente':'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest','metodo':'POST',
                'rota':'/salvarManifestoLote','max_tentativas':1,'intencao_id':'TESTE','referencia':'REFERENCIA-FICTICIA','payload_sha256':'a'*64}

    def test_canonicalizacao_estavel_e_assinatura_sensivel_ao_escopo(self):
        a=AutoridadeHMACAPI10(lambda:bytes(range(32)));s=self.scope();sig=a.assinar(s)
        self.assertEqual(a.assinar(dict(reversed(list(s.items())))),sig);a.verificar(s,sig)
        with self.assertRaises(ErroMTR):a.verificar({**s,'referencia':'OUTRA'},sig)
        self.assertNotIn(sig,repr(a));self.assertNotIn(str(bytes(range(32))),repr(a))

    def test_Q2_producao_e_quota_generica_nao_sao_aceitos(self):
        a=AutoridadeHMACAPI10(lambda:bytes(range(32)))
        for s in [{**self.scope(),'finalidade':'Q2'},{**self.scope(),'max_tentativas':True},{**self.scope(),'ambiente':'https://producao.invalid'},{**self.scope(),'rota':'/gettoken'}]:
            with self.assertRaises(ErroMTR):a.assinar(s)
        with self.assertRaises(ErroMTR):a.verificar(self.scope(),'q2-hmac-v1:'+'a'*64)

    def test_ausencia_de_chave_nao_le_arquivo_nem_reutiliza_Q2(self):
        with patch.dict('os.environ',{},clear=True),patch.object(Path,'read_bytes',side_effect=AssertionError('SEM CHAVE EM ARQUIVO')):
            with self.assertRaises(ErroMTR):AutoridadeHMACAPI10().assinar(self.scope())

    def test_egresso_so_host_homologacao_resolvido_443_com_liberacao_especifica(self):
        from mtr.sigor.ativacao_api10 import destino_permitido
        with override_settings(MTR_SIGOR_API10_LIBERACAO={'intencao_id':'FICTICIO'},MTR_SIGOR_API10_REDE_EXPLICITA=True),patch('mtr.sigor.ativacao_api10.permite',return_value=True):
            self.assertTrue(destino_permitido(('192.0.2.1',443),{'192.0.2.1'}))
            self.assertFalse(destino_permitido(('192.0.2.2',443),{'192.0.2.1'}))
            self.assertFalse(destino_permitido(('192.0.2.1',80),{'192.0.2.1'}))
        with override_settings(MTR_SIGOR_API10_REDE_EXPLICITA=False):
            self.assertFalse(destino_permitido(('192.0.2.1',443),{'192.0.2.1'}))

    def test_contrato_ficticio_correlacao_explicita(self):
        raiz=Path(__file__).parent/'dados'
        request=(raiz/'api10_requisicao_ficticia.json').read_text(encoding='utf-8')
        response=(raiz/'api10_resposta_ficticia.json').read_bytes()
        valor=ClienteEmissaoSIGOR().interpretar(RespostaPrivada(200,'application/json',response),request)
        self.assertEqual(valor.estado,'CONFIRMADA');self.assertEqual(valor.numero_nacional,'900000000001')
        for modo in ['ausente','divergente']:
            bruto=json.loads(response)
            if modo=='ausente':bruto['respostaApiwsManifestoDTO'][0].pop('seuCodigo')
            else:bruto['respostaApiwsManifestoDTO'][0]['seuCodigo']='OUTRA'
            v=ClienteEmissaoSIGOR().interpretar(RespostaPrivada(200,'application/json',json.dumps(bruto).encode()),request)
            self.assertEqual(v.estado,'INDETERMINADA')


class TestesGateEspecificoAPI10(TransactionTestCase):
    def preparar(self):
        # Reutiliza as fábricas existentes, sem tratar a concessão fictícia como aprovação real.
        from mtr.testes.test_operacional import ProdutoMTR05
        caso=ProdutoMTR05();caso.setUp()
        with caso.conta_teste():id=caso.concedido_ficticio()
        from mtr.models import DespachoSIGOR
        d=DespachoSIGOR.objects.get(pk=id)
        return caso,d,{'intencao_id':str(d.pk),'referencia':d.referencia,'snapshot_sha256':d.revisao.resumo,'payload_sha256':d.resumo}

    def test_flag_generica_e_configuracao_ausente_nao_abrem_gate(self):
        from mtr.sigor.protocolo import politica_escrita_permite
        for v in [None,True,{'habilitada':True}]:
            with override_settings(MTR_SIGOR_API10_LIBERACAO=v):self.assertFalse(politica_escrita_permite(intencao_id='QUALQUER'))

    def test_apenas_intencao_hashes_concessao_e_janela_correspondentes(self):
        from mtr.sigor.protocolo import politica_escrita_permite
        from django.utils import timezone
        from datetime import timedelta
        caso,d,v=self.preparar()
        with override_settings(MTR_SIGOR_API10_LIBERACAO=v):
            self.assertFalse(politica_escrita_permite())
            self.assertTrue(politica_escrita_permite(intencao_id=d.pk))
            self.assertTrue(politica_escrita_permite(referencia=d.referencia,payload_sha256=d.resumo))
            self.assertFalse(politica_escrita_permite(referencia=d.referencia,payload_sha256='0'*64))
            with patch('mtr.sigor.ativacao_api10.timezone.now',return_value=timezone.now()+timedelta(hours=2)):
                self.assertFalse(politica_escrita_permite(intencao_id=d.pk))
            caso.op.ativo=False;caso.op.save();self.assertFalse(politica_escrita_permite(intencao_id=d.pk))
        d.refresh_from_db();self.assertEqual(d.tentativas,0)

    def test_despacho_com_gate_especifico_e_HTTP_falso_nao_repete_iniciativa(self):
        from mtr.sigor.escrita import despachar_autorizado,TransporteAPI10Homologacao
        from mtr.sigor.simulacao import TransporteDespachoSimulado
        from uuid import uuid4
        caso,d,v=self.preparar();chamadas=[]
        class Falso(TransporteAPI10Homologacao):
            rede_real=False
            def enviar(self,wire,conta,limite):
                chamadas.append('FICTICIO');return TransporteDespachoSimulado('rejeicao').enviar(wire)
        with caso.conta_teste(),override_settings(MTR_SIGOR_API10_LIBERACAO=v),patch('urllib.request.build_opener',side_effect=AssertionError('SEM REDE')):
            self.assertEqual(despachar_autorizado(caso.empresa,d.pk,caso.op,uuid4(),transporte=Falso())[1],202)
            with self.assertRaises(ErroMTR):despachar_autorizado(caso.empresa,d.pk,caso.op,uuid4(),transporte=Falso())
        d.refresh_from_db();self.assertEqual(d.tentativas,1);self.assertEqual(chamadas,['FICTICIO'])
