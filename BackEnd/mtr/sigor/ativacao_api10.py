"""Liberação server-side por intenção e hashes; ausência ou divergência nega tudo."""
from django.conf import settings
from django.utils import timezone


def destino_permitido(address,ips_homologacao):
    v=getattr(settings,'MTR_SIGOR_API10_LIBERACAO',None)
    return (getattr(settings,'MTR_SIGOR_API10_REDE_EXPLICITA',False) is True and isinstance(v,dict)
            and isinstance(address,tuple) and len(address)>=2 and address[1]==443
            and address[0] in ips_homologacao and permite(intencao_id=v.get('intencao_id')))


def permite(*,intencao_id=None,referencia=None,payload_sha256=None):
    v=getattr(settings,'MTR_SIGOR_API10_LIBERACAO',None)
    if not isinstance(v,dict) or set(v)!={'intencao_id','referencia','snapshot_sha256','payload_sha256'}:return False
    if intencao_id is None and (referencia is None or payload_sha256 is None):return False
    if intencao_id is not None and str(intencao_id)!=v['intencao_id']:return False
    if referencia is not None and referencia!=v['referencia']:return False
    if payload_sha256 is not None and payload_sha256!=v['payload_sha256']:return False
    try:
        from mtr.models import ConcessaoEmissaoSIGOR
        from mtr.servicos_mvp import hash_dados
        c=ConcessaoEmissaoSIGOR.objects.select_related('solicitacao__despacho__revisao','solicitacao__despacho__rascunho__empresa','solicitacao__operador__usuario').filter(solicitacao__despacho_id=v['intencao_id']).first()
        if not c or not c.valida_desde<=timezone.now()<c.valida_ate:return False
        d=c.solicitacao.despacho;s=c.escopo;op=c.solicitacao.operador
        if type(s.get('max_tentativas')) is not int:return False
        if d.simulado or d.estado not in {'PREPARADA','EM_DESPACHO'} or not d.rascunho.empresa.ativo or not op.ativo or not op.usuario.is_active or not op.verificado_homologacao or not op.pode_autorizar:return False
        if d.referencia!=v['referencia'] or d.resumo!=v['payload_sha256'] or d.revisao.resumo!=v['snapshot_sha256']:return False
        if hash_dados(c.solicitacao.escopo)!=c.solicitacao.resumo:return False
        esperado={**v,'finalidade':'API10_EMISSAO_HOMOLOGACAO','ambiente':'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest','metodo':'POST','rota':'/salvarManifestoLote','max_tentativas':1}
        return all(s.get(k)==valor for k,valor in esperado.items())
    except Exception:return False
