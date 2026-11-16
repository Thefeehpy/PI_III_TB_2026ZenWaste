"""Contratos simulados e persistencia real; exclusivamente no PostgreSQL descartavel."""
import json
import subprocess
import sys
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
from django.conf import settings
from django.db import connection,connections,transaction,IntegrityError
from django.test import SimpleTestCase,TestCase,TransactionTestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from autenticacao.servicos import gerar_token
from fretes.models import Frete
from mtr.testes.test_mvp import FluxoMVP,dados_validos
from mtr.models import DespachoSIGOR,EventoDespachoSIGOR,VinculoAmbientalSIGOR,RevogacaoVinculoSIGOR,RevisaoAmbientalSIGOR,CapturaCatalogoSIGOR,ReciboMTR
from mtr.servicos_mvp import ErroMTR,executar_comando
from mtr.sigor import ambiental as a,despacho as d
from mtr.sigor.catalogos import normalizar_catalogo,CAMPOS
from mtr.sigor.leitura import ClienteSIGORLeitura,Operacao,RespostaPrivada,ConsultaReferencia,metodo_http,CAMINHOS,TransporteHTTPSHomologacao
from mtr.sigor.privacidade import CredenciaisSIGOR,ErroSeguro,Segredo,json_estrito
from mtr.sigor.protocolo import AdaptadorEmissaoSIGORBloqueado,interpretar_emissao,interpretar_consulta
from mtr.sigor.configuracao import cliente_leitura
from mtr.sigor.simulacao import TransporteDespachoSimulado
from mtr.sigor_contrato import construir_payload,json_wire

SENHA_FICTICIA='SENHA-FICTICIA-NAO-EXISTE-NO-SIGOR'
TOKEN_FICTICIO='TOKEN-FICTICIO-SEM-VALIDADE-GOVERNAMENTAL'

class LeituraSimulada:
    rede_real=False
    def __init__(self,status=200): self.calls=[]; self.status=status
    def enviar(self,req):
        url,metodo,headers,body=req._para_http(); self.calls.append((url,metodo,headers,body))
        if req.operacao==Operacao.AUTENTICAR: data={'erro':False,'objetoResposta':'Bearer '+TOKEN_FICTICIO}
        elif req.operacao==Operacao.CONSULTAR_REFERENCIA: data={'erro':False,'objetoResposta':None}
        else:
            codigo,desc=CAMPOS[req.operacao.value]
            data={'erro':False,'objetoResposta':[{codigo:'000001' if codigo=='resCodigoIbama' else 9001,desc:'FICTICIO'}]}
        return RespostaPrivada(200 if req.operacao==Operacao.AUTENTICAR else self.status,'application/json',json_wire(data).encode())

def credenciais_ficticias(_=None): return CredenciaisSIGOR('11111111111',SENHA_FICTICIA,'99001')

