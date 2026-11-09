"""Casos de uso persistentes da auditoria, sem efeitos de estoque ou pagamento.

Ordem dos locks: Empresa autora (NO KEY UPDATE), Pedido quando vinculado,
Frete. Nenhum comando toma esses locks na ordem inversa. O lock da autora
serializa também a chave idempotente de criações e comandos em fretes distintos;
NO KEY UPDATE permite que outras transações referenciem a empresa por FK.
"""

import hashlib
import json
import uuid
from collections.abc import Mapping

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from app.excecoes import ErroConflito, ErroRegraNegocio
from empresas.models import Empresa, PapelEmpresa
from pedidos.models import Pedido
from fretes import serializers as contratos
from fretes.consultas import obter_frete_empresa, quantidade_alocada_pedido
from fretes.dominio import ConferenciaFrete, situacao_apos_conferencia
from fretes.models import (
    ConfirmacaoEntrega, CotacaoFrete, DemandaTransporte, DivergenciaFrete,
    DocumentoCTe, Frete, HistoricoFrete,
)
from fretes.permissoes import (
    ErroAcessoFrete, ErroFreteNaoEncontrado, exigir_confirmacao_entrega, exigir_gestao_frete,
)


def _validar_entrada(tipo, entrada):
    if not isinstance(entrada, Mapping):
        raise ErroRegraNegocio("Envie um objeto JSON.")
    serializador = tipo(data=entrada)
    desconhecidos = set(entrada) - set(serializador.fields)
    if desconhecidos:
        raise ErroRegraNegocio({campo: "Campo não permitido neste comando." for campo in desconhecidos})
    if not serializador.is_valid():
        raise ErroRegraNegocio(serializador.errors)
    return serializador.validated_data


def _salvar(instancia, **opcoes):
    try:
        instancia.full_clean()
        instancia.save(**opcoes)
    except ValidationError as erro:
        raise ErroRegraNegocio(erro.message_dict if hasattr(erro, "message_dict") else erro.messages) from erro
    return instancia


def _preparar_comando(empresa, acao, identificador, dados, chave):
    if not isinstance(chave, str) or not chave.strip() or len(chave) > 128:
        raise ErroRegraNegocio({"Idempotency-Key": "Informe uma chave não vazia de até 128 caracteres."})
    if not empresa or not empresa.pk:
        raise ErroAcessoFrete("Empresa autenticada obrigatória.")
    try:
        autora = Empresa.objects.select_for_update(no_key=True).get(pk=empresa.pk, ativo=True)
    except Empresa.DoesNotExist as erro:
        raise ErroAcessoFrete("Empresa inativa ou indisponível.") from erro
    conteudo = json.dumps(
        {"frete": str(identificador) if identificador else None, "dados": dados},
        sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False,
    )
    resumo = hashlib.sha256(conteudo.encode("utf-8")).hexdigest()
    chave = chave.strip()
    anterior = HistoricoFrete.objects.filter(autora=autora, acao=acao, chave_idempotencia=chave).first()
    if anterior and anterior.resumo_dados != resumo:
        raise ErroConflito("A chave de idempotência já foi utilizada com outro frete ou conteúdo.")
    return autora, chave, resumo, anterior


def _historico(frete, autora, acao, chave, resumo, situacao_anterior, detalhes):
    # Os dados da assinatura não entram em detalhes nem na resposta do histórico.
    return _salvar(HistoricoFrete(
        frete=frete, autora=autora, acao=acao, chave_idempotencia=chave,
        resumo_dados=resumo, situacao_anterior=situacao_anterior,
        situacao_nova=frete.situacao, detalhes=detalhes,
    ))


def _bloquear_frete(empresa, identificador):
    pedido_id = Frete.objects.filter(pk=identificador).values_list("pedido_id", flat=True).first()
    if pedido_id:
        Pedido.objects.select_for_update().get(pk=pedido_id)
    try:
        frete = Frete.objects.select_for_update().get(pk=identificador)
    except Frete.DoesNotExist as erro:
        raise ErroFreteNaoEncontrado("Frete não encontrado para esta empresa.") from erro
    if frete.pedido_id != pedido_id:
        raise ErroConflito("O vínculo do frete mudou. Repita a operação.")
    if not (
        empresa.pk in (frete.empresa_vendedora_id, frete.empresa_compradora_id, frete.transportadora_id)
        or frete.cotacoes.filter(transportadora=empresa).exists()
    ):
        raise ErroFreteNaoEncontrado("Frete não encontrado para esta empresa.")
    return frete


