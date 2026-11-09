"""Pré-preenchimento informativo em leitura, a partir da gestão comercial atual.

Somente a vendedora gestora consulta esta projeção interna. Isso não a habilita
como gerador ambiental nem identifica pessoa/unidade autorizada no SIGOR.
"""

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.utils import timezone

from empresas.models import Empresa
from fretes.consultas import obter_frete_empresa
from fretes.permissoes import ErroAcessoFrete, exigir_gestao_frete
from produtos.models import UnidadeMedida

from mtr.dominio import CampoPreenchimento, ErroValidacaoMTR, PendenciaMTR, PrePreenchimentoMTR, SituacaoInformacao, TipoPendencia
from mtr.validacoes import unidade_comercial_reconhecida, validar_quantidade_comercial


def consultar_pre_preenchimento(empresa_id, frete_id):
    try:
        empresa = Empresa.objects.get(pk=empresa_id, ativo=True)
    except (Empresa.DoesNotExist, ValueError, TypeError, ValidationError):
        raise ErroAcessoFrete("Empresa ativa autenticada obrigatória para esta leitura.") from None
    frete = obter_frete_empresa(empresa, frete_id)
    exigir_gestao_frete(empresa, frete)
    pedido = frete.pedido
    anuncio = pedido.anuncio if pedido else None
    produto = anuncio.produto if anuncio else None
    reserva = None
    if pedido:
        if pedido.empresa_compradora_id != frete.empresa_compradora_id or produto.empresa_id != frete.empresa_vendedora_id:
            raise ErroValidacaoMTR("relacao_comercial_inconsistente", "Relações de pedido, partes e produto precisam de revisão.", tipo=TipoPendencia.ERRO_INTERNO)
        try:
            reserva = pedido.reserva
        except ObjectDoesNotExist:
            pass
        if reserva and (reserva.produto_id != produto.pk or reserva.empresa_compradora_id != pedido.empresa_compradora_id):
            raise ErroValidacaoMTR("reserva_inconsistente", "Reserva vinculada não corresponde ao pedido.", tipo=TipoPendencia.ERRO_INTERNO)
        if frete.unidade.casefold() != pedido.unidade_material_negociado.casefold():
            raise ErroValidacaoMTR("unidade_inconsistente", "Unidade da remessa difere do snapshot negociado.", tipo=TipoPendencia.ERRO_INTERNO)
    campos = []

    def adicionar(nome, valor, fonte=None, entidade=None, *, situacao=None, pendencia=None, humano=False):
        if valor == "":
            valor = None
        estado = situacao or (SituacaoInformacao.DISPONIVEL if valor is not None else SituacaoInformacao.AUSENTE)
        pendencias = (pendencia,) if pendencia else ()
        if valor is None and not pendencias:
            pendencias = (PendenciaMTR("dado_ausente", "Informação não cadastrada nesta origem comercial.", TipoPendencia.AUSENCIA),)
        campos.append(CampoPreenchimento(nome, valor, fonte, str(entidade.pk) if entidade else None, estado, pendencias, humano))

    def texto_comercial(nome, valor, fonte):
        adicionar(nome, valor, fonte, frete, situacao=SituacaoInformacao.INSUFICIENTE if valor else SituacaoInformacao.AUSENTE,
                  pendencia=PendenciaMTR("local_comercial_nao_oficial", "Texto comercial não identifica unidade SIGOR.", TipoPendencia.VALIDACAO_OFICIAL), humano=True)

    adicionar("empresa_vendedora", frete.empresa_vendedora.razao_social, "Empresa.razao_social", frete.empresa_vendedora)
    adicionar("cnpj_vendedora", frete.empresa_vendedora.cnpj, "Empresa.cnpj", frete.empresa_vendedora)
    adicionar("empresa_compradora", frete.empresa_compradora.razao_social, "Empresa.razao_social", frete.empresa_compradora)
    adicionar("cnpj_compradora", frete.empresa_compradora.cnpj, "Empresa.cnpj", frete.empresa_compradora)
    adicionar("empresa_transportadora", frete.transportadora.razao_social if frete.transportadora else None, "Frete.transportadora", frete.transportadora)
    adicionar("cnpj_transportadora", frete.transportadora.cnpj if frete.transportadora else None, "Empresa.cnpj", frete.transportadora)
    adicionar("material_comercial", frete.material, "Frete.material", frete)
    adicionar("descricao_negociada", pedido.descricao_material_negociado if pedido else None, "Pedido.descricao_material_negociado", pedido)
    adicionar("descricao_produto", produto.descricao_produto if produto else None, "Produto.descricao_produto", produto)
    adicionar("categoria_comercial", produto.categoria.nome_material if produto else None, "CategoriaResiduo.nome_material", produto.categoria if produto else None)
    unidade_conhecida = unidade_comercial_reconhecida(frete.unidade, UnidadeMedida.objects.filter(ativo=True).values_list("sigla", flat=True))
    adicionar("unidade_comercial", frete.unidade, "Frete.unidade", frete,
              situacao=SituacaoInformacao.DISPONIVEL if unidade_conhecida else SituacaoInformacao.INSUFICIENTE,
              pendencia=None if unidade_conhecida else PendenciaMTR("unidade_nao_reconhecida", "Sigla não consta no catálogo comercial ativo; não converter automaticamente.", TipoPendencia.REVISAO), humano=not unidade_conhecida)
    for nome, valor, fonte, origem, zero in (
        ("quantidade_remessa", frete.quantidade, "Frete.quantidade", frete, False),
        ("quantidade_negociada", pedido.quantidade if pedido else None, "Pedido.quantidade", pedido, False),
        ("quantidade_ofertada", anuncio.nr_qtd if anuncio else None, "Anuncio.nr_qtd", anuncio, True),
        ("quantidade_reservada", reserva.quantidade_reservada if reserva else None, "Reserva.quantidade_reservada", reserva, False),
        ("saldo_fisico_comercial", produto.quantidade if produto else None, "Produto.quantidade", produto, True),
    ):
        adicionar(nome, validar_quantidade_comercial(valor, permitir_zero=zero) if valor is not None else None, fonte, origem)
    texto_comercial("origem_comercial", frete.origem, "Frete.origem")
    texto_comercial("destino_comercial", frete.destino, "Frete.destino")
    adicionar("localizacao_anuncio", anuncio.localizacao if anuncio else None, "Anuncio.localizacao", anuncio,
              situacao=SituacaoInformacao.INSUFICIENTE if anuncio and anuncio.localizacao else SituacaoInformacao.AUSENTE, humano=True)
    for nome, valor, fonte in (
        ("modalidade_comercial", frete.modalidade, "Frete.modalidade"),
        ("data_referencia_comercial", frete.data_pedido, "Frete.data_pedido"),
        ("previsao_entrega_comercial", frete.previsao_entrega, "Frete.previsao_entrega"),
        ("retirada_registrada_em", frete.retirado_em, "Frete.retirado_em"),
    ):
        adicionar(nome, valor, fonte, frete)
    for nome, motivo, tipo in (
        ("unidade_geradora_sigor", "Selecionar unidade geradora real; vendedora comercial não comprova habilitação.", TipoPendencia.VALIDACAO_OFICIAL),
        ("destinador", "Selecionar destinador autorizado; não inferir da compradora.", TipoPendencia.VALIDACAO_OFICIAL),
        ("unidade_transportadora_sigor", "Papel comercial não comprova cadastro de unidade SIGOR.", TipoPendencia.VALIDACAO_OFICIAL),
        ("codigo_ibama_aprovado", "Classificação depende de catálogo oficial e contexto de origem/processo.", TipoPendencia.VALIDACAO_OFICIAL),
        ("quantidade_expedida", "Confirmar quantidade real; saldo e remessa não são pesagem de expedição.", TipoPendencia.REVISAO),
        ("quantidade_recebida", "Conferência no destino é independente da quantidade negociada.", TipoPendencia.REVISAO),
        ("data_expedicao_prevista", "Referência comercial, previsão de entrega e registro de retirada não definem expedição prevista.", TipoPendencia.REVISAO),
        ("responsavel_ambiental", "Identidade empresarial atual não identifica operador individual autorizado.", TipoPendencia.VALIDACAO_OFICIAL),
    ):
        adicionar(nome, None, situacao=SituacaoInformacao.NAO_INFERIR, pendencia=PendenciaMTR(nome+"_pendente", motivo, tipo), humano=True)
    return PrePreenchimentoMTR(str(frete.pk), empresa.pk, timezone.now(), tuple(campos))
