"""Preparação consultiva API10; declarações não criam identidade ou habilitação."""
import json
import os
import re
from pathlib import Path
from django.conf import settings
from empresas.models import Empresa
from mtr.models import OperadorMTR,RascunhoMTR
from mtr.servicos_mvp import ErroMTR
from mtr.sigor_contrato import identificador

FORMATO='ZENWASTE_API10_METADATA_V1'
CAMPOS={'formato','empresa_email','cnpj_informado','unidade','responsavel_usuario','responsavel_nome',
        'credencial_ref','executor_ref','evidencia_representacao_sha256','evidencia_ambiental_sha256',
        'representacao_confirmada','ambiental_confirmada'}
DADOS={'resCodigoIbama':'010101','origem_codigo':'referencia_operador_homologacao','marQuantidade':'5.5',
       'uniCodigo':'3','traCodigo':'4','tieCodigo':'4','tiaCodigo':'26','claCodigo':'42'}
DESCRICOES={'uniCodigo':'Tonelada — cenário declarado pelo operador',
            'traCodigo':'Aterro Resíduos Classe I — requer confirmação de compatibilidade',
            'tieCodigo':'Sólido — referência histórica', 'tiaCodigo':'Big Bag — referência histórica',
            'claCodigo':'Classe II B — requer confirmação ambiental específica'}


def exigir_ambiente_mtr05():
    from django.db import connection
    cfg=settings.DATABASES['default']
    esperado=getattr(settings,'MTR_ISOLADO_ESPERADO',None)
    if not isinstance(esperado,dict) or set(esperado)!={'perfil','database','host','port','system_id'} or esperado['perfil']!='MTR_ISOLADO':
        raise ErroMTR('AMBIENTE_NAO_AUTORIZADO','Identidade do ambiente isolado não configurada no servidor.',403)
    if esperado['host']!='127.0.0.1' or (cfg.get('NAME'),cfg.get('HOST'),str(cfg.get('PORT')))!=(esperado['database'],esperado['host'],str(esperado['port'])):
        raise ErroMTR('AMBIENTE_NAO_AUTORIZADO','Execute somente no PostgreSQL isolado MTR-05.',403)
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database(),inet_server_port(),(pg_control_system()).system_identifier::text")
        identidade=cursor.fetchone()
    if identidade!=(esperado['database'],int(esperado['port']),esperado['system_id']):
        raise ErroMTR('AMBIENTE_NAO_AUTORIZADO','Identidade do PostgreSQL divergente.',403)
    return identidade


def cnpj_completo(v):
    # Não remover pontuação, completar zero, converter para inteiro ou corrigir o documento.
    if not isinstance(v,str) or not re.fullmatch('[0-9]{14}',v) or len(set(v))==1:return False
    def dv(s,pesos):
        resto=sum(int(c)*p for c,p in zip(s,pesos))%11
        return str(0 if resto<2 else 11-resto)
    return v[-2]==dv(v[:12],[5,4,3,2,9,8,7,6,5,4,3,2]) and v[-1]==dv(v[:13],[6,5,4,3,2,9,8,7,6,5,4,3,2])


def metadata():
    v=getattr(settings,'MTR_SIGOR_CADASTRO_METADATA',None)
    if v is None:return None
    if not isinstance(v,dict) or set(v)!=CAMPOS or v.get('formato')!=FORMATO:
        raise ErroMTR('CADASTRO_API10_INVALIDO','Configuração de vínculo inválida; não fornecer credenciais neste cadastro.',422)
    if type(v['unidade']) is not int or not 1<=v['unidade']<=2147483647 or any(type(v[k]) is not bool for k in ['representacao_confirmada','ambiental_confirmada']):
        raise ErroMTR('CADASTRO_API10_INVALIDO','Unidade/estado de confirmação inválidos.',422)
    for k in CAMPOS-{'unidade','representacao_confirmada','ambiental_confirmada'}:
        if v[k] is not None and (not isinstance(v[k],str) or len(v[k])>254 or any(ord(c)<32 for c in v[k])):
            raise ErroMTR('CADASTRO_API10_INVALIDO','Metadados inválidos.',422)
    for k in ['evidencia_representacao_sha256','evidencia_ambiental_sha256']:
        if v[k] is not None and not re.fullmatch('[0-9a-f]{64}',v[k]):
            raise ErroMTR('EVIDENCIA_API10_INVALIDA','Informe SHA-256 da evidência sanitizada.',422)
    return v


