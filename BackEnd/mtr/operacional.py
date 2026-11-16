"""Fluxo de homologação do produto, reutilizando revisão/despacho SIGOR existentes."""
from mtr.models import (RascunhoMTR, RevisaoAmbientalSIGOR, DespachoSIGOR,
                        SolicitacaoEmissaoSIGOR)
from mtr import servicos_mvp as s
from mtr.catalogos_mvp import catalogos_mvp
from mtr.sigor_contrato import validar_dados, inteiro, identificador
from mtr.sigor import ambiental as a

TIPOS = {'unidades-medida': 'uniCodigo', 'tratamentos': 'traCodigo', 'estados-fisicos': 'tieCodigo',
         'acondicionamentos': 'tiaCodigo', 'classes': 'claCodigo'}
CAMPOS = {'gerador_cnpj','gerador_unidade','transportador_cnpj','transportador_unidade',
          'destinador_cnpj','destinador_unidade','resCodigoIbama','marQuantidade',
          'uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo','origem_codigo'}
CONFIRMACOES = {'participantes','quantidade','classificacao','tratamento_destinador','sem_condicionais','ciencia_homologacao'}


def exigir_ausencia_resultado_pendente(empresa):
    # Chamado após o lock empresarial do comando; não contornar um claim com outra referência.
    if DespachoSIGOR.objects.filter(rascunho__empresa=empresa,rascunho__frete__isnull=True,
                                  estado__in=['EM_DESPACHO','INDETERMINADA']).exists():
        raise s.ErroMTR('RESULTADO_INDETERMINADO','Reconcilie a tentativa anterior antes de criar outro manifesto ou referência.')


def criar(empresa, dados):
    s.checar_campos(dados, {'tipo'})
    exigir_ausencia_resultado_pendente(empresa)
    r = RascunhoMTR.objects.create(empresa=empresa, frete=None, ambiente='HOMOLOGACAO',
        dados={p+'_cnpj':empresa.cnpj for p in ['gerador','transportador','destinador']},
        contexto={'dados_simulados':True,'descricoes':{},'fonte_catalogo':'','evidencia_participantes':'',
                  'evidencia_classificacao':'','licencas_ficticias_homologacao':False})
    s.evento(r,'homologacao_criada',origem='EMPRESA_AUTENTICADA',emissao_oficial=False)
    return detalhe(r),201


def conferir_contexto(r, dados, documento):
    if r.frete_id:
        a.conferir_transportador_frete(r.frete,dados,documento)
        return
    if r.ambiente!='HOMOLOGACAO':
        raise s.ErroMTR('AMBIENTE_INVALIDO','Cenário independente disponível somente em homologação.',403)
    try:
        documentos=[identificador(dados[p+'_cnpj']) for p in ['gerador','transportador','destinador']]
        unidades=[inteiro(dados[p+'_unidade']) for p in ['gerador','transportador','destinador']]
        empresarial=identificador(r.empresa.cnpj)
        if any(x!=empresarial for x in documentos) or identificador(documento)!=empresarial or len(set(unidades))!=1:
            raise ValueError()
    except (ValueError,KeyError):
        raise s.ErroMTR('CENARIO_INDEPENDENTE_INVALIDO','Este primeiro ensaio exige a empresa geradora e a mesma unidade nos três papéis. Nenhum frete comercial será criado.',422) from None


def fingerprint_operacao(r):
    if r.frete_id:return s.fingerprint(r.frete)
    return s.hash_dados({'empresa':r.empresa_id,'cnpj':r.empresa.cnpj,'ambiente':r.ambiente,'tipo':'HOMOLOGACAO_INDEPENDENTE'})


def procedencia(r):
    if r.frete_id:return s.fonte_comercial(r.empresa,r.frete)
    return {'origem':'EMPRESA_AUTENTICADA_E_DECLARACAO_OPERADOR','empresa_id':r.empresa_id,
            'quantidade':'INFORMADA_PELO_OPERADOR','frete_inferido':False,'validacao_governamental':False}


