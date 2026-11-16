from io import StringIO
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase,override_settings
from rest_framework.test import APIClient
from empresas.models import Empresa
from mtr.models import OperadorMTR,RascunhoMTR
from mtr.servicos_mvp import ErroMTR
from mtr.sigor import preparacao as p
from mtr.sigor_contrato import identificador
from mtr.vinculacao_individual import conferir_identidades,vincular_sem_permissoes

CNPJ='11222333000181'  # Identidade sintética exclusivamente no banco de testes.
EMAIL='cadastro-individual@example.test'
NOME='Pessoa Ficticia de Teste'
SENHA='SENHA-FICTICIA-DE-TESTE-2026'


class TestesVinculacaoIndividual(TestCase):
    def empresa(self,cnpj=CNPJ):
        return Empresa.objects.create(razao_social='EMPRESA FICTICIA',cnpj=cnpj,email=EMAIL,telefone_whatsapp='11000000005',senha='')

    def vincular(self,**kw):
        return vincular_sem_permissoes(EMAIL,CNPJ,'pessoa-ficticia',NOME,SENHA,**kw)

    def test_registro_existente_valida_campos_e_preserva_documento_com_mascara(self):
        api=APIClient();dados={'razaoSocial':'EMPRESA FICTICIA','cnpj':'11.222.333/0001-81','email':EMAIL,'segmento':'TESTE','password':SENHA}
        self.assertEqual(api.post('/api/auth/register/',dados,format='json').status_code,400)
        self.assertFalse(Empresa.objects.exists())
        dados['telefone']='11000000005'
        r=api.post('/api/auth/register/',dados,format='json');self.assertEqual(r.status_code,201,r.data)
        e=Empresa.objects.get(email=EMAIL);self.assertEqual(identificador(e.cnpj),CNPJ)
        self.assertEqual(api.post('/api/auth/register/',dados,format='json').status_code,400)
        self.assertEqual(Empresa.objects.count(),1)
        v={'formato':p.FORMATO,'empresa_email':EMAIL,'cnpj_informado':CNPJ,'unidade':99001,'responsavel_usuario':None,'responsavel_nome':None,
           'credencial_ref':'FICTICIO','executor_ref':'TESTE','evidencia_representacao_sha256':None,'evidencia_ambiental_sha256':None,
           'representacao_confirmada':False,'ambiental_confirmada':False}
        self.assertNotIn('CNPJ_CADASTRAL_DIVERGENTE',p.pendencias(e,v,None))

    def test_empresa_ausente_ou_cnpj_divergente_nao_cria_usuario(self):
        with self.assertRaises(ErroMTR):self.vincular(nova_pessoa_esperada=True)
        e=self.empresa();e.cnpj='11444777000161';e.save()
        with self.assertRaises(ErroMTR):self.vincular(nova_pessoa_esperada=True)
        self.assertFalse(get_user_model().objects.exists());self.assertFalse(OperadorMTR.objects.exists())

    def test_inspecao_encontra_usuario_mesmo_sem_empresa_e_nao_vincula(self):
        u=get_user_model().objects.create_user(username='pessoa-ficticia',first_name=NOME,password=SENHA)
        r=p.inspecionar(EMAIL,'pessoa-ficticia')
        self.assertTrue(r['usuario_existe']);self.assertEqual(r['usuario_id'],u.pk)
        self.assertFalse(r['empresa_encontrada']);self.assertIsNone(r['vinculo_operador_id'])
        self.assertFalse(OperadorMTR.objects.exists())

    def test_cadastro_e_vinculo_ficam_sem_permissoes_ambientais(self):
        e=self.empresa();r=self.vincular(nova_pessoa_esperada=True)
        self.assertEqual(r['empresa_id'],e.pk);self.assertTrue(r['usuario_criado']);self.assertTrue(r['vinculo_criado'])
        u=get_user_model().objects.get(username='pessoa-ficticia');self.assertTrue(u.check_password(SENHA))
        self.assertNotEqual(u.password,SENHA);self.assertNotIn('password',r)
        op=OperadorMTR.objects.get();self.assertFalse(op.pode_revisar or op.pode_autorizar or op.verificado_homologacao)
        self.assertFalse(RascunhoMTR.objects.exists())

    def test_usuario_existente_nome_ou_senha_divergentes_nao_recebe_vinculo(self):
        self.empresa();u=get_user_model().objects.create_user(username='pessoa-ficticia',first_name='Outro Nome',password=SENHA)
        with self.assertRaises(ErroMTR):self.vincular(nova_pessoa_esperada=False)
        u.first_name=NOME;u.save()
        with self.assertRaises(ErroMTR):vincular_sem_permissoes(EMAIL,CNPJ,u.username,NOME,'SENHA-ERRADA',nova_pessoa_esperada=False)
        self.assertFalse(OperadorMTR.objects.exists());self.assertTrue(get_user_model().objects.get().check_password(SENHA))

    def test_reexecucao_preserva_usuario_senha_vinculo_e_permissoes_preexistentes(self):
        self.empresa();a=self.vincular(nova_pessoa_esperada=True)
        op=OperadorMTR.objects.get();op.pode_revisar=True;op.save()
        hash_senha=get_user_model().objects.get().password
        b=self.vincular(nova_pessoa_esperada=False)
        self.assertEqual(a['operador_id'],b['operador_id']);self.assertFalse(b['vinculo_criado'])
        self.assertTrue(b['permissoes']['pode_revisar']);self.assertFalse(b['permissoes']['pode_autorizar'])
        self.assertFalse(b['permissoes']['verificado_homologacao']);self.assertEqual(get_user_model().objects.get().password,hash_senha)

    def test_usuario_criado_concorrentemente_nao_e_redefinido(self):
        self.empresa();get_user_model().objects.create_user(username='pessoa-ficticia',first_name=NOME,password=SENHA)
        with self.assertRaises(ErroMTR):self.vincular(nova_pessoa_esperada=True)
        self.assertFalse(OperadorMTR.objects.exists())

    def test_comando_nao_interativo_nao_solicita_senha_ou_escreve(self):
        with patch('mtr.management.commands.mtr_vincular_operador.sys.stdin.isatty',return_value=False),patch('mtr.management.commands.mtr_vincular_operador.getpass') as senha:
            with self.assertRaises(CommandError):call_command('mtr_vincular_operador',email=EMAIL,cnpj=CNPJ,usuario='pessoa-ficticia',nome=NOME,stdout=StringIO())
            senha.assert_not_called()
        self.assertFalse(get_user_model().objects.exists())

    def test_comando_com_confirmacao_pessoal_usa_Django_sem_conceder_poderes(self):
        self.empresa()
        with patch('mtr.management.commands.mtr_vincular_operador.sys.stdin.isatty',return_value=True),patch('mtr.management.commands.mtr_vincular_operador.exigir_ambiente_mtr05'),patch('mtr.management.commands.mtr_vincular_operador.getpass',side_effect=[SENHA,SENHA]),patch('builtins.input',return_value='VINCULAR pessoa-ficticia'):
            out=StringIO();call_command('mtr_vincular_operador',email=EMAIL,cnpj=CNPJ,usuario='pessoa-ficticia',nome=NOME,stdout=out)
        self.assertNotIn(SENHA,out.getvalue());self.assertFalse(OperadorMTR.objects.get().verificado_homologacao)

    def test_cnpj_com_mascara_compativel_com_vinculo_ambiental_configuracao_e_DTO(self):
        from mtr.sigor.ambiental import registrar_vinculo
        from mtr.sigor.configuracao import conta_da_empresa
        from mtr.operacional import conferir_contexto,detalhe
        from mtr.models import VinculoAmbientalSIGOR
        e=self.empresa('11.222.333/0001-81')
        self.vincular(nova_pessoa_esperada=True)
        op=OperadorMTR.objects.select_related('usuario').get()
        # Permissão fictícia exclusivamente para testar o domínio ambiental no banco de teste.
        op.pode_revisar=True;op.save()
        resultado,_=registrar_vinculo(e,{'papel':'GERADOR','cpf_cnpj':CNPJ,'unidade':99001,'simulado':True,'confirmar_habilitacao':True,'evidencia_sha256':'a'*64},op)
        vinculo=VinculoAmbientalSIGOR.objects.get(pk=resultado['id'])
        with override_settings(MTR_SIGOR_CONTAS={str(e.pk):{'unidade':99001,'gerador_cnpj':CNPJ,'credencial_ref':'FICTICIO','operador_id':op.pk}}):
            self.assertEqual(conta_da_empresa(e,vinculo,op).gerador_cnpj,CNPJ)
        dados={**{papel+'_cnpj':CNPJ for papel in ['gerador','transportador','destinador']},**{papel+'_unidade':'99001' for papel in ['gerador','transportador','destinador']}}
        r=RascunhoMTR.objects.create(empresa=e,ambiente='HOMOLOGACAO',dados=dados)
        conferir_contexto(r,dados,e.cnpj);self.assertEqual(detalhe(r)['empresa']['cnpj'],CNPJ)
        with self.assertRaises(ErroMTR):conferir_contexto(r,{**dados,'transportador_cnpj':'11444777000161'},CNPJ)
        e.refresh_from_db();self.assertEqual(e.cnpj,'11.222.333/0001-81')
