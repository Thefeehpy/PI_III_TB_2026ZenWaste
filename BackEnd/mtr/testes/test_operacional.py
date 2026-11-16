import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections, connection, transaction, DatabaseError
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from autenticacao.servicos import gerar_token
from empresas.models import Empresa
from mtr.models import (OperadorMTR,RascunhoMTR,DespachoSIGOR,RevisaoAmbientalSIGOR,ReciboMTR,
                        SolicitacaoEmissaoSIGOR,ConcessaoEmissaoSIGOR)
from mtr.servicos_mvp import sessao_operador,ErroMTR
from mtr.sigor import despacho
from mtr.sigor.emissao_controlada import ClienteEmissaoSIGOR,AutoridadeEmissaoAPI10,registrar_concessao,SimuladorAPI10Produto
from mtr.sigor.privacidade import Segredo


class ProdutoMTR05(TransactionTestCase):
    def setUp(self):
        self.assertEqual(connection.vendor,'postgresql')
        self.empresa=Empresa.objects.create(razao_social='Geradora FICTICIA MTR05',cnpj='00000000000001',email='mtr05@example.test',telefone_whatsapp='11000000001',senha='')
        self.outra=Empresa.objects.create(razao_social='Outra FICTICIA',cnpj='00000000000002',email='outra05@example.test',telefone_whatsapp='11000000002',senha='')
        self.pessoa=get_user_model().objects.create_user(username='mtr05-teste',password='SENHA-FICTICIA',first_name='Pessoa',last_name='Ficticia')
        self.op=OperadorMTR.objects.create(empresa=self.empresa,usuario=self.pessoa,pode_revisar=True,pode_autorizar=True,evidencia='FICTICIO')
        self.actor=sessao_operador(self.empresa,'mtr05-teste','SENHA-FICTICIA')['token_operador']
        self.api=self.cliente(self.empresa)

    def cliente(self,e):
        c=APIClient();c.credentials(HTTP_AUTHORIZATION='Bearer '+gerar_token(e));return c

    def post(self,path,data,actor=True,key=None,client=None):
        return (client or self.api).post('/api/mtr/'+path,data,format='json',HTTP_IDEMPOTENCY_KEY=str(key or uuid4()),**({'HTTP_X_MTR_ACTOR_TOKEN':self.actor} if actor else {}))

    def criar(self):
        x=self.post('rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE'});self.assertEqual(x.status_code,201,x.data);return x.data

    def entrada(self,r,real=False):
        dados={**r['dados'],**{p+'_unidade':'99001' for p in ['gerador','transportador','destinador']},
            'resCodigoIbama':'010101' if real else '000001','origem_codigo':'referencia_operador_homologacao' if real else 'fixture_fase1a',
            'marQuantidade':'2.000','uniCodigo':'3' if real else '9001','traCodigo':'4' if real else '9002',
            'tieCodigo':'4' if real else '9003','tiaCodigo':'26' if real else '9004','claCodigo':'42' if real else '9005'}
        return {'versao':r['versao'],'dados':dados,'contexto':{'dados_simulados':not real,'fonte_catalogo':'DECLARACAO FICTICIA NO BANCO DE TESTE',
            'descricoes':{k:'DESCRICAO DE TESTE' for k in ['uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo']},
            'evidencia_participantes':'a'*64,'evidencia_classificacao':'b'*64,'licencas_ficticias_homologacao':True}}

    def salvar(self,r,entrada=None):
        x=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',entrada or self.entrada(r),format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(x.status_code,200,x.data);return x.data

    def aprovado(self,real=False):
        r=self.criar();r=self.salvar(r,self.entrada(r,real))
        x=self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':dict.fromkeys(['participantes','quantidade','classificacao','tratamento_destinador','sem_condicionais','ciencia_homologacao'],True)})
        self.assertEqual(x.status_code,201,x.data);return x.data

    def preparado(self,real=False):
        if real:self.op.verificado_homologacao=True;self.op.save()
        r=self.aprovado(real)
        x=self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'modo':'HOMOLOGACAO' if real else 'SIMULACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,201,x.data);return x.data

    def test_criacao_sem_frete_pedido_comprador_e_isolamento(self):
        from fretes.models import Frete
        from pedidos.models import Pedido
        r=self.criar();self.assertIsNone(r['frete_id']);self.assertEqual(r['ambiente'],'HOMOLOGACAO')
        self.assertFalse(Frete.objects.exists());self.assertFalse(Pedido.objects.exists())
        self.assertEqual(self.cliente(self.outra).get('/api/mtr/rascunhos/').data['resultados'],[])
        self.assertEqual(self.cliente(self.outra).get(f'/api/mtr/rascunhos/{r["id"]}/').status_code,404)

    def test_sem_autenticacao_e_criacao_ambigua_bloqueadas(self):
        self.assertEqual(APIClient().get('/api/mtr/rascunhos/').status_code,401)
        for data in [{},{'tipo':'HOMOLOGACAO_INDEPENDENTE','frete_id':str(uuid4())},{'tipo':'PRODUCAO'}]:
            self.assertEqual(self.post('rascunhos/',data).status_code,400)

    def test_criacao_idempotente_mesma_chave_sem_referencia_extra(self):
        key=uuid4();a=self.post('rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE'},key=key);b=self.post('rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE'},key=key)
        self.assertEqual(a.data,b.data);self.assertEqual(RascunhoMTR.objects.count(),1)

    def test_edicao_pendencias_codigo_fonte_decimal(self):
        r=self.salvar(self.criar());v=self.api.get(f'/api/mtr/rascunhos/{r["id"]}/validacao/')
        self.assertTrue(v.data['valido_para_preparacao'],v.data)
        r0=RascunhoMTR.objects.get(pk=r['id']);self.assertEqual(r0.dados['marQuantidade'],'2.000')
        x=self.api.get(f'/api/mtr/sigor/rascunhos/{r["id"]}/diagnostico/');self.assertEqual(x.status_code,200)

    def test_campos_secretos_ou_contexto_arbitrario_nao_sao_persistidos(self):
        r=self.criar();e=self.entrada(r);e['dados']['senha']='NAO-PERSISTIR'
        x=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',e,format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(x.status_code,400);self.assertNotIn('NAO-PERSISTIR',json.dumps(RascunhoMTR.objects.get().dados))

    def test_cnpj_unidade_diferentes_e_quantidade_invalida_pendentes(self):
        r=self.criar();e=self.entrada(r);e['dados'].update(transportador_cnpj=self.outra.cnpj,transportador_unidade='19323',marQuantidade='1.0001')
        r=self.salvar(r,e);v=self.api.get(f'/api/mtr/rascunhos/{r["id"]}/validacao/').data
        self.assertFalse(v['valido_para_preparacao']);self.assertIn('participantes',v['pendencias']);self.assertIn('marQuantidade',v['pendencias'])

    def test_fixture_nao_promovida_para_homologacao(self):
        r=self.criar();e=self.entrada(r);e['contexto']['dados_simulados']=False;r=self.salvar(r,e)
        v=self.api.get(f'/api/mtr/rascunhos/{r["id"]}/validacao/').data;self.assertFalse(v['valido_para_preparacao'])

    def test_revisao_individual_obrigatoria_e_revogacao(self):
        r=self.salvar(self.criar());payload={'versao':r['versao'],'confirmacoes':{}}
        self.assertEqual(self.post(f'rascunhos/{r["id"]}/revisoes/',payload,actor=False).status_code,403)
        self.op.ativo=False;self.op.save();self.assertEqual(self.post(f'rascunhos/{r["id"]}/revisoes/',payload).status_code,403)

    def test_snapshot_e_dados_congelados_no_ORM_e_SQL(self):
        r=self.aprovado();self.assertEqual(RevisaoAmbientalSIGOR.objects.get().snapshot['responsavel']['usuario_id'],self.pessoa.pk)
        x=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',self.entrada(r),format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()));self.assertEqual(x.status_code,409)
        for sql,args in [('UPDATE mtr_revisaoambientalsigor SET resumo=%s',['0'*64]),('UPDATE mtr_rascunhomtr SET dados=%s',['{}']),('UPDATE mtr_rascunhomtr SET estado=%s',['RASCUNHO'])]:
            with self.assertRaises(DatabaseError),transaction.atomic():
                with connection.cursor() as c:c.execute(sql,args)

    def test_referencia_snapshot_intencao_payload_e_doc_indisponivel(self):
        r=self.preparado();d=DespachoSIGOR.objects.get();wire=json.loads(d.payload_wire,parse_float=Decimal)
        self.assertEqual(len(d.referencia),30);self.assertNotIn(d.referencia,['REF-FICTICIA-ANTERIOR','900000000001','900000000002'])
        self.assertEqual(wire[0]['listaManifestoResiduos'][0]['marQuantidade'],Decimal('2.000'))
        self.assertEqual(r['despacho']['tentativas'],0);self.assertIsNone(r['despacho']['numero_oficial']);self.assertFalse(r['documento']['disponivel'])
        with self.assertRaises(DatabaseError),transaction.atomic():DespachoSIGOR.objects.filter(pk=d.pk).update(payload_wire='[]')

    def test_fluxo_API10_mesmo_backend_sem_numero_oficial_falso(self):
        r=self.preparado();d=r['despacho'];key=uuid4()
        with patch('urllib.request.build_opener',side_effect=AssertionError('SEM REDE')) as http:
            x=self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'sucesso'},key=key)
            self.assertEqual(x.status_code,202,x.data);http.assert_not_called()
        final=self.api.get(f'/api/mtr/rascunhos/{r["id"]}/').data
        self.assertEqual(final['despacho']['estado'],'CONFIRMADA');self.assertTrue(final['despacho']['simulado']);self.assertFalse(final['despacho']['emissao_oficial']);self.assertIsNone(final['despacho']['numero_oficial'])
        self.assertTrue(final['despacho']['historico']);self.assertEqual(self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'sucesso'},key=key).status_code,202)
        self.assertEqual(DespachoSIGOR.objects.get().tentativas,1)

    def test_rejeicao_e_timeout_sem_novo_envio_ou_referencia(self):
        r=self.preparado();d=r['despacho'];self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'timeout'})
        atual=DespachoSIGOR.objects.get();self.assertEqual(atual.estado,'INDETERMINADA')
        with patch.object(SimuladorAPI10Produto,'enviar',side_effect=AssertionError('NAO REENVIAR')) as http:
            self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'sucesso'});http.assert_not_called()
        self.assertEqual(DespachoSIGOR.objects.get().referencia,d['referencia'])
        x=self.post('rascunhos/',{'tipo':'HOMOLOGACAO_INDEPENDENTE'})
        self.assertEqual(x.status_code,409);self.assertEqual(RascunhoMTR.objects.count(),1)

    def test_rascunho_preexistente_nao_contorna_indeterminado(self):
        r=self.preparado();outro=self.aprovado()
        self.post(f'sigor/despachos/{r["despacho"]["id"]}/executar-simulacao/',{'cenario':'timeout'})
        x=self.post(f'rascunhos/{outro["id"]}/intencoes/',{'versao':outro['versao'],'modo':'SIMULACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,409);self.assertEqual(DespachoSIGOR.objects.count(),1)

    def test_reconciliacao_simulada_sem_segundo_POST(self):
        r=self.preparado();d=r['despacho'];self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'timeout'})
        x=self.post(f'sigor/despachos/{d["id"]}/reconciliacoes/',{})
        self.assertEqual(x.status_code,200);self.assertEqual(x.data['tentativas'],1);self.assertTrue(x.data['simulado']);self.assertFalse(x.data['emissao_oficial'])

    def test_duas_requisicoes_concorrentes_um_claim(self):
        r=self.preparado();b=Barrier(2)
        def worker():
            connections.close_all();b.wait(timeout=10)
            try:return despacho.despachar_simulado(self.empresa,r['despacho']['id'],self.op,uuid4())
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            fs=[pool.submit(worker),pool.submit(worker)]
            for f in fs:self.assertEqual(f.result(timeout=30)[1],202)
        self.assertEqual(DespachoSIGOR.objects.get().tentativas,1)

    def test_queda_de_processo_claim_duravel_e_recuperacao(self):
        r=self.preparado();d=r['despacho']
        from mtr.testes.processo_interrompido import executar
        p=executar(d['id'],self.empresa.pk,self.op.pk)
        self.assertEqual(p.returncode,73);self.assertEqual(DespachoSIGOR.objects.get().estado,'EM_DESPACHO')
        with patch('mtr.sigor.despacho.timezone.now',return_value=timezone.now()+timedelta(minutes=2)):
            x=despacho.recuperar_interrompido(self.empresa,d['id'])
        self.assertEqual(x['estado'],'INDETERMINADA');self.assertEqual(x['tentativas'],1)

    def test_transporte_real_e_chave_Q2_nao_liberam_escrita(self):
        r=self.preparado();d=r['despacho'];wire=DespachoSIGOR.objects.get().payload_wire
        with patch('urllib.request.build_opener',side_effect=AssertionError('SEM HTTP')) as http:
            req=ClienteEmissaoSIGOR().preparar_requisicao(wire,Segredo('TOKEN-FICTICIO'))
            with self.assertRaises(PermissionError):ClienteEmissaoSIGOR().enviar_governamental(req)
            x=self.post(f'sigor/despachos/{d["id"]}/emitir/',{});self.assertEqual(x.status_code,403)
            http.assert_not_called()
        self.assertEqual(DespachoSIGOR.objects.get().tentativas,0)

    def test_homologacao_requer_pessoa_verificada_e_nao_simula(self):
        r=self.aprovado(real=True)
        x=self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'modo':'HOMOLOGACAO','confirmar_preparacao':True});self.assertEqual(x.status_code,422)
        self.op.verificado_homologacao=True;self.op.save()
        x=self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'modo':'HOMOLOGACAO','confirmar_preparacao':True});self.assertEqual(x.status_code,201,x.data)
        d=x.data['despacho'];self.assertFalse(d['simulado'])
        self.assertEqual(self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'sucesso'}).status_code,403)

    def test_solicitacao_concreta_nao_concede_sem_conta(self):
        r=self.preparado(real=True);d=r['despacho']
        x=self.post(f'sigor/despachos/{d["id"]}/solicitacoes-emissao/',{});self.assertEqual(x.status_code,422)
        self.assertFalse(SolicitacaoEmissaoSIGOR.objects.exists())
        with override_settings(MTR_SIGOR_CONTAS={str(self.empresa.pk):{'unidade':99001,'gerador_cnpj':self.empresa.cnpj,'credencial_ref':'FICTICIO_API10','operador_id':self.op.pk}},MTR_SIGOR_EXECUTOR_REFERENCIA='SERVIDOR-FICTICIO-TESTE'):
            x=self.post(f'sigor/despachos/{d["id"]}/solicitacoes-emissao/',{});self.assertEqual(x.status_code,201,x.data)
        self.assertFalse(x.data['concedida']);self.assertEqual(x.data['escopo']['max_tentativas'],1);self.assertEqual(x.data['escopo']['payload_sha256'],DespachoSIGOR.objects.get().resumo)
        with self.assertRaises(ErroMTR):registrar_concessao(SolicitacaoEmissaoSIGOR.objects.get(),{},'FICTICIA',AutoridadeEmissaoAPI10())
        self.assertFalse(ConcessaoEmissaoSIGOR.objects.exists())

    def test_outra_empresa_nao_acessa_despacho_solicitacao_nem_comando(self):
        r=self.preparado();d=r['despacho'];key=uuid4();self.post(f'sigor/despachos/{d["id"]}/executar-simulacao/',{'cenario':'sucesso'},key=key)
        c=self.cliente(self.outra)
        for path in [f'sigor/despachos/{d["id"]}/',f'comandos/{key}/']:
            self.assertEqual(c.get('/api/mtr/'+path).status_code,404)

    def test_concessao_ficticia_escopo_janela_imutabilidade_nao_libera_rede(self):
        r=self.preparado(real=True);d=r['despacho']
        with override_settings(MTR_SIGOR_CONTAS={str(self.empresa.pk):{'unidade':99001,'gerador_cnpj':self.empresa.cnpj,'credencial_ref':'FICTICIO_API10','operador_id':self.op.pk}},MTR_SIGOR_EXECUTOR_REFERENCIA='SERVIDOR-FICTICIO-TESTE'):
            self.assertEqual(self.post(f'sigor/despachos/{d["id"]}/solicitacoes-emissao/',{}).status_code,201)
        solicitacao=SolicitacaoEmissaoSIGOR.objects.get()
        agora=timezone.now()
        scope={**solicitacao.escopo,'inicio':(agora-timedelta(seconds=5)).isoformat(),'fim':(agora+timedelta(minutes=5)).isoformat(),
               'aprovador':'AUTORIDADE-FICTICIA-SEM-VALIDADE','evidencia_aprovacao':'c'*64}
        class AutoridadeFicticia(AutoridadeEmissaoAPI10):
            def verificar(self,escopo,assinatura):
                if assinatura!='ASSINATURA-FICTICIA':raise ErroMTR('ASSINATURA_INVALIDA','Assinatura de teste inválida.',403)
        a=AutoridadeFicticia()
        for errado in [{**scope,'referencia':'OUTRA'},{**scope,'fim':(agora+timedelta(days=2)).isoformat()}]:
            with self.assertRaises(ErroMTR):registrar_concessao(solicitacao,errado,'ASSINATURA-FICTICIA',a)
        with self.assertRaises(ErroMTR):registrar_concessao(solicitacao,scope,'INVALIDA',a)
        self.assertFalse(ConcessaoEmissaoSIGOR.objects.exists())
        concessao=registrar_concessao(solicitacao,scope,'ASSINATURA-FICTICIA',a)
        with self.assertRaises(DatabaseError),transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute('UPDATE mtr_concessaoemissaosigor SET escopo=%s WHERE id=%s',['{}',concessao.pk])
        with patch('urllib.request.build_opener',side_effect=AssertionError('SEM REDE')) as http:
            self.assertEqual(self.post(f'sigor/despachos/{d["id"]}/emitir/',{}).status_code,403);http.assert_not_called()
        self.assertEqual(DespachoSIGOR.objects.get().tentativas,0)

    def conta_teste(self):
        return override_settings(MTR_SIGOR_CONTAS={str(self.empresa.pk):{'unidade':99001,'gerador_cnpj':self.empresa.cnpj,'credencial_ref':'FICTICIO_API10','operador_id':self.op.pk}},MTR_SIGOR_EXECUTOR_REFERENCIA='SERVIDOR-FICTICIO-TESTE')

    def concedido_ficticio(self):
        r=self.preparado(real=True);id=r['despacho']['id']
        self.assertEqual(self.post(f'sigor/despachos/{id}/solicitacoes-emissao/',{}).status_code,201)
        solicitacao=SolicitacaoEmissaoSIGOR.objects.get();agora=timezone.now()
        scope={**solicitacao.escopo,'inicio':(agora-timedelta(seconds=5)).isoformat(),'fim':(agora+timedelta(minutes=5)).isoformat(),
               'aprovador':'AUTORIDADE-FICTICIA','evidencia_aprovacao':'c'*64}
        class Ficticia(AutoridadeEmissaoAPI10):
            def verificar(self,escopo,assinatura):
                if assinatura!='FICTICIA':raise AssertionError('Somente fixture')
        registrar_concessao(solicitacao,scope,'FICTICIA',Ficticia())
        return id

    def test_despacho_concedido_transporte_falso_fora_SQL_recibo_e_uma_iniciativa(self):
        from mtr.sigor.escrita import despachar_autorizado,TransporteAPI10Homologacao
        from mtr.sigor.simulacao import TransporteDespachoSimulado
        from mtr.sigor import escrita
        chamadas=[];teste=self
        class Falso(TransporteAPI10Homologacao):
            rede_real=False
            def enviar(self,wire,conta,limite):
                teste.assertFalse(connection.in_atomic_block);chamadas.append('HTTP-FICTICIO')
                return TransporteDespachoSimulado('rejeicao').enviar(wire)
        with self.conta_teste():
            id=self.concedido_ficticio();key=uuid4()
            with patch.object(escrita,'politica_escrita_permite',return_value=True),patch('urllib.request.build_opener',side_effect=AssertionError('SEM REDE')):
                for _ in range(2):
                    self.assertEqual(despachar_autorizado(self.empresa,id,self.op,key,transporte=Falso())[1],202)
                with self.assertRaises(ErroMTR):despachar_autorizado(self.empresa,id,self.op,uuid4(),transporte=Falso())
        d=DespachoSIGOR.objects.get();self.assertEqual(chamadas,['HTTP-FICTICIO']);self.assertEqual(d.tentativas,1);self.assertEqual(d.estado,'REJEITADA')
        self.assertIsNone(d.resultado['numero_nacional'])

    def test_despacho_concedido_timeout_indeterminado_e_expiracao_sem_claim(self):
        from mtr.sigor.escrita import despachar_autorizado,TransporteAPI10Homologacao
        from mtr.sigor import escrita
        class Falso(TransporteAPI10Homologacao):
            rede_real=False
            def enviar(self,wire,conta,limite):raise TimeoutError('FICTICIO')
        with self.conta_teste():
            id=self.concedido_ficticio()
            with patch.object(escrita,'politica_escrita_permite',return_value=True):
                with patch('mtr.sigor.escrita.timezone.now',return_value=timezone.now()+timedelta(minutes=10)):
                    with self.assertRaises(ErroMTR):despachar_autorizado(self.empresa,id,self.op,uuid4(),transporte=Falso())
                self.assertEqual(DespachoSIGOR.objects.get().tentativas,0)
                despachar_autorizado(self.empresa,id,self.op,uuid4(),transporte=Falso())
                with self.assertRaises(ErroMTR):despachar_autorizado(self.empresa,id,self.op,uuid4(),transporte=Falso())
        self.assertEqual(DespachoSIGOR.objects.get().estado,'INDETERMINADA');self.assertEqual(DespachoSIGOR.objects.get().tentativas,1)

    def test_gate_de_codigo_nao_e_substituido_por_autorizacao_ou_flag(self):
        from mtr.sigor.escrita import despachar_autorizado,TransporteAPI10Homologacao
        from mtr.sigor import escrita
        with self.conta_teste():
            id=self.concedido_ficticio()
            with patch.object(TransporteAPI10Homologacao,'enviar',side_effect=AssertionError('SEM ENVIO')) as port:
                with self.assertRaises(ErroMTR):despachar_autorizado(self.empresa,id,self.op,uuid4())
                port.assert_not_called()
            # Mesmo o gate injetado apenas no teste não dispensa a vinculação à conta autorizada.
            with patch.object(escrita,'politica_escrita_permite',return_value=True),override_settings(MTR_SIGOR_EXECUTOR_REFERENCIA='OUTRO-EXECUTOR'):
                with self.assertRaises(ErroMTR):despachar_autorizado(self.empresa,id,self.op,uuid4())
        self.assertEqual(DespachoSIGOR.objects.get().tentativas,0)

    def test_autenticacao_e_API10_com_HTTP_injetado_sem_credenciais_reais(self):
        from mtr.sigor.escrita import TransporteAPI10Homologacao
        from mtr.sigor import escrita
        from mtr.sigor.configuracao import ContaServidor
        from mtr.sigor.privacidade import CredenciaisSIGOR
        from mtr.sigor.leitura import RespostaPrivada
        r=self.preparado(real=True);wire=DespachoSIGOR.objects.get().payload_wire;chamadas=[]
        credenciais=CredenciaisSIGOR(self.empresa.cnpj,'SENHA-FICTICIA','99001')
        conta=ContaServidor(self.empresa.pk,self.op.pk,99001,self.empresa.cnpj,'FICTICIO_API10')
        def auth(req):
            url,metodo,headers,body=req._para_http();self.assertEqual(url,'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest/gettoken')
            self.assertEqual(metodo,'POST');self.assertNotIn('Authorization',headers);self.assertIsInstance(body,bytes)
            chamadas.append('AUTH-FICTICIA')
            return RespostaPrivada(200,'application/json',json.dumps({'erro':False,'objetoResposta':'TOKEN-FICTICIO'}).encode())
        def api10(req):
            url,metodo,headers,body=req._para_http();self.assertEqual(url,'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest/salvarManifestoLote')
            self.assertEqual(metodo,'POST');self.assertEqual(headers['Authorization'],'Bearer TOKEN-FICTICIO');self.assertEqual(body,wire.encode())
            chamadas.append('API10-FICTICIA');return object()
        with override_settings(MTR_SIGOR_PROVEDOR_CREDENCIAL=lambda ref:credenciais),patch.object(escrita,'politica_escrita_permite',return_value=True),patch.object(escrita.TransporteHTTPSHomologacao,'__init__',return_value=None),patch.object(escrita.TransporteHTTPSHomologacao,'enviar',side_effect=auth),patch.object(ClienteEmissaoSIGOR,'enviar_governamental',side_effect=api10),patch('urllib.request.build_opener',side_effect=AssertionError('SEM REDE')):
            TransporteAPI10Homologacao().enviar(wire,conta,timezone.now()+timedelta(minutes=1))
        self.assertEqual(chamadas,['AUTH-FICTICIA','API10-FICTICIA'])