def _contexto(c):
    import re
    if not isinstance(c,dict) or set(c)!={'dados_simulados','descricoes','fonte_catalogo','evidencia_participantes','evidencia_classificacao','licencas_ficticias_homologacao'}:
        raise s.ErroMTR('CONTEXTO_INVALIDO','Informe procedência, descrições e evidências do cenário.',400)
    if type(c['dados_simulados']) is not bool or type(c['licencas_ficticias_homologacao']) is not bool:
        raise s.ErroMTR('CONTEXTO_INVALIDO','Informe a natureza simulada e das licenças.',400)
    if not isinstance(c['descricoes'],dict) or set(c['descricoes'])-set(TIPOS.values()) or any(not isinstance(v,str) or len(v)>200 or any(ord(x)<32 for x in v) for v in c['descricoes'].values()):
        raise s.ErroMTR('CONTEXTO_INVALIDO','Descrições de código inválidas.',400)
    if not isinstance(c['fonte_catalogo'],str) or len(c['fonte_catalogo'])>300 or any(ord(x)<32 for x in c['fonte_catalogo']):
        raise s.ErroMTR('CONTEXTO_INVALIDO','Fonte de classificação inválida.',400)
    for campo in ['evidencia_participantes','evidencia_classificacao']:
        if not isinstance(c[campo],str) or c[campo] and not re.fullmatch('[0-9a-f]{64}',c[campo]):
            raise s.ErroMTR('EVIDENCIA_INVALIDA','Evidência deve ser SHA-256 ou ficar pendente.',400)
    return c


def salvar(empresa,id,entrada):
    r=s.rascunho_da_empresa(empresa,id,True);s.versao(r,entrada['versao'])
    if r.frete_id is not None:raise s.ErroMTR('FLUXO_INVALIDO','Utilize o contrato do frete existente.',400)
    if r.estado!='RASCUNHO' or DespachoSIGOR.objects.filter(rascunho=r).exists():
        raise s.ErroMTR('SNAPSHOT_CONGELADO','Revisão aprovada ou intenção existente: os dados não podem ser alterados.')
    s.checar_campos(entrada['dados'],CAMPOS)
    if any(v is not None and not isinstance(v,str) for v in entrada['dados'].values()):
        raise s.ErroMTR('DADOS_INVALIDOS','Informe valores ambientais textuais, sem objetos ou credenciais.',400)
    r.dados={**r.dados,**entrada['dados']};r.contexto=_contexto(entrada['contexto']);r.versao+=1;r.save()
    s.evento(r,'homologacao_atualizada',versao=r.versao,origem='DECLARACAO_OPERADOR')
    return detalhe(r),200


def _catalogo(r):
    ref=catalogos_mvp()
    residuos=[i for i in ref['residuos'] if i['codigo']==r.dados.get('resCodigoIbama') and i['origem']==r.dados.get('origem_codigo')]
    if len(residuos)!=1:return None
    cat={'residuos':residuos}
    for nome,campo in [('unidades','uniCodigo'),('tratamentos','traCodigo'),('estados','tieCodigo'),('acondicionamentos','tiaCodigo'),('classes','claCodigo')]:
        try:codigo=inteiro(r.dados.get(campo))
        except ValueError:codigo=0
        cat[nome]=[{'codigo':codigo,'descricao':r.contexto.get('descricoes',{}).get(campo,'')}]
    return cat


def validar(r):
    cat=_catalogo(r)
    erros=validar_dados(r.dados,r.empresa.cnpj,catalogo=cat) if cat else {'resCodigoIbama':'Selecione um código e sua procedência no catálogo de referência.'}
    try:conferir_contexto(r,r.dados,r.empresa.cnpj)
    except s.ErroMTR:erros['participantes']='Confirme a empresa e a mesma unidade nos três papéis deste ensaio.'
    for campo in TIPOS.values():
        if not r.contexto.get('descricoes',{}).get(campo,'').strip():erros[campo]='Informe a descrição e fonte deste código. Não inferir pelo número.'
    for campo in ['fonte_catalogo','evidencia_participantes','evidencia_classificacao']:
        if not r.contexto.get(campo):erros[campo]='Registre a fonte/evidência, identificando dados fictícios quando for teste.'
    if not r.contexto.get('dados_simulados') and r.dados.get('origem_codigo')=='fixture_fase1a':
        erros['resCodigoIbama']='Código fictício não pode compor preparação com dados de homologação.'
    if not r.contexto.get('dados_simulados'):
        mock=catalogos_mvp()
        for nome,campo in [('unidades','uniCodigo'),('tratamentos','traCodigo'),('estados','tieCodigo'),('acondicionamentos','tiaCodigo'),('classes','claCodigo')]:
            if str(r.dados.get(campo)) in {str(i['codigo']) for i in mock[nome]}:
                erros[campo]='Código identificado como fixture de teste; não promover para homologação.'
        for campo in ['evidencia_participantes','evidencia_classificacao']:
            if r.contexto.get(campo) in {'1'*64,'2'*64}:
                erros[campo]='Hash do exemplo fictício não é evidência de habilitação/classificação.'
    return {'valido_para_preparacao':not erros,'pendencias':erros,'emissao_real_habilitada':False,
            'habilitacao_governamental_automatica':False,'avisos':['Pré-preenchimento e hash de evidência não comprovam habilitação SIGOR.',
            'A compatibilidade entre classe e tratamento exige revisão ambiental, inclusive Classe II B / Aterro Classe I.',
            'Licenças fictícias, quando declaradas, são exclusivas de homologação.']}


