"""Despacho API10 do produto. Gate fechado no código, sem autoautorização pública."""
from datetime import timedelta
from uuid import uuid4
from hashlib import sha256
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from mtr.models import ConcessaoEmissaoSIGOR, DespachoSIGOR, ReciboMTR
from mtr.servicos_mvp import ErroMTR, hash_dados, operador_transacional, rascunho_da_empresa
from mtr.sigor import despacho as d
from mtr.sigor.ambiental import obter_vinculo, uuid_valido
from mtr.sigor.configuracao import conta_da_empresa, provedor_ambiente
from mtr.sigor.emissao_controlada import ClienteEmissaoSIGOR, validar_wire
from mtr.sigor.leitura import (TransporteHTTPSHomologacao, RequisicaoPrivada, Operacao,
                              envelope, token_privado)
from mtr.sigor.privacidade import CredenciaisSIGOR, ErroSeguro
from mtr.sigor.protocolo import politica_escrita_permite, incerto


class TransporteAPI10Homologacao:
    rede_real = True

    def enviar(self, wire, conta, limite):
        # Nenhum valor privado é carregado até o claim autorizado estar duravelmente gravado.
        referencia=validar_wire(wire)[0]['seuCodigo']
        if not politica_escrita_permite(referencia=referencia,payload_sha256=sha256(wire.encode()).hexdigest()): raise PermissionError('ESCRITA_SIGOR_BLOQUEADA')
        provedor = getattr(settings, 'MTR_SIGOR_PROVEDOR_CREDENCIAL', provedor_ambiente)
        credenciais = provedor(conta.credencial_ref)
        if not isinstance(credenciais, CredenciaisSIGOR) or int(credenciais._payload_autenticacao()['unidade']) != conta.unidade:
            raise PermissionError('CONTA_UNIDADE_DIVERGENTES')
        port = TransporteHTTPSHomologacao(autorizacao_explicita=True)
        resposta = port.enviar(RequisicaoPrivada(Operacao.AUTENTICAR, credenciais=credenciais))
        token = token_privado(envelope(resposta, autenticacao=True))
        if timezone.now() >= limite: raise PermissionError('JANELA_API10_EXPIRADA')
        cliente = ClienteEmissaoSIGOR()
        return cliente.enviar_governamental(cliente.preparar_requisicao(wire, token))


def _concessao(empresa, despacho, op):
    c = ConcessaoEmissaoSIGOR.objects.select_related('solicitacao').filter(solicitacao__despacho=despacho).first()
    if not c: raise ErroMTR('CONCESSAO_API10_NECESSARIA', 'A intenção não possui concessão específica de emissão.', 403)
    pedido = c.solicitacao
    if hash_dados(pedido.escopo) != pedido.resumo or any(c.escopo.get(k) != v for k, v in pedido.escopo.items() if k not in {'inicio','fim','aprovador','evidencia_aprovacao'}):
        raise ErroMTR('CONCESSAO_DIVERGENTE', 'A concessão não corresponde à solicitação.', 403)
    if not c.valida_desde <= timezone.now() < c.valida_ate:
        raise ErroMTR('CONCESSAO_EXPIRADA', 'A janela autorizada não está vigente.', 403)
    scope = c.escopo
    atual = {'intencao_id':str(despacho.pk),'referencia':despacho.referencia,'payload_sha256':despacho.resumo,
             'snapshot_sha256':despacho.revisao.resumo,'empresa_id':empresa.pk,'responsavel_usuario_id':op.usuario_id,
             'executor':getattr(settings,'MTR_SIGOR_EXECUTOR_REFERENCIA',''),'max_tentativas':1,
             'ambiente':'https://mtrr-hom.cetesb.sp.gov.br/apiws/rest','metodo':'POST','rota':'/salvarManifestoLote',
             'finalidade':'API10_EMISSAO_HOMOLOGACAO'}
    if any(scope.get(k) != v for k,v in atual.items()) or not op.verificado_homologacao:
        raise ErroMTR('CONCESSAO_DIVERGENTE', 'Confira intenção, pessoa, executor e ambiente autorizados.', 403)
    vinculo = obter_vinculo(empresa,despacho.revisao.snapshot['vinculos']['GERADOR']['id'],'GERADOR')
    try: conta = conta_da_empresa(empresa,vinculo,op)
    except ErroSeguro: raise ErroMTR('CONTA_DIVERGENTE','Configuração da conta/unidade indisponível.',422) from None
    if conta.credencial_ref != scope.get('conta_ref') or conta.unidade != scope.get('unidade'):
        raise ErroMTR('CONTA_DIVERGENTE', 'A conta/unidade do servidor mudou após a autorização.', 403)
    return c,conta


