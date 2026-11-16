"""Cadastro individual local; vínculo de identidade não concede poderes ambientais."""
from django.contrib.auth import get_user_model
from django.db import transaction
from empresas.models import Empresa
from mtr.models import OperadorMTR
from mtr.servicos_mvp import ErroMTR
from mtr.sigor.preparacao import cnpj_completo
from mtr.sigor_contrato import identificador


def conferir_identidades(email,cnpj,usuario,nome):
    if not cnpj_completo(cnpj):raise ErroMTR('CNPJ_INVALIDO','Informe o CNPJ completo confirmado, sem completar dígitos.',422)
    empresas=list(Empresa.objects.filter(email__iexact=email)[:2])
    if len(empresas)!=1:raise ErroMTR('EMPRESA_PENDENTE','Cadastre a empresa pela interface isolada, com telefone e senha pessoais.',422)
    empresa=empresas[0]
    if not empresa.ativo or identificador(empresa.cnpj)!=cnpj:
        raise ErroMTR('IDENTIDADE_EMPRESARIAL_DIVERGENTE','Empresa inativa ou CNPJ cadastrado divergente; nenhum vínculo criado.',422)
    User=get_user_model()
    User._meta.get_field('username').clean(usuario,None)
    User._meta.get_field('first_name').clean(nome,None)
    if not nome.strip() or nome!=nome.strip():raise ErroMTR('NOME_INVALIDO','Informe o nome completo exato da pessoa.',422)
    pessoa=User.objects.filter(username=usuario).first()
    if pessoa and (not pessoa.is_active or pessoa.get_full_name()!=nome):
        raise ErroMTR('IDENTIDADE_INDIVIDUAL_DIVERGENTE','Usuário existente inativo ou pertencente a outro nome; não será alterado.',422)
    return empresa,pessoa


def vincular_sem_permissoes(email,cnpj,usuario,nome,senha,*,nova_pessoa_esperada):
    """Recebe senha apenas em memória, após confirmação pessoal do comando nativo."""
    from django.contrib.auth import authenticate
    from django.contrib.auth.password_validation import validate_password
    if not isinstance(senha,str) or not senha:raise ErroMTR('SENHA_NECESSARIA','Senha individual obrigatória, sem valor padrão.',422)
    with transaction.atomic():
        empresa,pessoa=conferir_identidades(email,cnpj,usuario,nome)
        empresa=Empresa.objects.select_for_update().get(pk=empresa.pk)
        # Revalida sob o lock empresarial antes de persistir; não altera cadastro comercial.
        if not empresa.ativo or identificador(empresa.cnpj)!=cnpj:
            raise ErroMTR('IDENTIDADE_EMPRESARIAL_DIVERGENTE','Empresa mudou durante a confirmação; repita a inspeção.',409)
        pessoa=get_user_model().objects.select_for_update().filter(username=usuario).first()
        if nova_pessoa_esperada!=(pessoa is None):
            raise ErroMTR('USUARIO_MUDOU','Estado do usuário mudou; repita a inspeção sem redefinir sua senha.',409)
        if pessoa is None:
            pessoa=get_user_model()(username=usuario,first_name=nome)
            validate_password(senha,user=pessoa)
            pessoa=get_user_model().objects.create_user(username=usuario,first_name=nome,password=senha)
        else:
            autenticada=authenticate(username=usuario,password=senha)
            if not pessoa.is_active or pessoa.get_full_name()!=nome or autenticada is None or autenticada.pk!=pessoa.pk:
                raise ErroMTR('IDENTIDADE_NAO_CONFIRMADA','Senha/identidade individual não confirmada; nenhum vínculo criado.',403)
        op,criado=OperadorMTR.objects.get_or_create(empresa=empresa,usuario=pessoa,defaults={
            'ativo':True,'pode_revisar':False,'pode_autorizar':False,'verificado_homologacao':False})
        return {'empresa_id':empresa.pk,'usuario_id':pessoa.pk,'usuario_criado':nova_pessoa_esperada,
            'operador_id':op.pk,'vinculo_criado':criado,
            'permissoes':{k:getattr(op,k) for k in ['ativo','pode_revisar','pode_autorizar','verificado_homologacao']},
            'aprovacao_ambiental_concedida':False,'concessao_API10_emitida':False}