def revisar(empresa,id,entrada,op):
    op=s.operador_transacional(op,empresa,'pode_revisar')
    r=s.rascunho_da_empresa(empresa,id,True);s.versao(r,entrada['versao'])
    if r.estado!='RASCUNHO':raise s.ErroMTR('REVISAO_EXISTENTE','Retome a revisão existente sem reescrever os dados.')
    v=validar(r)
    if not v['valido_para_preparacao']:raise s.ErroMTR('PENDENCIAS_AMBIENTAIS','Corrija as pendências antes da revisão.',422,pendencias=v['pendencias'])
    if set(entrada['confirmacoes'])!=CONFIRMACOES or any(x is not True for x in entrada['confirmacoes'].values()):
        raise s.ErroMTR('CONFIRMACOES_NECESSARIAS','Confirme individualmente participantes, quantidade, classificação, tratamento, condicionais e homologação.',422)
    sim=r.contexto['dados_simulados'];ids={}
    for papel,prefix in [('GERADOR','gerador'),('TRANSPORTADOR','transportador'),('DESTINADOR','destinador')]:
        registro,_=a.registrar_vinculo(empresa,{'papel':papel,'cpf_cnpj':r.dados[prefix+'_cnpj'],
            'unidade':inteiro(r.dados[prefix+'_unidade']),'simulado':sim,'confirmar_habilitacao':True,
            'evidencia_sha256':r.contexto['evidencia_participantes']},op)
        ids[papel]=registro['id']
    catalogo=_catalogo(r);caps={}
    # Capturas são declarações versionadas revisadas, não consultas governamentais fabricadas.
    residuo=catalogo['residuos'][0]
    for operacao,(cod,desc) in a.CAMPOS.items():
        campo=TIPOS.get(operacao,'claCodigo' if operacao=='classes-por-residuo' else 'tiaCodigo')
        item={cod:r.dados['resCodigoIbama'] if operacao=='residuos' else inteiro(r.dados[campo]),
              desc:residuo['descricao'] if operacao=='residuos' else r.contexto['descricoes'][campo]}
        parametro=r.dados['resCodigoIbama'] if operacao=='classes-por-residuo' else str(r.dados['tieCodigo']) if operacao=='acondicionamentos-por-estado' else ''
        c=a.capturar(empresa,operacao,[item],parametro=parametro,simulado=sim,
            origem='SIMULACAO' if sim else 'OPERADOR_REFERENCIA',metodo=None,
            fonte_sha256=r.contexto['evidencia_classificacao'])
        caps[operacao]=str(c.pk)
    r.estado='APROVADO';r.versao+=1;r.save()
    a.revisar_ambiental(empresa,id,{'versao':r.versao,'vinculos':ids,'catalogos':caps,'confirmacoes':entrada['confirmacoes']},op)
    s.evento(r,'revisao_individual_aprovada',op,versao=r.versao,simulado=sim)
    return detalhe(r),201


def preparar(empresa,id,entrada,op):
    r=s.rascunho_da_empresa(empresa,id,True);s.versao(r,entrada['versao'])
    if r.estado!='APROVADO':raise s.ErroMTR('REVISAO_NECESSARIA','Aprove a revisão antes de preparar a intenção.')
    if entrada['modo']=='HOMOLOGACAO' and (r.contexto['dados_simulados'] or not op.verificado_homologacao):
        raise s.ErroMTR('EVIDENCIAS_NAO_COMPROVADAS','Dados simulados ou pessoa sem habilitação conferida não podem preparar envio governamental.',422)
    rev=RevisaoAmbientalSIGOR.objects.filter(rascunho=r).latest('criada_em')
    a.preparar_despacho(empresa,id,{'revisao_id':str(rev.pk),'modo':entrada['modo'],'confirmar_preparacao':entrada['confirmar_preparacao']},op)
    r.estado='PREPARADA';r.save(update_fields=['estado','atualizado_em'])
    s.evento(r,'intencao_operacional_preparada',op,emissao_oficial=False)
    return detalhe(r),201


