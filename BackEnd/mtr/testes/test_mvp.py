import json
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connections, connection, transaction
from django.test import TestCase, SimpleTestCase, TransactionTestCase
from rest_framework.test import APIClient

from autenticacao.servicos import gerar_token
from fretes.test_integracao import CenarioFretes
from fretes.models import Frete
from mtr.models import OperadorMTR, RascunhoMTR, RevisaoMTR, IntencaoMTR, ReciboMTR, EventoMTR
from mtr.catalogos_mvp import catalogos_mvp
from mtr.sigor_contrato import construir_payload, json_wire, TransporteSIGOREscritaBloqueada, ErroContratoMTR
from mtr.servicos_mvp import sessao_operador, operador_transacional, ErroMTR


def dados_validos(cnpj='00000000000001'):
    return {'gerador_cnpj':cnpj,'gerador_unidade':'99001','transportador_cnpj':'00000000000003','transportador_unidade':'99002',
        'destinador_cnpj':'00000000000009','destinador_unidade':'99003','resCodigoIbama':'000001','origem_codigo':'fixture_fase1a',
        'marQuantidade':'7.000','uniCodigo':'9001','traCodigo':'9002','tieCodigo':'9003','tiaCodigo':'9004','claCodigo':'9005'}


class TestesContratoSIGORMVP(SimpleTestCase):
    def test_payload_array_um_manifesto_sem_gerador_at_com_decimal_exato(self):
        p=construir_payload(dados_validos(),'Pessoa de teste','MOCK-REFERENCIA','00000000000001')
        wire=json_wire(p)
        self.assertEqual(len(p),1); self.assertNotIn('gerador',p[0]); self.assertNotIn('armazenadorTemporario',p[0])
        self.assertEqual(len(p[0]['listaManifestoResiduos']),1)
        self.assertIn('"marQuantidade":7.000',wire)
        self.assertEqual(json.loads(wire,parse_float=Decimal)[0]['listaManifestoResiduos'][0]['marQuantidade'],Decimal('7.000'))

    def test_codigo_preservado_zero_inicial_e_marcador_na_referencia(self):
        c=catalogos_mvp(); self.assertEqual(c['referencia_operador']['registros'],895)
        self.assertEqual(len([r for r in c['residuos'] if r['origem']=='referencia_operador_homologacao']),895)
        self.assertTrue(any('(*)' in r['codigo'] for r in c['residuos']))
        self.assertTrue(any(r['codigo'].startswith('0') for r in c['residuos']))
        self.assertEqual(len([r for r in c['residuos'] if r['origem']=='fixture_fase1a']),2)

    def test_rejeita_campos_ausentes_codigos_invalidos_e_perigosos_sem_condicionais(self):
        for nome,valor in [('marQuantidade','-1'),('marQuantidade','1.0001'),('uniCodigo','1'),('resCodigoIbama','inexistente'),('resCodigoIbama','000002(*)'),('gerador_cnpj','00000000000002')]:
            with self.subTest(campo=nome), self.assertRaises(ErroContratoMTR): construir_payload({**dados_validos(),nome:valor},'Pessoa','ref','00000000000001')
        with self.assertRaises(ErroContratoMTR): construir_payload({},'Pessoa','ref','00000000000001')

    def test_codec_escape_sem_interpolacao_e_sem_float(self):
        texto='"</script>\\\nç'
        self.assertEqual(json.loads(json_wire({'x':texto})),{'x':texto})
        self.assertEqual(json_wire({'n':Decimal('0.001')}),'{"n":0.001}')

    def test_real_sempre_bloqueado_antes_de_rede(self):
        with patch('socket.create_connection',side_effect=AssertionError('sem rede')) as rede:
            with self.assertRaises(PermissionError): TransporteSIGOREscritaBloqueada().enviar(dados_validos(),autorizado=True)
            rede.assert_not_called()