def _empresa_elegivel(identificador, papel):
    try:
        return Empresa.objects.get(pk=identificador, ativo=True, papeis__codigo=papel)
    except (Empresa.DoesNotExist, ValueError, TypeError) as erro:
        raise ErroRegraNegocio({"empresa": "Empresa ativa com o papel exigido não encontrada."}) from erro


def _exigir_situacao(frete, *permitidas):
    if frete.situacao not in permitidas:
        raise ErroConflito("Esta operação não é permitida na situação atual do frete.")


@transaction.atomic
def criar_frete(empresa, entrada, chave_idempotencia):
    dados = _validar_entrada(contratos.SerializadorCriacaoFrete, entrada)
    autora, chave, resumo, anterior = _preparar_comando(empresa, "criar", None, dados, chave_idempotencia)
    if anterior:
        return obter_frete_empresa(autora, anterior.frete_id)
    if not autora.papeis.filter(codigo=PapelEmpresa.Codigo.VENDEDORA).exists():
        raise ErroAcessoFrete("O cadastro de frete exige o papel de vendedora.")
    identificador = uuid.uuid4()
    pedido = None
    if dados.get("pedido_id"):
        try:
            pedido = Pedido.objects.select_for_update(of=("self",)).select_related("anuncio__produto").get(
                pk=dados["pedido_id"], anuncio__produto__empresa=autora,
            )
        except Pedido.DoesNotExist as erro:
            raise ErroFreteNaoEncontrado("Pedido não encontrado para esta vendedora.") from erro
        if pedido.situacao in (Pedido.Situacao.CANCELADO, Pedido.Situacao.EXPIRADO):
            raise ErroConflito("Pedido cancelado ou expirado não aceita novas remessas.")
        if dados["quantidade"] + quantidade_alocada_pedido(pedido) > pedido.quantidade:
            raise ErroConflito("A soma das remessas ultrapassa a quantidade negociada no Pedido.")
        if dados.get("unidade") and dados["unidade"] != pedido.unidade_material_negociado:
            raise ErroRegraNegocio({"unidade": "A unidade deve corresponder à unidade negociada."})
        compradora = pedido.empresa_compradora
        if not compradora.ativo:
            raise ErroRegraNegocio("A empresa compradora está inativa.")
        if dados.get("empresa_compradora_id") not in (None, compradora.pk):
            raise ErroRegraNegocio({"empresa_compradora_id": "A compradora é determinada pelo Pedido."})
        material, unidade, numero = pedido.nome_material_negociado, pedido.unidade_material_negociado, pedido.numero
    else:
        compradora = _empresa_elegivel(dados["empresa_compradora_id"], PapelEmpresa.Codigo.COMPRADORA)
        material, unidade, numero = dados["material"], dados["unidade"], f"AV-{identificador.hex[:12].upper()}"
    if compradora.pk == autora.pk:
        raise ErroRegraNegocio("Vendedora e compradora devem ser empresas distintas.")
    frete = _salvar(Frete(
        id=identificador, pedido=pedido, empresa_vendedora=autora, empresa_compradora=compradora,
        numero_pedido=numero, origem_cadastro="pedido" if pedido else "avulso", material=material, unidade=unidade,
        **{campo: dados[campo] for campo in (
            "quantidade", "origem", "destino", "peso_toneladas", "cubagem_m3", "quantidade_volumes",
        )},
        previsao_entrega=dados.get("previsao_entrega"),
    ))
    _historico(frete, autora, "criar", chave, resumo, "", {"origem_cadastro": frete.origem_cadastro})
    return obter_frete_empresa(autora, frete.pk)