def carregar_metadata_runtime():
    """O processo do servidor lê somente cadastro sem segredos, nunca homologacao.json ou chave Q2."""
    caminho=os.environ.get('MTR_SIGOR_CADASTRO_API10')
    if not caminho:return
    p=Path(caminho)
    if p.name!='cadastro-api10.json' or not p.is_file() or p.stat().st_size>8192:
        raise ErroMTR('CADASTRO_API10_INVALIDO','Use o cadastro de metadados específico API10.',422)
    try:
        def unicos(pares):
            out={}
            for k,v in pares:
                if k in out:raise ValueError()
                out[k]=v
            return out
        v=json.loads(p.read_text(encoding='utf-8'),object_pairs_hook=unicos)
        settings.MTR_SIGOR_CADASTRO_METADATA=v;metadata()
    except Exception:
        settings.MTR_SIGOR_CADASTRO_METADATA=None
        raise ErroMTR('CADASTRO_API10_INVALIDO','Não foi possível validar metadados API10; nenhum vínculo aplicado.',422) from None
    # A configuração não cria empresa/pessoa, não concede poderes nem marca operador verificado.
    empresas=list(Empresa.objects.filter(email__iexact=v['empresa_email'],ativo=True)[:2])
    if len(empresas)!=1:return
    empresa=empresas[0];op=_operador(empresa,v)
    if pendencias(empresa,v,op):return
    settings.MTR_SIGOR_CONTAS={**getattr(settings,'MTR_SIGOR_CONTAS',{}),str(empresa.pk):{
        'unidade':v['unidade'],'gerador_cnpj':v['cnpj_informado'],'credencial_ref':v['credencial_ref'],'operador_id':op.pk}}
    settings.MTR_SIGOR_EXECUTOR_REFERENCIA=v['executor_ref']


def carregar_liberacao_runtime():
    """Apenas manifesto de liberação sem segredos, criado pessoalmente após concessão."""
    caminho=os.environ.get('MTR_SIGOR_LIBERACAO_API10')
    if not caminho:return
    p=Path(caminho)
    if p.name!='liberacao-api10.json' or not p.is_file() or p.stat().st_size>2048:
        raise ErroMTR('LIBERACAO_API10_INVALIDA','Manifesto específico de liberação inválido.',403)
    try:
        v=json.loads(p.read_text(encoding='utf-8'))
        if not isinstance(v,dict) or set(v)!={'intencao_id','referencia','snapshot_sha256','payload_sha256'} or any(not isinstance(x,str) for x in v.values()):raise ValueError()
        from uuid import UUID
        UUID(v['intencao_id'])
        if not re.fullmatch('[A-Za-z0-9-]{1,30}',v['referencia']) or any(not re.fullmatch('[0-9a-f]{64}',v[k]) for k in ['snapshot_sha256','payload_sha256']):raise ValueError()
        settings.MTR_SIGOR_API10_LIBERACAO=v
    except Exception:raise ErroMTR('LIBERACAO_API10_INVALIDA','Não foi possível validar a liberação específica.',403) from None


def _operador(empresa,v):
    if not v or not v['responsavel_usuario']:return None
    return OperadorMTR.objects.select_related('usuario').filter(empresa=empresa,usuario__username=v['responsavel_usuario']).first()


def pendencias(empresa,v,op):
    p=[]
    if not v:return ['CADASTRO_PRIVADO_PENDENTE']
    if not cnpj_completo(v['cnpj_informado']):p.append('CNPJ_COMPLETO_NAO_CONFIRMADO')
    if not empresa or not empresa.ativo or empresa.email.casefold()!=str(v['empresa_email']).casefold():p.append('EMPRESA_NAO_IDENTIFICADA')
    else:
        try:documento=identificador(empresa.cnpj)
        except ValueError:documento=None
        if documento!=v['cnpj_informado']:p.append('CNPJ_CADASTRAL_DIVERGENTE')
    if not op or not op.ativo or not op.usuario.is_active or not v['responsavel_nome'] or op.usuario.get_full_name()!=v['responsavel_nome']:
        p.append('PESSOA_INDIVIDUAL_NAO_IDENTIFICADA')
    elif not op.pode_revisar or not op.pode_autorizar or not op.verificado_homologacao:p.append('PERMISSOES_INDIVIDUAIS_NAO_VERIFICADAS')
    if not v['representacao_confirmada'] or not v['evidencia_representacao_sha256']:p.append('REPRESENTACAO_NAO_COMPROVADA')
    if not v['ambiental_confirmada'] or not v['evidencia_ambiental_sha256']:p.append('REVISAO_AMBIENTAL_PENDENTE')
    if not isinstance(v['credencial_ref'],str) or not re.fullmatch('[A-Z][A-Z0-9_]{0,63}',v['credencial_ref']):p.append('REFERENCIA_CONTA_PENDENTE')
    if not v['executor_ref']:p.append('EXECUTOR_PENDENTE')
    return p