class FluxoMVP(CenarioFretes):
    def setUp(self):
        super().setUp(); cache.clear()
        self.frete=self.contratado(pedido_id=str(self.pedido.pk),quantidade='7.000')
        self.pessoa=get_user_model().objects.create_user(username='operador-mtr',password='SENHA-FICTICIA-MTR',first_name='Operador',last_name='Fictício')
        self.op=OperadorMTR.objects.create(usuario=self.pessoa,empresa=self.vendedora,pode_revisar=True,pode_autorizar=True,evidencia='FICTICIO: somente MOCK')
        self.token=sessao_operador(self.vendedora,'operador-mtr','SENHA-FICTICIA-MTR')['token_operador']
        self.api=self.cliente(self.vendedora)

    def post(self,path,data,key=None,actor=True,client=None):
        headers={'HTTP_IDEMPOTENCY_KEY':str(key or uuid4())}
        if actor: headers['HTTP_X_MTR_ACTOR_TOKEN']=self.token
        return (client or self.api).post('/api/mtr/'+path,data,format='json',**headers)

    def criar(self,key=None):
        r=self.post('rascunhos/',{'frete_id':str(self.frete.pk)},key)
        self.assertEqual(r.status_code,201,r.data)
        return r.data

    def salvar(self,r,dados=None):
        response=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',{'versao':r['versao'],'dados':dados or dados_validos(self.vendedora.cnpj)},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(response.status_code,200,response.data); return response.data

    def aprovado(self):
        r=self.salvar(self.criar())
        result=self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':dict.fromkeys(['participantes','quantidade','classificacao','ciencia_mock'],True)})
        self.assertEqual(result.status_code,201,result.data); return result.data

    def preparado(self,cenario='sucesso'):
        r=self.aprovado()
        response=self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'confirmar_mock':True,'cenario':cenario})
        self.assertEqual(response.status_code,201,response.data); return response.data


