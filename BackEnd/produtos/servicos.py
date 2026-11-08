from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from anuncios.models import Anuncio, Reserva
from app.excecoes import ErroRegraNegocio
from autenticacao.servicos import normalizar_texto
from empresas.models import Empresa
from produtos.disponibilidade import quantidade_comprometida
from produtos.catalogos import resolver_categoria, resolver_unidade, atualizar_catalogo_produto
from produtos.models import MovimentacaoEstoque, Produto
from produtos.politicas import validar_quantidade_estoque, obter_politica_movimentacao


SITUACOES_RESERVA_ABERTA = ("em_captacao", "pronta")


def limpar_nome_estoque(nome):
    return " ".join(str(nome or "").strip().split())


def validar_nome_estoque_unico(empresa, nome, produto_atual=None):
    nome = limpar_nome_estoque(nome)
    if not nome or len(nome) > 256:
        raise ErroRegraNegocio({"message": "Informe um nome de residuo com ate 256 caracteres."})
    produtos = Produto.objects.filter(empresa=empresa)
    if produto_atual:
        produtos = produtos.exclude(pk=produto_atual.pk)
    nome_normalizado = normalizar_texto(nome)
    if any(normalizar_texto(produto_bloqueado.nome_residuo) == nome_normalizado for produto_bloqueado in produtos.only("nome_residuo")):
        raise ErroRegraNegocio({"message": "Ja existe um item cadastrado com esse nome. Use o item existente ou escolha outro nome."})


def sincronizar_situacao(produto):
    produto.atualizar_situacao()
    return produto


def _bloquear_produto(produto):
    try:
        return Produto.objects.select_for_update().get(pk=produto.pk)
    except Produto.DoesNotExist:
        raise ErroRegraNegocio({"message": "Item de estoque nao encontrado."})


def _exigir_produto_ativo(produto):
    if not produto.ativo:
        raise ErroRegraNegocio({"message": "Este item de estoque esta inativo."})


def _registrar_meta_captacao(produto, dados, *, observacao):
    meta = dados.get("targetQuantity")
    if not meta:
        return
    meta = validar_quantidade_estoque(meta)
    reserva = Reserva.objects.filter(
        produto=produto, modalidade="captacao", pedido__isnull=True,
        situacao__in=SITUACOES_RESERVA_ABERTA,
    ).order_by("data_reserva").first()
    if reserva:
        reserva.quantidade_reservada = meta
        reserva.prazo_reserva = dados.get("deadline")
        reserva.situacao = calcular_situacao_reserva(produto, meta)
        reserva.save(update_fields=["quantidade_reservada", "prazo_reserva", "situacao"])
    else:
        criar_reserva_produto(produto, {
            "quantity": meta, "unitPrice": Decimal("0"),
            "buyerName": "Reserva do cliente", "buyerPhone": "-",
            "deadline": dados.get("deadline"), "note": observacao,
        })
    produto._meta_captacao = meta
    if dados.get("deadline"):
        produto._prazo_captacao = dados["deadline"]


@transaction.atomic
def criar_item_estoque(empresa, dados):
    Empresa.objects.select_for_update().get(pk=empresa.pk)
    nome = limpar_nome_estoque(dados["name"])
    validar_nome_estoque_unico(empresa, nome)
    quantidade = validar_quantidade_estoque(dados["quantity"], permitir_zero=True)
    produto = Produto.objects.create(
        empresa=empresa, nome_residuo=nome,
        descricao_produto=(dados.get("description") or "").strip(),
        categoria=resolver_categoria(dados["type"]),
        unidade_medida=resolver_unidade(dados.get("unit") or "kg"),
        quantidade=Decimal("0"),
    )
    if quantidade:
        registrar_movimentacao_estoque(produto, empresa, {
            "type": "entrada", "quantity": quantidade, "note": "Cadastro inicial",
        })
    _registrar_meta_captacao(produto, dados, observacao="Reserva registrada no cadastro do item.")
    return produto