def detalhe(r):
    from mtr.sigor.despacho import despacho_dto
    rev=RevisaoAmbientalSIGOR.objects.filter(rascunho=r).order_by('-criada_em').first()
    d=DespachoSIGOR.objects.filter(rascunho=r).first()
    dto=despacho_dto(d) if d else None
    return {'id':str(r.pk),'tipo':'HOMOLOGACAO_INDEPENDENTE','frete_id':None,'ambiente':r.ambiente,
        'empresa':{'id':r.empresa_id,'razao_social':r.empresa.razao_social,'cnpj':identificador(r.empresa.cnpj)},
        'versao':r.versao,'estado':r.estado,'dados':r.dados,'contexto':r.contexto,'criado_em':r.criado_em.isoformat(),
        'procedencia':procedencia(r),'revisao':{'id':str(rev.pk),'resumo':rev.resumo,
        'responsavel':rev.snapshot['responsavel']['nome']} if rev else None,
        'despacho':dto,'emissao_real_habilitada':bool(dto and dto['emissao_real_habilitada']),
        'documento':{'disponivel':False,'motivo':'Documento oficial ainda não recuperado por operação autorizada.'},
        'eventos':[{'id':str(e.pk),'acao':e.acao,'criado_em':e.criado_em.isoformat(),'detalhes':e.detalhes} for e in r.eventos.order_by('criado_em','id')]}


def solicitar_emissao(empresa,id,op):
    from mtr.sigor.despacho import obter
    d=obter(empresa,id,True);op=s.operador_transacional(op,empresa,'pode_autorizar')
    if d.simulado:raise s.ErroMTR('INTENCAO_SIMULADA','Simulação não pode receber autorização de emissão real.',422)
    if d.estado!='PREPARADA' or d.tentativas:raise s.ErroMTR('TENTATIVA_EXISTENTE','Não criar autorização ou referência para contornar resultado indeterminado.')
    from mtr.sigor.despacho import conferir
    conferir(d,empresa)
    from mtr.sigor.configuracao import conta_da_empresa
    from mtr.sigor.privacidade import ErroSeguro
    from django.conf import settings
    gerador=a.obter_vinculo(empresa,d.revisao.snapshot['vinculos']['GERADOR']['id'],'GERADOR')
    try:conta=conta_da_empresa(empresa,gerador,op)
    except ErroSeguro:raise s.ErroMTR('CONTA_SERVIDOR_PENDENTE','Configure e confira a conta/unidade no servidor antes de solicitar autorização concreta.',422) from None
    executor=getattr(settings,'MTR_SIGOR_EXECUTOR_REFERENCIA','')
    if not isinstance(executor,str) or not executor or len(executor)>120:
        raise s.ErroMTR('EXECUTOR_PENDENTE','Identifique o executor do servidor antes de solicitar autorização.',422)
    scope={'finalidade':'API10_EMISSAO_HOMOLOGACAO','intencao_id':str(d.pk),'referencia':d.referencia,
        'snapshot_sha256':d.revisao.resumo,'payload_sha256':d.resumo,'empresa_id':empresa.pk,
        'conta_ref':conta.credencial_ref,'unidade':d.revisao.snapshot['vinculos']['GERADOR']['unidade'],
        'responsavel_usuario_id':d.revisao.snapshot['responsavel']['usuario_id'],'executor':executor,
        'ambiente':'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest','metodo':'POST','rota':'/salvarManifestoLote',
        'max_tentativas':1,'inicio':None,'fim':None,'aprovador':None,'evidencia_aprovacao':None}
    registro,_=SolicitacaoEmissaoSIGOR.objects.get_or_create(despacho=d,defaults={'operador':op,'escopo':scope,'resumo':s.hash_dados(scope)})
    return {'id':str(registro.pk),'escopo':registro.escopo,'estado':'AGUARDANDO_AUTORIZACAO_ESPECIFICA',
            'concedida':False,'emissao_real_habilitada':False},201