class TestesAPIMTRMVP(FluxoMVP,TestCase):
    def test_preflight_permite_cabecalho_individual_sem_alterar_contrato_legado(self):
        r=self.api.options('/api/mtr/rascunhos/',HTTP_ORIGIN='http://127.0.0.1:5173',HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type,idempotency-key,x-mtr-actor-token')
        self.assertEqual(r.status_code,200)
        self.assertIn('x-mtr-actor-token',r['Access-Control-Allow-Headers'])

    def test_leitura_exige_empresa(self):
        self.assertEqual(self.cliente().get('/api/mtr/contexto/').status_code,401)
        self.assertEqual(self.api.get('/api/mtr/contexto/').data['emissao_real_habilitada'],False)

    def test_empresa_nao_gestora_nao_lista_nem_consulta(self):
        for e in [self.compradora,self.transportadora,self.terceira]:
            c=self.cliente(e)
            self.assertEqual(c.get('/api/mtr/operacoes/').data['resultados'],[])
            self.assertEqual(c.get(f'/api/mtr/fretes/{self.frete.pk}/preenchimento/').status_code,404)

    def test_pre_preenchimento_procedencia_sem_financeiro(self):
        r=self.api.get(f'/api/mtr/fretes/{self.frete.pk}/preenchimento/').data
        campos={f['campo']:f for f in r['dados']['campos']}
        self.assertEqual(campos['quantidade_remessa']['valor'],'7.000')
        self.assertEqual(campos['quantidade_remessa']['fonte'],'Frete.quantidade')
        self.assertIsNone(campos['destinador']['valor']); self.assertIsNone(campos['quantidade_expedida']['valor'])
        self.assertNotIn('valor_referencia',str(r)); self.assertNotIn('senha',str(r))

    def test_catalogo_busca_fonte_e_codigos_textuais(self):
        r=self.api.get('/api/mtr/catalogos/?busca=000001')
        self.assertEqual(r.status_code,200); self.assertTrue(r.data['simulado'])
        self.assertEqual(r.data['residuos'][0]['codigo'],'000001')
        self.assertEqual(r.data['referencia_operador']['registros'],895)

    def test_cria_incompleto_sem_inferir_destinador(self):
        r=self.criar(); self.assertEqual(r['dados']['destinador_cnpj'],'')
        v=self.api.get(f'/api/mtr/rascunhos/{r["id"]}/validacao/').data
        self.assertFalse(v['valido_para_mock']); self.assertIn('destinador_unidade',v['pendencias'])

    def test_salva_e_restaura_rascunho(self):
        r=self.salvar(self.criar())
        self.assertEqual(self.api.get(f'/api/mtr/rascunhos/{r["id"]}/').data['dados']['resCodigoIbama'],'000001')
        self.assertTrue(self.api.get(f'/api/mtr/rascunhos/{r["id"]}/validacao/').data['valido_para_mock'])

    def test_idempotencia_criacao_mesma_resposta_sem_duplicidade(self):
        chave=uuid4(); a=self.criar(chave); b=self.criar(chave)
        self.assertEqual(a,b); self.assertEqual(RascunhoMTR.objects.count(),1)
        self.assertEqual(self.api.get(f'/api/mtr/comandos/{chave}/').data['resposta'],a)

    def test_chave_reutilizada_com_outro_conteudo_rejeitada(self):
        chave=uuid4(); self.criar(chave)
        f=self.novo()
        self.assertEqual(self.post('rascunhos/',{'frete_id':str(f.pk)},chave).status_code,409)

    def test_chave_nova_nao_cria_segundo_rascunho(self):
        self.criar(); self.assertEqual(self.post('rascunhos/',{'frete_id':str(self.frete.pk)}).status_code,409)

    def test_sem_chave_nao_escreve(self):
        r=self.api.post('/api/mtr/rascunhos/',{'frete_id':str(self.frete.pk)},format='json')
        self.assertEqual(r.status_code,400); self.assertFalse(RascunhoMTR.objects.exists())

    def test_versao_antiga_nao_sobrescreve(self):
        r=self.criar(); self.salvar(r)
        response=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',{'versao':r['versao'],'dados':{}},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(response.status_code,412)

    def test_empresa_isolada_em_rascunho_comando_intencao(self):
        r=self.preparado(); outra=self.cliente(self.terceira)
        self.assertEqual(outra.get(f'/api/mtr/rascunhos/{r["id"]}/').status_code,404)
        self.assertEqual(outra.get(f'/api/mtr/intencoes/{r["intencao"]["id"]}/').status_code,404)
        recibo=ReciboMTR.objects.first()
        self.assertEqual(outra.get(f'/api/mtr/comandos/{recibo.chave}/').status_code,404)

    def test_empresa_sozinha_nao_aprova(self):
        r=self.salvar(self.criar())
        self.assertEqual(self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':{}},actor=False).status_code,403)

    def test_token_individual_outra_empresa_negado(self):
        r=self.salvar(self.criar())
        self.op.empresa=self.terceira; self.op.save()
        self.assertEqual(self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':{}}).status_code,403)

    def test_revogacao_e_troca_senha_invalidam_sessao(self):
        self.pessoa.set_password('OUTRA-SENHA-FICTICIA'); self.pessoa.save()
        r=self.salvar(self.criar())
        self.assertEqual(self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':{}}).status_code,403)

    def test_pendencias_bloqueiam_revisao(self):
        r=self.criar()
        x=self.post(f'rascunhos/{r["id"]}/revisoes/',{'versao':r['versao'],'confirmacoes':dict.fromkeys(['participantes','quantidade','classificacao','ciencia_mock'],True)})
        self.assertEqual(x.status_code,422); self.assertEqual(RevisaoMTR.objects.count(),0)

    def test_revisao_identidade_snapshot_imutavel(self):
        r=self.aprovado(); rev=RevisaoMTR.objects.get()
        self.assertEqual(rev.snapshot['responsavel']['usuario_id'],self.pessoa.pk)
        with self.assertRaises(Exception): RevisaoMTR.objects.filter(pk=rev.pk).update(resumo='x')
        self.assertEqual(r['estado'],'APROVADO'); self.assertFalse(rev.snapshot['aprovado_ambientalmente'])
        self.assertEqual(rev.snapshot['catalogo']['residuo']['origem'],'fixture_fase1a')
        self.assertEqual(rev.snapshot['catalogo']['referencia_operador']['registros'],895)

    def test_revogacao_entre_autenticacao_e_comando_e_revalidada(self):
        self.op.ativo=False; self.op.save()
        with transaction.atomic(), self.assertRaises(ErroMTR): operador_transacional(self.op,self.vendedora,'pode_autorizar')

    def test_tamper_por_sql_direto_nao_e_aceito_como_revisao_integra(self):
        r=self.aprovado(); rev=RevisaoMTR.objects.get()
        # SQL direto deliberado exclusivamente no banco de testes para provar a deteccao.
        with connection.cursor() as c: c.execute('UPDATE mtr_revisaomtr SET resumo=%s WHERE id=%s',['0'*64,str(rev.pk)])
        x=self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'confirmar_mock':True})
        self.assertEqual(x.status_code,409); self.assertFalse(IntencaoMTR.objects.exists())

    def test_alteracao_apos_revisao_preserva_snapshot_e_exige_revisar(self):
        r=self.aprovado(); old=RevisaoMTR.objects.get().snapshot
        r=self.salvar(r,{**dados_validos(),'marQuantidade':'8.000'})
        self.assertEqual(r['estado'],'RASCUNHO'); self.assertEqual(RevisaoMTR.objects.get().snapshot,old)

    def test_preparacao_referencia_payload_persistente_sem_emissao(self):
        r=self.preparado(); i=IntencaoMTR.objects.get()
        self.assertEqual(i.estado,'PREPARADA'); self.assertEqual(i.quantidade_envios,0)
        self.assertEqual(len(i.referencia),30); self.assertTrue(i.payload['simulado'])
        self.assertNotIn('Authorization',i.payload['json_wire']); self.assertNotIn('gerador',json.loads(i.payload['json_wire'])[0])
        self.assertEqual(r['intencao']['id'],str(i.pk))

    def test_duplo_envio_nova_chave_nao_repete_adapter(self):
        r=self.preparado(); id=r['intencao']['id']
        with patch('mtr.servicos_mvp.criar_integracao_mtr',wraps=__import__('mtr.integracoes',fromlist=['criar_integracao_mtr']).criar_integracao_mtr) as adapter:
            a=self.post(f'intencoes/{id}/enviar/',{})
            b=self.post(f'intencoes/{id}/enviar/',{})
            self.assertEqual(adapter.call_count,1)
        self.assertEqual(a.data,b.data); self.assertEqual(a.data['estado'],'CONFIRMADA_SIMULADA')
        self.assertIsNone(a.data['resultado']['numero_oficial'])

    def test_rejeicao_simulada_persistida(self):
        r=self.preparado('rejeicao'); x=self.post(f'intencoes/{r["intencao"]["id"]}/enviar/',{})
        self.assertEqual(x.data['estado'],'REJEITADA_SIMULADA'); self.assertFalse(x.data['emissao_oficial'])

    def test_timeout_persiste_indeterminado_consulta_nao_libera(self):
        r=self.preparado('timeout'); id=r['intencao']['id']
        x=self.post(f'intencoes/{id}/enviar/',{})
        self.assertEqual(x.data['estado'],'INDETERMINADA')
        y=self.post(f'intencoes/{id}/reconciliacoes/',{})
        self.assertEqual(y.data['estado'],'INDETERMINADA'); self.assertFalse(y.data['reconciliacao']['novo_envio_permitido'])
        self.assertEqual(self.post(f'intencoes/{id}/enviar/',{}).data['quantidade_envios'],1)

    def test_intencao_bloqueia_edicao_e_segunda_referencia(self):
        r=self.preparado('timeout')
        response=self.api.patch(f'/api/mtr/rascunhos/{r["id"]}/',{'versao':r['versao'],'dados':{}},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(response.status_code,409)
        self.assertEqual(self.post(f'rascunhos/{r["id"]}/intencoes/',{'versao':r['versao'],'confirmar_mock':True}).status_code,409)
        self.assertEqual(IntencaoMTR.objects.count(),1)

    def test_fonte_comercial_alterada_bloqueia_envio(self):
        r=self.preparado(); Frete.objects.filter(pk=self.frete.pk).update(quantidade=Decimal('8.000'))
        self.assertEqual(self.post(f'intencoes/{r["intencao"]["id"]}/enviar/',{}).status_code,409)
        self.assertEqual(IntencaoMTR.objects.get().quantidade_envios,0)

    def test_sucesso_nao_altera_frete_pedido_estoque(self):
        antes=(Frete.objects.get(pk=self.frete.pk).situacao,self.produto.quantidade,self.pedido.situacao)
        r=self.preparado(); self.post(f'intencoes/{r["intencao"]["id"]}/enviar/',{})
        self.produto.refresh_from_db(); self.pedido.refresh_from_db()
        self.assertEqual((Frete.objects.get(pk=self.frete.pk).situacao,self.produto.quantidade,self.pedido.situacao),antes)

    def test_campos_e_ambiente_arbitrarios_rejeitados(self):
        self.assertEqual(self.post('rascunhos/',{'frete_id':str(self.frete.pk),'ambiente':'SIGOR_HOMOLOG'}).status_code,400)
        self.assertEqual(self.post('emissao-real/',{'autorizado':True}).status_code,403)

    def test_sessao_sem_nome_ou_vinculo_nao_fabrica_autoria(self):
        self.op.ativo=False; self.op.save()
        x=self.api.post('/api/mtr/sessoes-operador/',{'usuario':'operador-mtr','senha':'SENHA-FICTICIA-MTR'},format='json')
        self.assertEqual(x.status_code,401); self.assertNotIn('token_operador',x.data)


class TesteConcorrenciaMVP(FluxoMVP,TransactionTestCase):
    def test_envios_concorrentes_executam_adapter_uma_vez(self):
        r=self.preparado(); id=r['intencao']['id']; token=gerar_token(self.vendedora)
        def enviar(_):
            try:
                api=APIClient(); api.credentials(HTTP_AUTHORIZATION='Bearer '+token)
                resposta=api.post(f'/api/mtr/intencoes/{id}/enviar/',{},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()),HTTP_X_MTR_ACTOR_TOKEN=self.token)
                return resposta.status_code,resposta.data
            finally: connections.close_all()
        with patch('mtr.servicos_mvp.criar_integracao_mtr',wraps=__import__('mtr.integracoes',fromlist=['criar_integracao_mtr']).criar_integracao_mtr) as adapter:
            with ThreadPoolExecutor(max_workers=2) as pool: respostas=list(pool.map(enviar,range(2)))
            self.assertEqual(adapter.call_count,1)
        self.assertEqual([r[0] for r in respostas],[200,200]); self.assertEqual(respostas[0][1],respostas[1][1])
        self.assertEqual(IntencaoMTR.objects.get().quantidade_envios,1)

    def test_duas_criacoes_concorrentes_mesmo_frete(self):
        token=gerar_token(self.vendedora); frete=str(self.frete.pk)
        def criar(_):
            try:
                api=APIClient(); api.credentials(HTTP_AUTHORIZATION='Bearer '+token)
                r=api.post('/api/mtr/rascunhos/',{'frete_id':frete},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid4()))
                return r.status_code
            finally: connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool: resultados=list(pool.map(criar,range(2)))
        self.assertEqual(sorted(resultados),[201,409]); self.assertEqual(RascunhoMTR.objects.count(),1)