def inspecionar(email,usuario=None):
    from django.contrib.auth import get_user_model
    User=get_user_model()
    v=metadata();empresas=list(Empresa.objects.filter(email__iexact=email)[:2])
    empresa=empresas[0] if len(empresas)==1 else None
    ops=OperadorMTR.objects.filter(empresa=empresa) if empresa else OperadorMTR.objects.none()
    op=_operador(empresa,v) if empresa else None
    nome_usuario=usuario or (v['responsavel_usuario'] if v else None)
    pessoa=User.objects.filter(username=nome_usuario).first() if nome_usuario else None
    vinculo=OperadorMTR.objects.filter(usuario=pessoa,empresa=empresa).first() if pessoa and empresa else None
    return {'empresa_encontrada':empresa is not None,'empresas_correspondentes':len(empresas),
        'modelo_usuario':User._meta.label,'tabela_usuario':User._meta.db_table,
        'modelo_usuario_FK_OperadorMTR':OperadorMTR._meta.get_field('usuario').remote_field.model._meta.label,
        'empresa_id':empresa.pk if empresa else None,'empresa_ativa':empresa.ativo if empresa else None,
        'cnpj_cadastrado':empresa.cnpj if empresa else None,
        'usuario_consultado':nome_usuario,'usuario_existe':pessoa is not None,'usuario_id':pessoa.pk if pessoa else None,
        'nome_individual_corresponde':bool(pessoa and v and pessoa.get_full_name()==v['responsavel_nome']),
        'vinculo_operador_id':vinculo.pk if vinculo else None,
        'permissoes':{k:getattr(vinculo,k) for k in ['ativo','pode_revisar','pode_autorizar','verificado_homologacao']} if vinculo else None,
        'cnpj_informado_digitos':len(v['cnpj_informado'] or '') if v else None,
        'cnpj_completo_confirmado':cnpj_completo(v['cnpj_informado']) if v else False,
        'operadores_associados':ops.count(),'operadores_ativos':ops.filter(ativo=True,usuario__is_active=True).count(),
        'vinculo_aplicado':bool(empresa and str(empresa.pk) in getattr(settings,'MTR_SIGOR_CONTAS',{})),
        'pendencias':pendencias(empresa,v,op),'unidade_proposta':v['unidade'] if v else None,'emissao_real_habilitada':False}


def proposta_publica(empresa):
    v=metadata();op=_operador(empresa,v);p=pendencias(empresa,v,op)
    # Nunca publicar o cadastro/pessoa de outra empresa ou a referência privada da credencial.
    return {'estado':'CANDIDATO_PENDENTE' if p else 'APTO_A_REVISAO_INDIVIDUAL',
        'unidade_proposta':v['unidade'] if v else None,'unidade_vinculada':None if p else v['unidade'],
        'dados':DADOS.copy(),'descricoes':DESCRICOES.copy(),'origem':'CENARIO_DECLARADO_OPERADOR_MTR05B',
        'pendencias':p,'pode_criar_candidato':not p,'revisao_individual_aprovada':False,
        'referencia':None,'snapshot_sha256':None,'payload_sha256':None,
        'responsavel':op.usuario.get_full_name() if not p else None,'emissao_real_habilitada':False,
        'aviso':'Cenário proposto não comprova classificação, compatibilidade ambiental ou poderes de representação.'}


def criar_candidato(empresa,dados):
    from mtr import operacional as o
    v=metadata();op=_operador(empresa,v);p=pendencias(empresa,v,op)
    if p:raise ErroMTR('VINCULO_API10_PENDENTE','Confirme CNPJ completo, pessoa e evidências antes de associar este cenário à empresa.',422,pendencias=p)
    body,status=o.criar(empresa,{'tipo':'HOMOLOGACAO_INDEPENDENTE'})
    r=RascunhoMTR.objects.get(pk=body['id'])
    r.dados={**r.dados,**DADOS,**{p+'_unidade':str(v['unidade']) for p in ['gerador','transportador','destinador']}}
    r.contexto={'dados_simulados':False,'descricoes':DESCRICOES.copy(),'fonte_catalogo':'Cenário declarado MTR05B; confirmação ambiental individual obrigatória',
        'evidencia_participantes':v['evidencia_representacao_sha256'],'evidencia_classificacao':v['evidencia_ambiental_sha256'],
        'licencas_ficticias_homologacao':True}
    r.save();o.s.evento(r,'candidato_mtr05b_preparado',revisao_individual_aprovada=False)
    return o.detalhe(r),status