def despachar_autorizado(empresa,id,op,chave,*,transporte=None):
    # O endpoint e qualquer chamada Python normal continuam bloqueados antes de ler credenciais.
    if not politica_escrita_permite(intencao_id=id):
        raise ErroMTR('EMISSAO_REAL_BLOQUEADA','Envio governamental fechado. A autoridade Q2 não concede emissão API10.',403)
    d.fora_atomic(); chave=uuid_valido(chave)
    operacao=f'api10-emissao:{id}:{op.pk}'; resumo=hash_dados({'intencao_id':str(id),'operador_id':op.pk})
    with transaction.atomic(durable=True):
        d.empresa_lock(empresa); op=operador_transacional(op,empresa,'pode_autorizar')
        anterior=ReciboMTR.objects.filter(empresa=empresa,chave=chave).first()
        if anterior:
            if anterior.operacao!=operacao or anterior.resumo!=resumo: raise ErroMTR('CHAVE_REUTILIZADA','Consulte o comando original.')
            return anterior.resposta,anterior.status_http
        atual=d.obter(empresa,id); rascunho_da_empresa(empresa,atual.rascunho_id,True)
        if atual.simulado or atual.rascunho.frete_id is not None:
            raise ErroMTR('CENARIO_API10_INVALIDO','Somente o primeiro cenário independente de homologação é elegível.',422)
        d.conferir(atual,empresa); atual=d.obter(empresa,id,True)
        if atual.tentativas or atual.estado!='PREPARADA': raise ErroMTR('TENTATIVA_EXISTENTE','Não repetir envio; consulte ou reconcilie a intenção original.')
        from mtr.operacional import exigir_ausencia_resultado_pendente
        exigir_ausencia_resultado_pendente(empresa)
        concessao,conta=_concessao(empresa,atual,op); validar_wire(atual.payload_wire)
        worker=uuid4(); atual.trabalhador=worker; atual.tentativas=1; atual.estado='EM_DESPACHO'
        atual.iniciada_em=timezone.now(); atual.limite_trabalhador=atual.iniciada_em+timedelta(seconds=60); atual.save()
        d.evento(atual,'TENTATIVA_PERSISTIDA',concessao_id=str(concessao.pk),simulado=False)
        ack={'id':str(atual.pk),'aceito':True,'status_url':f'/api/mtr/sigor/despachos/{atual.pk}/','emissao_real_habilitada':False}
        ReciboMTR.objects.create(empresa=empresa,chave=chave,operacao=operacao,resumo=resumo,resposta=ack,status_http=202)
    # HTTP e autenticação fora da transação; qualquer incerteza mantém o claim consumido.
    try:
        port=transporte or TransporteAPI10Homologacao()
        if not isinstance(port,TransporteAPI10Homologacao) or (transporte is not None and port.rede_real is not False): raise PermissionError()
        resposta=port.enviar(atual.payload_wire,conta,concessao.valida_ate)
        resultado=ClienteEmissaoSIGOR().interpretar(resposta,atual.payload_wire,atual.revisao.snapshot['vinculos']['GERADOR'])
    except Exception: resultado=incerto('FALHA_APOS_CLAIM')
    d._finalizar(empresa,id,worker,resultado)
    return ack,202