class TestesPortasSIGOR(SimpleTestCase):
    def test_http_emissao_preparado_somente_com_opener_simulado_e_politica_substituida_no_teste(self):
        p=construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001');wire=json_wire(p)
        req=AdaptadorEmissaoSIGORBloqueado().preparar_requisicao(wire,Segredo(TOKEN_FICTICIO))
        resposta=TransporteDespachoSimulado().enviar(wire)._json(); corpo=json_wire(resposta).encode()
        class HTTPFicticio(io.BytesIO):
            status=200;headers={'Content-Type':'application/json'}
            def geturl(self):return 'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest/salvarManifestoLote'
        with patch('mtr.sigor.protocolo.politica_escrita_permite',return_value=True),patch('mtr.sigor.protocolo.urllib.request.build_opener') as factory:
            factory.return_value.open.return_value=HTTPFicticio(corpo)
            r=AdaptadorEmissaoSIGORBloqueado().enviar(req)
            request=factory.return_value.open.call_args.args[0]
            self.assertEqual(request.get_method(),'POST');self.assertEqual(request.data,wire.encode())
            self.assertEqual(request.get_header('Authorization'),'Bearer '+TOKEN_FICTICIO)
            self.assertEqual(interpretar_emissao(r,p).estado,'CONFIRMADA');self.assertEqual(factory.return_value.open.call_count,1)

    def test_timeout_http_sanitizado_sem_retry(self):
        wire=json_wire(construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001'))
        req=AdaptadorEmissaoSIGORBloqueado().preparar_requisicao(wire,Segredo(TOKEN_FICTICIO))
        with patch('mtr.sigor.protocolo.politica_escrita_permite',return_value=True),patch('mtr.sigor.protocolo.urllib.request.build_opener') as factory:
            factory.return_value.open.side_effect=TimeoutError(SENHA_FICTICIA)
            with self.assertRaises(ErroSeguro) as erro:AdaptadorEmissaoSIGORBloqueado().enviar(req)
            self.assertEqual(str(erro.exception),'FALHA_DE_TRANSPORTE');self.assertEqual(factory.return_value.open.call_count,1)

    def test_token_injetado_com_quebra_de_linha_e_rejeitado(self):
        with self.assertRaises(ErroSeguro):AdaptadorEmissaoSIGORBloqueado().preparar_requisicao('[{}]',Segredo('token\r\nInjected: x'))

    def test_metodos_e_rotas_individuais_sem_fallback(self):
        port=LeituraSimulada(); c=ClienteSIGORLeitura(credenciais_ficticias(),port); self.assertTrue(c.autenticar())
        for op in Operacao:
            if op in {Operacao.AUTENTICAR,Operacao.CONSULTAR_REFERENCIA}: continue
            param='000001' if op==Operacao.CLASSES_POR_RESIDUO else '9003' if op==Operacao.ACONDICIONAMENTOS_POR_ESTADO else None
            c.consultar_catalogo(op,parametro=param)
            url,method,h,body=port.calls[-1]
            self.assertEqual(method,'GET' if op==Operacao.CLASSES else 'POST')
            self.assertEqual(url,'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest'+CAMINHOS[op]+('/'+param if param else ''))
            self.assertIsNone(body); self.assertEqual(h['Authorization'],'Bearer '+TOKEN_FICTICIO)
        self.assertEqual(len(port.calls),9)
        self.assertEqual(port.calls[0][1],'POST'); self.assertNotIn('Authorization',port.calls[0][2])
        self.assertEqual(json.loads(port.calls[0][3])['senha'],SENHA_FICTICIA)

    def test_api20_post_body_privado_sem_parametro_em_url(self):
        port=LeituraSimulada(); c=ClienteSIGORLeitura(credenciais_ficticias(),port); c.autenticar()
        c.consultar_referencia(ConsultaReferencia(99001,'ZW-REF-FICTICIA'))
        url,method,h,body=port.calls[-1]
        self.assertTrue(url.endswith('/retornaManifestoSeuCodigo')); self.assertEqual(method,'POST')
        self.assertNotIn('ZW-REF',url); self.assertEqual(json.loads(body),{'suaUnidade':99001,'seuCodigo':'ZW-REF-FICTICIA'})
        with self.assertRaises(ErroSeguro): c.consultar_referencia(ConsultaReferencia(999,'ZW-REF-FICTICIA'))
        self.assertEqual(len(port.calls),2)

    def test_405_sanitizado_nao_tenta_outro_metodo(self):
        port=LeituraSimulada(405); c=ClienteSIGORLeitura(credenciais_ficticias(),port); c.autenticar()
        with self.assertRaises(ErroSeguro) as e: c.consultar_catalogo(Operacao.CLASSES)
        self.assertEqual(e.exception.resumo_publico(),{'categoria':'HTTP_INESPERADO','status_http':405,'etapa':'CONSULTA_CATALOGO','operacao':'classes','metodo_http':'GET'})
        self.assertEqual(len(port.calls),2); self.assertNotIn(SENHA_FICTICIA,str(e.exception))

    def test_catalogo_projeta_so_codigo_descricao_e_preserva_texto(self):
        self.assertEqual(normalizar_catalogo('residuos',[{'resCodigoIbama':'010101(*)','resDescricao':'FICTICIO','financeiro':'nao copiar'}]),[{'codigo':'010101(*)','descricao':'FICTICIO'}])
        for itens in [[{'resCodigoIbama':10101,'resDescricao':'X'}],[{'resCodigoIbama':'000001','resDescricao':'X'}]*2]:
            with self.assertRaises(ErroSeguro): normalizar_catalogo('residuos',itens)

    def test_segredos_repr_json_duplicado_e_decimal(self):
        for value in [credenciais_ficticias(),Segredo(SENHA_FICTICIA)]: self.assertNotIn(SENHA_FICTICIA,repr(value))
        with self.assertRaises(ValueError): json_estrito('{"a":1,"a":2}')
        self.assertEqual(json_estrito('{"n":0.001}')['n'],Decimal('0.001'))

    def test_transporte_real_escrita_incondicionalmente_bloqueado(self):
        p=construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001'); wire=json_wire(p)
        port=AdaptadorEmissaoSIGORBloqueado(); req=port.preparar_requisicao(wire,Segredo(TOKEN_FICTICIO))
        url,method,headers,body=req._para_http()
        self.assertEqual(method,'POST'); self.assertTrue(url.endswith('/salvarManifestoLote')); self.assertEqual(body,wire.encode())
        self.assertEqual(headers['Authorization'],'Bearer '+TOKEN_FICTICIO); self.assertNotIn(TOKEN_FICTICIO,repr(req))
        with patch('socket.create_connection',side_effect=AssertionError('rede proibida')) as rede:
            with self.assertRaises(PermissionError): port.enviar(req,autorizado=True)
            rede.assert_not_called()

    def test_rede_leitura_precisa_de_autorizacao(self):
        with self.assertRaises(ErroSeguro): TransporteHTTPSHomologacao()

    def test_parsers_api10_por_manifesto_item_participante(self):
        p=construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001'); wire=json_wire(p)
        for cenario,estado in [('sucesso','CONFIRMADA'),('rejeicao','REJEITADA'),('malformada','INDETERMINADA'),('participante_invalido','INDETERMINADA'),('parcial','INDETERMINADA')]:
            with self.subTest(cenario=cenario): self.assertEqual(interpretar_emissao(TransporteDespachoSimulado(cenario).enviar(wire),p).estado,estado)

    def test_numero_sem_validacao_ou_retorno_catalogo_nao_confirma(self):
        p=construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001'); wire=json_wire(p)
        for alterar in ['nacional','participante','quantidade','codigo','validacao','lote','erroNacional']:
            raw=TransporteDespachoSimulado().enviar(wire)._json(); m=raw['respostaApiwsManifestoDTO'][0]
            if alterar=='nacional': m['manifestoNumeroNacional']=None
            elif alterar=='participante': m['transportador']['restResponseValido']=False
            elif alterar=='quantidade': m['listaManifestoResiduos'][0]['marQuantidade']=Decimal('8')
            elif alterar=='codigo': m['listaManifestoResiduos'][0]['resCodigoIbama']='000002'
            elif alterar=='validacao': del m['restResponseValido']
            elif alterar=='lote': raw['respostaApiwsManifestoDTO']*=2
            else: raw['erroNacional']=True
            r=RespostaPrivada(200,'application/json',json_wire(raw).encode())
            with self.subTest(alterar=alterar): self.assertEqual(interpretar_emissao(r,p).estado,'INDETERMINADA')

    def test_consulta_vazia_erro_e_participante_divergente_sao_inconclusivos(self):
        p=construir_payload(dados_validos(),'Pessoa FICTICIA','ZW-FICTICIO','00000000000001'); wire=json_wire(p)
        g={'cpf_cnpj':'00000000000001','unidade':99001}; consulta=ConsultaReferencia(99001,'ZW-FICTICIO')
        for dado in [None,[],{}, {'manNumero':'999999999999'}]:
            r=RespostaPrivada(200,'application/json',json_wire({'erro':False,'objetoResposta':dado}).encode())
            self.assertEqual(interpretar_consulta(r,p,g).estado,'INDETERMINADA')
        r=TransporteDespachoSimulado().consultar(wire,consulta,g);self.assertEqual(interpretar_consulta(r,p,g).estado,'CONFIRMADA')
        raw=r._json();raw['objetoResposta']['parceiroGerador']['parCodigo']=123
        self.assertEqual(interpretar_consulta(RespostaPrivada(200,'application/json',json_wire(raw).encode()),p,g).estado,'INDETERMINADA')


class FluxoSIGOR(FluxoMVP):
    def setUp(self):
        super().setUp();self.r=self.salvar(self.criar());self.vinculos={}
        for papel,prefixo in [('GERADOR','gerador'),('TRANSPORTADOR','transportador'),('DESTINADOR','destinador')]:
            x=self.post('sigor/vinculos/',{'papel':papel,'cpf_cnpj':self.r['dados'][prefixo+'_cnpj'],'unidade':int(self.r['dados'][prefixo+'_unidade']),'simulado':True,'evidencia_sha256':'e'*64,'confirmar_habilitacao':True})
            self.assertEqual(x.status_code,201,x.data);self.vinculos[papel]=x.data['id']
        self.capturas={}
        for nome,campo,code in [('residuos','resCodigoIbama','000001'),('unidades-medida','uniCodigo',9001),('tratamentos','traCodigo',9002),('estados-fisicos','tieCodigo',9003),('acondicionamentos','tiaCodigo',9004),('classes','claCodigo',9005),('classes-por-residuo','claCodigo',9005),('acondicionamentos-por-estado','tiaCodigo',9004)]:
            _,desc=CAMPOS[nome]
            c=a.capturar(self.vendedora,nome,[{campo:code,desc:'FICTICIO'}],parametro='000001' if nome=='classes-por-residuo' else '9003' if nome=='acondicionamentos-por-estado' else '',simulado=True,origem='SIMULACAO',metodo='GET' if nome=='classes' else 'POST')
            self.capturas[nome]=str(c.pk)

    def revisao(self,**alteracoes):
        entrada={'versao':self.r['versao'],'vinculos':self.vinculos,'catalogos':self.capturas,'confirmacoes':dict.fromkeys(a.CONFIRMACOES,True),**alteracoes}
        return self.post(f'sigor/rascunhos/{self.r["id"]}/revisoes/',entrada)

    def preparado_sig(self,modo='SIMULACAO'):
        rev=self.revisao();self.assertEqual(rev.status_code,201,rev.data)
        response=self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',{'revisao_id':rev.data['id'],'modo':modo,'confirmar_preparacao':True})
        self.assertEqual(response.status_code,201,response.data)
        return DespachoSIGOR.objects.select_related('operador__usuario').get(pk=response.data['id'])


class TestesAmbientaisSIGOR(FluxoSIGOR,TestCase):
    def test_transportador_ambiental_diferente_do_frete_bloqueia_revisao(self):
        self.r=self.salvar(self.r,{**self.r['dados'],'transportador_cnpj':self.concorrente.cnpj})
        v=self.post('sigor/vinculos/',{'papel':'TRANSPORTADOR','cpf_cnpj':self.concorrente.cnpj,'unidade':99002,'simulado':True,'evidencia_sha256':'e'*64,'confirmar_habilitacao':True})
        self.assertEqual(v.status_code,201,v.data);self.vinculos['TRANSPORTADOR']=v.data['id']
        antes=Frete.objects.get(pk=self.frete.pk).transportadora_id
        x=self.revisao()
        self.assertEqual(x.status_code,422,x.data);self.assertEqual(x.data['codigo'],'TRANSPORTADOR_DIVERGENTE_FRETE')
        self.assertFalse(RevisaoAmbientalSIGOR.objects.exists());self.assertFalse(DespachoSIGOR.objects.exists())
        self.assertEqual(Frete.objects.get(pk=self.frete.pk).transportadora_id,antes)

    def test_frete_sem_transportadora_nao_aprova_transportador_declarado(self):
        # Estado deliberadamente incompleto, exclusivamente no banco de teste.
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=None)
        x=self.revisao()
        self.assertEqual(x.status_code,422,x.data);self.assertEqual(x.data['codigo'],'TRANSPORTADORA_NAO_DEFINIDA')
        self.assertFalse(RevisaoAmbientalSIGOR.objects.exists())

    def test_mesmo_cnpj_com_mascara_preserva_zeros_e_permite_revisao(self):
        self.r=self.salvar(self.r,{**self.r['dados'],'transportador_cnpj':'00.000.000/0000-03'})
        x=self.revisao();self.assertEqual(x.status_code,201,x.data)
        rev=RevisaoAmbientalSIGOR.objects.get(pk=x.data['id'])
        self.assertEqual(rev.snapshot['dados']['transportador_cnpj'],'00.000.000/0000-03')
        self.assertEqual(rev.snapshot['vinculos']['TRANSPORTADOR']['cpf_cnpj'],self.transportadora.cnpj)

    def test_troca_transportadora_depois_revisao_bloqueia_preparacao(self):
        rev=self.revisao();self.assertEqual(rev.status_code,201,rev.data)
        snapshot=RevisaoAmbientalSIGOR.objects.get(pk=rev.data['id']).snapshot
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.concorrente)
        x=self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',{'revisao_id':rev.data['id'],'modo':'SIMULACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,422,x.data);self.assertEqual(x.data['codigo'],'TRANSPORTADOR_DIVERGENTE_FRETE')
        self.assertFalse(DespachoSIGOR.objects.exists())
        self.assertEqual(RevisaoAmbientalSIGOR.objects.get(pk=rev.data['id']).snapshot,snapshot)

    def test_vinculos_independentes_da_compradora_sem_senha(self):
        dest=VinculoAmbientalSIGOR.objects.get(pk=self.vinculos['DESTINADOR'])
        self.assertNotEqual(dest.cpf_cnpj,self.compradora.cnpj);self.assertEqual(dest.cpf_cnpj,'00000000000009')
        resposta=self.api.get('/api/mtr/sigor/vinculos/').data
        self.assertNotIn('senha',str(resposta));self.assertFalse(resposta['resultados'][0]['validacao_governamental_automatica'])

    def test_vinculos_outra_empresa_negados_e_empresa_sozinha_nao_declara(self):
        entrada={'papel':'GERADOR','cpf_cnpj':self.vendedora.cnpj,'unidade':99001,'simulado':True,'evidencia_sha256':'e'*64,'confirmar_habilitacao':True}
        self.assertEqual(self.post('sigor/vinculos/',entrada,actor=False).status_code,403)
        self.assertEqual(self.cliente(self.terceira).get('/api/mtr/sigor/vinculos/').data['resultados'],[])

    def test_vinculo_gerador_diferente_bloqueado(self):
        entrada={'papel':'GERADOR','cpf_cnpj':self.compradora.cnpj,'unidade':99001,'simulado':True,'evidencia_sha256':'e'*64,'confirmar_habilitacao':True}
        self.assertEqual(self.post('sigor/vinculos/',entrada).status_code,422)

    def test_referencia_895_sem_promover_classificacao(self):
        x=self.post('sigor/catalogos/referencia-operador/',{})
        self.assertEqual(x.status_code,201,x.data);self.assertEqual(len(x.data['itens']),895)
        self.assertEqual(x.data['origem'],'OPERADOR_REFERENCIA');self.assertFalse(x.data['classificacao_ambiental_aprovada'])
        self.assertIsNone(x.data['metodo_http']);self.assertEqual(x.data['fonte_sha256'],'bb2d364e39bc4f59b6ee3618a77ad457ce3550cfd3b2897840604c98cc3c1da4')

    def test_revisao_requer_confirmacoes_e_compativeis(self):
        self.assertEqual(self.revisao(confirmacoes={}).status_code,422)
        c=CapturaCatalogoSIGOR.objects.get(pk=self.capturas['classes-por-residuo'])
        fake=a.capturar(self.vendedora,c.operacao,[{'claCodigo':999,'claDescricao':'FICTICIO'}],parametro='000001',simulado=True,origem='SIMULACAO',metodo='POST')
        self.assertEqual(self.revisao(catalogos={**self.capturas,'classes-por-residuo':str(fake.pk)}).status_code,422)

    def test_relacao_de_outro_estado_nao_e_aceita(self):
        fake=a.capturar(self.vendedora,'acondicionamentos-por-estado',[{'tiaCodigo':9004,'tiaDescricao':'FICTICIO'}],parametro='999',simulado=True,origem='SIMULACAO',metodo='POST')
        self.assertEqual(self.revisao(catalogos={**self.capturas,'acondicionamentos-por-estado':str(fake.pk)}).status_code,422)

    def test_revogacao_antes_de_revisar_e_de_preparar(self):
        r=self.revisao();self.assertEqual(r.status_code,201)
        self.assertEqual(self.post(f'sigor/vinculos/{self.vinculos["GERADOR"]}/revogacao/',{}).status_code,200)
        self.assertEqual(self.revisao().status_code,409)
        self.assertEqual(self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',{'revisao_id':r.data['id'],'modo':'SIMULACAO','confirmar_preparacao':True}).status_code,409)

    def test_fixture_nao_pode_virar_intencao_homologacao(self):
        rev=self.revisao();self.assertEqual(rev.status_code,201)
        x=self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',{'revisao_id':rev.data['id'],'modo':'HOMOLOGACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,422);self.assertFalse(DespachoSIGOR.objects.exists())

    def test_snapshot_payload_e_intencao_antes_de_envio(self):
        desp=self.preparado_sig();self.assertEqual(desp.tentativas,0);self.assertEqual(desp.estado,'PREPARADA')
        self.assertEqual(len(desp.referencia),30);self.assertNotIn('gerador',json.loads(desp.payload_wire)[0])
        self.assertNotIn('Authorization',desp.payload_wire);self.assertTrue(desp.simulado)
        s=desp.revisao.snapshot;self.assertEqual(s['responsavel']['usuario_id'],self.pessoa.pk)
        self.assertEqual(len(s['catalogo_validacao']['residuos']),1)
        self.assertNotIn('itens',s['catalogos']['residuos'])

    def test_segunda_intencao_proibida_e_idor_revisao(self):
        desp=self.preparado_sig()
        self.assertEqual(self.revisao().status_code,409)
        outra=self.cliente(self.terceira);c=self.capturas['residuos']
        self.assertEqual(outra.get(f'/api/mtr/sigor/capturas/{c}/').status_code,404)
        self.assertEqual(outra.get(f'/api/mtr/sigor/despachos/{desp.pk}/').status_code,404)

    def test_mudanca_do_rascunho_exige_nova_revisao(self):
        rev=self.revisao();self.r=self.salvar(self.r,{**dados_validos(),'marQuantidade':'8.000'})
        x=self.post(f'sigor/rascunhos/{self.r["id"]}/preparacoes/',{'revisao_id':rev.data['id'],'modo':'SIMULACAO','confirmar_preparacao':True})
        self.assertEqual(x.status_code,409)

    def test_leitura_bloqueada_antes_de_buscar_credencial(self):
        with patch('mtr.sigor.configuracao.provedor_ambiente',side_effect=AssertionError('Nao ler segredo')) as loader:
            x=self.post('sigor/leituras/classes/',{'vinculo_id':self.vinculos['GERADOR']})
            self.assertEqual(x.status_code,503);loader.assert_not_called()

    def test_leitura_integrada_autentica_sem_revelar_token(self):
        port=LeituraSimulada()
        cfg={str(self.vendedora.pk):{'unidade':99001,'gerador_cnpj':self.vendedora.cnpj,'credencial_ref':'FICTICIO','operador_id':self.op.pk}}
        with override_settings(MTR_SIGOR_CONTAS=cfg,MTR_SIGOR_OPERACOES_LEITURA=['autenticar','classes'],MTR_SIGOR_PROVEDOR_CREDENCIAL=credenciais_ficticias,MTR_SIGOR_TRANSPORTE_LEITURA=lambda:port):
            x=self.post('sigor/leituras/autenticar/',{'vinculo_id':self.vinculos['GERADOR']});self.assertEqual(x.status_code,200,x.data)
            self.assertFalse(x.data['habilitacao_comprovada'])
            y=self.post('sigor/leituras/classes/',{'vinculo_id':self.vinculos['GERADOR']});self.assertEqual(y.status_code,200,y.data)
            self.assertTrue(y.data['simulado']);self.assertEqual(y.data['metodo_http'],'GET')
        for secret in [TOKEN_FICTICIO,SENHA_FICTICIA,'11111111111']:
            self.assertNotIn(secret,str(x.data)+str(y.data)+str(list(ReciboMTR.objects.values('resposta'))))

    def test_conta_unidade_ou_tenant_errados_nao_usam_transporte(self):
        port=LeituraSimulada();cfg={str(self.vendedora.pk):{'unidade':999,'gerador_cnpj':self.vendedora.cnpj,'credencial_ref':'FICTICIO','operador_id':self.op.pk}}
        with override_settings(MTR_SIGOR_CONTAS=cfg,MTR_SIGOR_OPERACOES_LEITURA=['classes'],MTR_SIGOR_PROVEDOR_CREDENCIAL=credenciais_ficticias,MTR_SIGOR_TRANSPORTE_LEITURA=lambda:port):
            x=self.post('sigor/leituras/classes/',{'vinculo_id':self.vinculos['GERADOR']});self.assertEqual(x.status_code,503)
        self.assertEqual(port.calls,[])

    def test_parametros_rotas_arbitrarias_e_campos_secretos_negados(self):
        for caminho,body in [('sigor/leituras/cancelarManifesto/',{'vinculo_id':self.vinculos['GERADOR']}),('sigor/leituras/classes/',{'vinculo_id':self.vinculos['GERADOR'],'url':'https://invalid.example'}),('sigor/leituras/classes/',{'vinculo_id':self.vinculos['GERADOR'],'senha':'NAO-ACEITAR'})]:
            self.assertEqual(self.post(caminho,body).status_code,400)