def _classificar(frete, autora, dados):
    _exigir_situacao(frete, Frete.Situacao.AGUARDANDO_CLASSIFICACAO)
    frete.modalidade = dados["modalidade"]
    if frete.modalidade == Frete.Modalidade.CONTRATADO:
        if dados.get("valor_referencia") is None or not dados.get("transportadora_id"):
            raise ErroRegraNegocio("Frete contratado exige transportadora e valor de referência informados.")
        frete.transportadora = _empresa_elegivel(dados["transportadora_id"], PapelEmpresa.Codigo.TRANSPORTADORA)
        frete.valor_referencia = dados["valor_referencia"]
        frete.situacao = Frete.Situacao.AGUARDANDO_CONFERENCIA
    else:
        if dados.get("transportadora_id") is not None or dados.get("valor_referencia") is not None:
            raise ErroRegraNegocio("Transportadora e referência contratada pertencem à modalidade contratado.")
        frete.situacao = (
            Frete.Situacao.EM_COTACAO if frete.modalidade == Frete.Modalidade.COTAR
            else Frete.Situacao.AGUARDANDO_ENTREGA
        )
    _salvar(frete)
    return {"modalidade": frete.modalidade}


def _registrar_cotacao(frete, autora, dados):
    _exigir_situacao(frete, Frete.Situacao.EM_COTACAO)
    transportadora = _empresa_elegivel(dados["transportadora_id"], PapelEmpresa.Codigo.TRANSPORTADORA)
    cotacao = _salvar(CotacaoFrete(
        frete=frete, transportadora=transportadora,
        **{campo: dados[campo] for campo in ("valor", "prazo_dias", "observacao")},
    ))
    return {"cotacao_id": str(cotacao.pk), "transportadora_id": transportadora.pk}


def _aprovar_cotacao(frete, autora, dados):
    _exigir_situacao(frete, Frete.Situacao.EM_COTACAO)
    try:
        cotacao = frete.cotacoes.select_related("transportadora").get(pk=dados["cotacao_id"])
    except CotacaoFrete.DoesNotExist as erro:
        raise ErroRegraNegocio({"cotacao_id": "Cotação não encontrada neste frete."}) from erro
    _empresa_elegivel(cotacao.transportadora_id, PapelEmpresa.Codigo.TRANSPORTADORA)
    cotacao.aprovada = True
    _salvar(cotacao)
    frete.transportadora = cotacao.transportadora
    frete.valor_referencia = cotacao.valor
    frete.situacao = Frete.Situacao.AGUARDANDO_CONFERENCIA
    _salvar(frete)
    return {"cotacao_id": str(cotacao.pk), "transportadora_id": cotacao.transportadora_id}


def _divergencia_aberta(frete):
    abertas = list(frete.divergencias.filter(resolvida_em__isnull=True).select_related("documento"))
    if len(abertas) > 1:
        raise ErroConflito("Há análises abertas inconsistentes; revise o histórico antes de prosseguir.")
    return abertas[0] if abertas else None


def _reavaliar(frete):
    frete.situacao = situacao_apos_conferencia(
        divergencia_aberta=frete.divergencias.filter(resolvida_em__isnull=True).exists(),
        recebimento_confirmado=frete.recebimento_confirmado,
    )
    _salvar(frete)


def _registrar_cte(frete, autora, dados):
    _exigir_situacao(frete, Frete.Situacao.AGUARDANDO_CONFERENCIA, Frete.Situacao.COM_DIVERGENCIA, Frete.Situacao.AGUARDANDO_ENTREGA)
    if frete.modalidade == Frete.Modalidade.RETIRADA_CLIENTE or frete.valor_referencia is None:
        raise ErroConflito("Esta modalidade não possui conferência de CT-e ou referência definida.")
    anterior = _divergencia_aberta(frete)
    ultimo = frete.documentos.order_by("-versao").first()
    documento = _salvar(DocumentoCTe(frete=frete, versao=ultimo.versao + 1 if ultimo else 1, **dados))
    if anterior:
        anterior.tipo_resolucao = DivergenciaFrete.TipoResolucao.CTE_CORRIGIDO
        anterior.documento_correcao = documento
        anterior.empresa_resolvedora = autora
        anterior.resolvida_em = timezone.now()
        nova = anterior.preparar_divergencia_da_correcao()
        _salvar(anterior)
    else:
        conferencia = ConferenciaFrete(frete.valor_referencia, documento.valor)
        nova = DivergenciaFrete(
            frete=frete, documento=documento, valor_referencia=conferencia.valor_referencia,
            valor_cobrado=conferencia.valor_cobrado, diferenca=conferencia.diferenca,
        ) if conferencia.divergente else None
    if nova:
        _salvar(nova)
    _reavaliar(frete)
    return {"documento_id": str(documento.pk), "versao": documento.versao, "nova_divergencia": bool(nova)}


