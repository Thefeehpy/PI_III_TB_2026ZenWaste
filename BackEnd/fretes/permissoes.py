"""Autorização por participação real no frete, sem depender de JWT ou DRF."""

from app.excecoes import ErroRegraNegocio


class ErroAcessoFrete(ErroRegraNegocio):
    codigo_http = 403


class ErroFreteNaoEncontrado(ErroRegraNegocio):
    codigo_http = 404


def permissoes_frete(empresa, frete):
    ativa = bool(empresa and empresa.ativo)
    return {
        "gerenciar": ativa and frete.empresa_vendedora_id == empresa.pk,
        "confirmar_entrega": ativa and frete.empresa_compradora_id == empresa.pk and frete.situacao == frete.Situacao.AGUARDANDO_ENTREGA,
    }


def exigir_gestao_frete(empresa, frete):
    if not permissoes_frete(empresa, frete)["gerenciar"]:
        raise ErroAcessoFrete("Somente a empresa vendedora pode gerenciar este frete.")


def exigir_confirmacao_entrega(empresa, frete):
    if not empresa or not empresa.ativo or frete.empresa_compradora_id != empresa.pk:
        raise ErroAcessoFrete("Somente a empresa compradora pode confirmar o recebimento.")