class TestesDurabilidadeSIGOR(FluxoSIGOR,TransactionTestCase):
    def test_troca_transportadora_apos_preparacao_bloqueia_antes_claim(self):
        desp=self.preparado_sig()
        Frete.objects.filter(pk=self.frete.pk).update(transportadora=self.concorrente)
        port=TransporteDespachoSimulado()
        with patch.object(port,'enviar',side_effect=AssertionError('Nao enviar com transportadora divergente')) as enviar:
            with self.assertRaises(ErroMTR) as erro:self.executar(desp,port=port)
            self.assertEqual(erro.exception.status_code,422);enviar.assert_not_called()
        desp.refresh_from_db();self.assertEqual(desp.estado,'PREPARADA');self.assertEqual(desp.tentativas,0)

    def executar(self,desp,cenario='sucesso',key=None,port=None):
        return d.despachar_simulado(self.vendedora,desp.pk,self.op,key or uuid4(),cenario,transporte=port)

    def test_transporte_fora_sql_claim_visivel_em_outra_conexao(self):
        desp=self.preparado_sig();outer=self
        class Verifica(TransporteDespachoSimulado):
            def enviar(self,wire):
                outer.assertFalse(connection.in_atomic_block)
                def consultar():
                    try: return DespachoSIGOR.objects.get(pk=desp.pk).estado
                    finally: connections.close_all()
                with ThreadPoolExecutor(1) as pool: outer.assertEqual(pool.submit(consultar).result(),'EM_DESPACHO')
                return super().enviar(wire)
        self.executar(desp,port=Verifica());desp.refresh_from_db();self.assertEqual(desp.estado,'CONFIRMADA')

    def test_recibo_e_resposta_perdida_nao_repetem_post(self):
        desp=self.preparado_sig();key=uuid4();port=TransporteDespachoSimulado()
        with patch.object(port,'enviar',wraps=port.enviar) as enviar:
            a1=self.executar(desp,key=key,port=port);a2=self.executar(desp,key=key,port=port);a3=self.executar(desp,port=port)
            self.assertEqual(enviar.call_count,1)
        self.assertEqual(a1,a2);self.assertEqual(a2,a3)
        self.assertEqual(ReciboMTR.objects.get(chave=key).status_http,202)

    def test_timeout_preserva_intencao_e_tentativa(self):
        desp=self.preparado_sig();self.executar(desp,'timeout');desp.refresh_from_db()
        self.assertEqual(desp.estado,'INDETERMINADA');self.assertEqual(desp.tentativas,1)
        self.executar(desp);desp.refresh_from_db();self.assertEqual(desp.estado,'INDETERMINADA')
        self.assertEqual(DespachoSIGOR.objects.count(),1)

    def test_rejeicao_persistida_com_participantes_e_item(self):
        desp=self.preparado_sig();self.executar(desp,'rejeicao');desp.refresh_from_db()
        self.assertEqual(desp.estado,'REJEITADA');self.assertFalse(desp.resultado['validacoes']['manifesto'])
        self.assertFalse(desp.resultado['validacoes']['item'])

    def test_falha_ao_persistir_resultado_nao_apaga_claim(self):
        desp=self.preparado_sig()
        with patch('mtr.sigor.despacho._finalizar',side_effect=RuntimeError('FALHA-FICTICIA-COMMIT')):
            with self.assertRaises(RuntimeError): self.executar(desp)
        desp.refresh_from_db();self.assertEqual(desp.estado,'EM_DESPACHO');self.assertEqual(desp.tentativas,1)
        DespachoSIGOR.objects.filter(pk=desp.pk).update(limite_trabalhador=timezone.now()-timedelta(seconds=1))
        d.recuperar_interrompido(self.vendedora,desp.pk);desp.refresh_from_db();self.assertEqual(desp.estado,'INDETERMINADA')

    def test_queda_real_de_processo_apos_possivel_envio(self):
        from mtr.testes.processo_interrompido import executar
        self.assertTrue(connection.settings_dict['NAME'].startswith('test_zenwaste_fretes_'))
        desp=self.preparado_sig()
        p=executar(desp.pk,self.vendedora.pk,self.op.pk)
        self.assertEqual(p.returncode,73,p.stderr.decode(errors='replace'))
        desp.refresh_from_db();self.assertEqual(desp.estado,'EM_DESPACHO');self.assertEqual(desp.tentativas,1)
        DespachoSIGOR.objects.filter(pk=desp.pk).update(limite_trabalhador=timezone.now()-timedelta(seconds=1))
        self.assertEqual(d.recuperar_interrompido(self.vendedora,desp.pk)['estado'],'INDETERMINADA')

    def test_consulta_vazia_nao_libera_e_correspondencia_resolve_so_mesma_intencao(self):
        desp=self.preparado_sig();self.executar(desp,'timeout')
        class Vazia(TransporteDespachoSimulado):
            def consultar(self,*args):return RespostaPrivada(200,'application/json',b'{"erro":false,"objetoResposta":null}')
        self.assertEqual(d.reconciliar(self.vendedora,desp.pk,self.op,transporte=Vazia())['estado'],'INDETERMINADA')
        self.assertEqual(d.reconciliar(self.vendedora,desp.pk,self.op)['estado'],'CONFIRMADA')
        desp.refresh_from_db();self.assertEqual(desp.tentativas,1);self.assertEqual(DespachoSIGOR.objects.count(),1)

    def test_reconciliacao_falha_ou_incompativel_nao_promove_sucesso(self):
        desp=self.preparado_sig();self.executar(desp,'timeout')
        class Falha(TransporteDespachoSimulado):
            def consultar(self,*args):raise TimeoutError('SIMULADO')
        self.assertEqual(d.reconciliar(self.vendedora,desp.pk,self.op,transporte=Falha())['estado'],'INDETERMINADA')

    def test_worker_ativo_nao_e_recuperado_nem_consultado(self):
        desp=self.preparado_sig()
        with patch('mtr.sigor.despacho._finalizar',side_effect=RuntimeError('SIMULADO')):
            with self.assertRaises(RuntimeError):self.executar(desp)
        self.assertEqual(d.recuperar_interrompido(self.vendedora,desp.pk)['estado'],'EM_DESPACHO')
        with self.assertRaises(ErroMTR):d.reconciliar(self.vendedora,desp.pk,self.op)

    def test_dois_workers_concorrentes_apenas_um_transporte(self):
        desp=self.preparado_sig();port=TransporteDespachoSimulado()
        def worker(_):
            try:return self.executar(desp,port=port)
            finally:connections.close_all()
        with patch.object(port,'enviar',wraps=port.enviar) as enviar:
            with ThreadPoolExecutor(2) as pool:r=list(pool.map(worker,range(2)))
            self.assertEqual(enviar.call_count,1)
        self.assertEqual(r[0],r[1]);desp.refresh_from_db();self.assertEqual(desp.tentativas,1)

    def test_revogacao_permissao_e_participante_bloqueiam_antes_claim(self):
        desp=self.preparado_sig();self.op.pode_autorizar=False;self.op.save()
        with self.assertRaises(ErroMTR):self.executar(desp)
        self.op.pode_autorizar=True;self.op.save()
        self.post(f'sigor/vinculos/{self.vinculos["DESTINADOR"]}/revogacao/',{})
        with self.assertRaises(ErroMTR):self.executar(desp)
        desp.refresh_from_db();self.assertEqual(desp.tentativas,0)

    def test_proibe_transporte_sob_transacao_externa(self):
        desp=self.preparado_sig()
        with transaction.atomic(),self.assertRaises(ErroMTR):self.executar(desp)
        desp.refresh_from_db();self.assertEqual(desp.tentativas,0)

    def test_tamper_de_snapshot_e_payload_bloqueia(self):
        desp=self.preparado_sig();DespachoSIGOR.objects.filter(pk=desp.pk).update(payload_wire='[]')
        with self.assertRaises(ErroMTR):self.executar(desp)
        desp.refresh_from_db();self.assertEqual(desp.tentativas,0)

    def test_api_simulacao_retorna_202_e_consulta_estado_sem_numero_oficial(self):
        desp=self.preparado_sig()
        x=self.post(f'sigor/despachos/{desp.pk}/executar-simulacao/',{'cenario':'sucesso'})
        self.assertEqual(x.status_code,202,x.data)
        y=self.api.get(x.data['status_url']);self.assertEqual(y.status_code,200,y.data)
        self.assertEqual(y.data['estado'],'CONFIRMADA');self.assertTrue(y.data['simulado']);self.assertIsNone(y.data['numero_oficial'])

    def test_constraints_uma_tentativa_e_um_despacho(self):
        desp=self.preparado_sig()
        with self.assertRaises(IntegrityError),transaction.atomic():DespachoSIGOR.objects.filter(pk=desp.pk).update(tentativas=2)
        with self.assertRaises(IntegrityError),transaction.atomic():DespachoSIGOR.objects.filter(pk=desp.pk).update(estado='CONFIRMADA')

    def test_recusa_real_mesmo_se_simulado_for_alterado_no_banco_de_teste(self):
        desp=self.preparado_sig();DespachoSIGOR.objects.filter(pk=desp.pk).update(simulado=False)
        with self.assertRaises(ErroMTR) as erro:self.executar(desp)
        self.assertEqual(erro.exception.status_code,403)
        desp.refresh_from_db();self.assertEqual(desp.tentativas,0)