@transaction.atomic
def atualizar_item_estoque(produto, dados):
    # Bloquear empresa antes do produto, como na criacao, para verificar nomes duplicados.
    Empresa.objects.select_for_update().get(pk=produto.empresa_id)
    produto = _bloquear_produto(produto)
    _exigir_produto_ativo(produto)
    if "name" in dados:
        nome = limpar_nome_estoque(dados["name"])
        validar_nome_estoque_unico(produto.empresa, nome, produto_atual=produto)
        produto.nome_residuo = nome
    if "description" in dados:
        produto.descricao_produto = (dados["description"] or "").strip()
    atualizar_catalogo_produto(
        produto, nome_categoria=dados.get("type"),
        sigla_unidade=(dados.get("unit") or "kg") if "unit" in dados else None,
    )
    sincronizar_situacao(produto).save()
    _registrar_meta_captacao(produto, dados, observacao="Reserva registrada no detalhe do item.")
    return produto


@transaction.atomic
def desativar_item_estoque(produto):
    produto = _bloquear_produto(produto)
    if quantidade_comprometida(produto.pk) > 0:
        raise ErroRegraNegocio({"message": "Este item possui reservas ou pedidos ativos e nao pode ser desativado."})
    anuncios_inativados = Anuncio.objects.filter(produto=produto, situacao_anuncio="ativo").update(
        situacao_anuncio="inativo", data_final=timezone.localdate(),
    )
    produto.ativo = False
    sincronizar_situacao(produto).save(update_fields=["ativo", "situacao", "atualizado_em"])
    return anuncios_inativados


def calcular_situacao_reserva(produto, quantidade_reservada):
    disponivel = produto.quantidade - quantidade_comprometida(produto.pk)
    return "pronta" if disponivel >= quantidade_reservada else "em_captacao"


def atualizar_reservas_produto(produto):
    # Metas de captacao representam demanda e nao consomem o estoque que avaliam.
    for reserva in Reserva.objects.filter(
        produto=produto, modalidade="captacao", pedido__isnull=True,
        situacao__in=SITUACOES_RESERVA_ABERTA,
    ):
        proxima_situacao = calcular_situacao_reserva(produto, reserva.quantidade_reservada)
        if reserva.situacao != proxima_situacao:
            reserva.situacao = proxima_situacao
            reserva.save(update_fields=["situacao"])


@transaction.atomic
def criar_reserva_produto(produto, dados):
    produto = _bloquear_produto(produto)
    _exigir_produto_ativo(produto)
    quantidade = validar_quantidade_estoque(dados["quantity"])
    try:
        preco = Decimal(str(dados["unitPrice"]))
    except (InvalidOperation, TypeError, ValueError):
        raise ErroRegraNegocio({"message": "Informe um preco unitario valido."})
    if not preco.is_finite() or preco < 0 or preco > Decimal("9999999999.99") or preco != preco.quantize(Decimal("0.01")):
        raise ErroRegraNegocio({"message": "Informe um preco unitario nao negativo com ate duas casas decimais."})
    compradora = None
    if dados.get("buyerCompanyId"):
        try:
            compradora = Empresa.objects.get(pk=dados["buyerCompanyId"], ativo=True)
        except (Empresa.DoesNotExist, ValueError, TypeError):
            raise ErroRegraNegocio({"message": "Empresa compradora nao encontrada."})
        if compradora.pk == produto.empresa_id:
            raise ErroRegraNegocio({"message": "A empresa compradora deve ser diferente da empresa vendedora."})
        if quantidade > produto.quantidade - quantidade_comprometida(produto.pk):
            raise ErroRegraNegocio({"message": "Nao ha saldo disponivel suficiente para esta reserva."})
    nome_compradora = (dados.get("buyerName") or (compradora.razao_social if compradora else "")).strip()
    telefone_compradora = (dados.get("buyerPhone") or (compradora.telefone_whatsapp if compradora else "")).strip()
    if not nome_compradora or not telefone_compradora:
        raise ErroRegraNegocio({"message": "Informe nome e telefone do comprador para a captacao."})
    reserva = Reserva.objects.create(
        produto=produto, empresa_compradora=compradora,
        modalidade="compromisso" if compradora else "captacao",
        quantidade_reservada=quantidade, preco_unitario=preco,
        nome_comprador=nome_compradora, numero_comprador=telefone_compradora,
        prazo_reserva=dados.get("deadline"), observacao=(dados.get("note") or "").strip(),
        situacao="pronta" if compradora else calcular_situacao_reserva(produto, quantidade),
    )
    return reserva