def _resolver_divergencia(frete, autora, dados):
    _exigir_situacao(frete, Frete.Situacao.COM_DIVERGENCIA)
    divergencia = _divergencia_aberta(frete)
    if not divergencia:
        raise ErroConflito("Não há divergência aberta para aceitar.")
    divergencia.tipo_resolucao = DivergenciaFrete.TipoResolucao.ACEITE_JUSTIFICADO
    divergencia.justificativa = dados["justificativa"]
    divergencia.empresa_resolvedora = autora
    divergencia.resolvida_em = timezone.now()
    _salvar(divergencia)
    _reavaliar(frete)
    return {"divergencia_id": str(divergencia.pk), "justificativa": divergencia.justificativa}


def _cancelar(frete, autora, dados):
    if not frete.pode_cancelar:
        raise ErroConflito("O frete não pode ser cancelado depois de retirada, recebimento ou encerramento.")
    frete.situacao = Frete.Situacao.CANCELADO
    frete.cancelado_em = timezone.now()
    frete.justificativa_cancelamento = dados["justificativa"]
    _salvar(frete)
    return {"justificativa": frete.justificativa_cancelamento}


def _tratativa(frete, autora, dados):
    return {"observacao": dados["observacao"]}


def _retirada(frete, autora, dados):
    if not frete.pode_registrar_retirada:
        raise ErroConflito("A retirada não é permitida ou já foi registrada.")
    frete.retirado_em = timezone.now()
    frete.nome_foto_retirada = dados["nome_foto"]
    _salvar(frete)
    return {"nome_foto": frete.nome_foto_retirada}


def _confirmar_entrega(frete, autora, dados):
    if not frete.pode_confirmar_entrega:
        raise ErroConflito("O recebimento não é permitido ou já foi confirmado.")
    entrega = _salvar(ConfirmacaoEntrega(frete=frete, empresa_confirmadora=autora, **dados))
    _reavaliar(frete)
    return {"entrega_id": str(entrega.pk), "tipo_recebimento": entrega.tipo_recebimento}


def _publicar_demanda(frete, autora, dados):
    if frete.situacao in (Frete.Situacao.CONCLUIDO, Frete.Situacao.CANCELADO):
        raise ErroConflito("Processo encerrado não aceita nova demanda de transporte.")
    demanda = _salvar(DemandaTransporte(frete=frete, **dados))
    return {"demanda_id": str(demanda.pk)}


COMANDOS = {
    "classificar": (contratos.SerializadorClassificacaoFrete, _classificar),
    "cotacoes": (contratos.SerializadorRegistroCotacao, _registrar_cotacao),
    "aprovar-cotacao": (contratos.SerializadorAprovacaoCotacao, _aprovar_cotacao),
    "registrar-cte": (contratos.SerializadorRegistroCTe, _registrar_cte),
    "resolver-divergencia": (contratos.SerializadorJustificativaFrete, _resolver_divergencia),
    "cancelar": (contratos.SerializadorJustificativaFrete, _cancelar),
    "tratativas": (contratos.SerializadorTratativaFrete, _tratativa),
    "retirada": (contratos.SerializadorRetiradaFrete, _retirada),
    "confirmar-entrega": (contratos.SerializadorConfirmacaoEntrega, _confirmar_entrega),
    "publicar-demanda": (contratos.SerializadorPublicacaoDemanda, _publicar_demanda),
}


@transaction.atomic
def executar_comando_frete(empresa, identificador, acao, entrada, chave_idempotencia):
    if acao not in COMANDOS:
        raise ErroRegraNegocio("Comando de frete desconhecido.")
    tipo, operacao = COMANDOS[acao]
    dados = _validar_entrada(tipo, entrada)
    autora, chave, resumo, anterior = _preparar_comando(empresa, acao, identificador, dados, chave_idempotencia)
    frete = _bloquear_frete(autora, identificador)
    if acao == "confirmar-entrega":
        exigir_confirmacao_entrega(autora, frete)
    else:
        exigir_gestao_frete(autora, frete)
    if anterior:
        return obter_frete_empresa(autora, frete.pk)
    situacao_anterior = frete.situacao
    detalhes = operacao(frete, autora, dados)
    _historico(frete, autora, acao, chave, resumo, situacao_anterior, detalhes)
    return obter_frete_empresa(autora, frete.pk)