@transaction.atomic
def atualizar_reserva_produto(reserva, situacao_solicitada):
    produto = _bloquear_produto(reserva.produto)
    reserva = Reserva.objects.select_for_update().get(pk=reserva.pk)
    reserva.produto = produto
    if reserva.pedido_id:
        raise ErroRegraNegocio({"message": "Reservas vinculadas a pedidos devem ser alteradas pelo fluxo do pedido."})
    if reserva.situacao in ("finalizada", "cancelada"):
        raise ErroRegraNegocio({"message": "Reservas finalizadas nao podem ser alteradas."})
    if situacao_solicitada not in (*SITUACOES_RESERVA_ABERTA, "finalizada", "cancelada"):
        raise ErroRegraNegocio({"message": "Situacao de reserva invalida."})
    if situacao_solicitada == "cancelada":
        reserva.situacao = "cancelada"
        reserva.data_finalizacao = timezone.now()
        reserva.save(update_fields=["situacao", "data_finalizacao"])
        atualizar_reservas_produto(produto)
        return reserva
    if situacao_solicitada == "finalizada":
        registrar_movimentacao_estoque(produto, produto.empresa, {
            "type": "saida", "quantity": reserva.quantidade_reservada,
            "note": f"Venda finalizada pela reserva #{reserva.pk}",
        }, id_reserva_excluida=reserva.pk)
        reserva.situacao = "finalizada"
        reserva.data_finalizacao = timezone.now()
        reserva.save(update_fields=["situacao", "data_finalizacao"])
        atualizar_reservas_produto(produto)
        return reserva
    if reserva.modalidade == "compromisso":
        reserva.situacao = "pronta"
    else:
        reserva.situacao = calcular_situacao_reserva(produto, reserva.quantidade_reservada)
    reserva.save(update_fields=["situacao"])
    return reserva


@transaction.atomic
def registrar_movimentacao_estoque(produto, empresa, dados, *, id_reserva_excluida=None):
    if not empresa or produto.empresa_id != empresa.pk:
        raise ErroRegraNegocio({"message": "Este item de estoque nao pertence ao usuario autenticado."})
    produto_bloqueado = _bloquear_produto(produto)
    if produto_bloqueado.empresa_id != empresa.pk:
        raise ErroRegraNegocio({"message": "Este item de estoque nao pertence ao usuario autenticado."})
    _exigir_produto_ativo(produto_bloqueado)
    quantidade = validar_quantidade_estoque(dados["quantity"])
    politica = obter_politica_movimentacao(dados["type"])
    comprometido = quantidade_comprometida(produto_bloqueado.pk, id_reserva_excluida=id_reserva_excluida)
    saldo = politica.calcular_saldo_resultante(produto_bloqueado.quantidade, quantidade, comprometido)
    produto_bloqueado.quantidade = saldo
    sincronizar_situacao(produto_bloqueado).save(update_fields=["quantidade", "situacao", "atualizado_em"])
    movimentacao = MovimentacaoEstoque.objects.create(
        produto=produto_bloqueado, tipo=dados["type"], quantidade=quantidade,
        observacao=dados.get("note", ""), saldo_resultante=saldo,
    )
    atualizar_reservas_produto(produto_bloqueado)
    produto.quantidade = produto_bloqueado.quantidade
    produto.situacao = produto_bloqueado.situacao
    produto.atualizado_em = produto_bloqueado.atualizado_em
    return movimentacao
