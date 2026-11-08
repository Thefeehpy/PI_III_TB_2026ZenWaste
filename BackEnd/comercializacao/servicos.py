"""Casos de uso de comercializacao; escritas passam por servicos transacionais."""
from django.db import transaction
from django.utils import timezone

from anuncios.imagens import normalizar_imagens, validar_valor_imagem
from anuncios.models import Anuncio, ImagemAnuncio
from app.excecoes import ErroRegraNegocio
from produtos.disponibilidade import quantidade_comprometida
from produtos.consultas import carregar_saldos
from produtos.catalogos import resolver_categoria, resolver_unidade, atualizar_catalogo_produto
from empresas.models import Empresa
from produtos.models import Produto
from produtos.servicos import (
    limpar_nome_estoque, criar_reserva_produto,
    registrar_movimentacao_estoque, validar_nome_estoque_unico,
)


def _anuncios_com_detalhes(consulta):
    return consulta.select_related(
        "produto", "produto__empresa", "produto__categoria", "produto__unidade_medida",
    ).prefetch_related("imagens")


def _bloquear_anuncio_produto(anuncio):
    # Servicos de estoque tambem bloqueiam o produto antes dos anuncios.
    produto = Produto.objects.select_for_update().get(pk=anuncio.produto_id)
    anuncio = Anuncio.objects.select_for_update().get(pk=anuncio.pk, produto=produto)
    anuncio.produto = produto
    return anuncio, produto


def listar_anuncios_ativos(filtros):
    anuncios = Anuncio.objects.filter(
        situacao_anuncio="ativo", produto__ativo=True, produto__empresa__ativo=True,
    )
    if filtros.get("type"):
        anuncios = anuncios.filter(produto__categoria__nome_material__icontains=filtros["type"])
    if filtros.get("location"):
        anuncios = anuncios.filter(localizacao__icontains=filtros["location"])
    if filtros.get("minPrice"):
        anuncios = anuncios.filter(preco_final__gte=filtros["minPrice"])
    if filtros.get("maxPrice"):
        anuncios = anuncios.filter(preco_final__lte=filtros["maxPrice"])
    return _anuncios_com_detalhes(anuncios).order_by("-data_publicacao")


def resolver_produto_anuncio(empresa, dados):
    id_estoque = dados.get("inventoryId")
    if id_estoque:
        try:
            produto = Produto.objects.select_for_update().get(pk=id_estoque, empresa=empresa, ativo=True)
        except (Produto.DoesNotExist, ValueError, TypeError) as erro:
            raise ErroRegraNegocio({"message": "Item de estoque nao encontrado para esta empresa."}) from erro
        nome = limpar_nome_estoque(dados["name"])
        validar_nome_estoque_unico(empresa, nome, produto_atual=produto)
        atualizar_catalogo_produto(produto, nome_categoria=dados["type"], sigla_unidade=dados.get("unit"))
        produto.nome_residuo = nome
        if dados["quantity"] > produto.quantidade:
            raise ErroRegraNegocio({"message": "A quantidade anunciada nao pode ultrapassar o saldo atual do produto."})
        produto.save()
        return produto

    nome = limpar_nome_estoque(dados["name"])
    validar_nome_estoque_unico(empresa, nome)
    produto = Produto.objects.create(
        empresa=empresa, nome_residuo=nome,
        # A descricao da oferta pertence ao anuncio, nao ao cadastro do material.
        descricao_produto="",
        categoria=resolver_categoria(dados["type"]),
        unidade_medida=resolver_unidade(dados.get("unit") or "kg"), quantidade=0,
    )
    if dados["quantity"] > 0:
        registrar_movimentacao_estoque(produto, empresa, {
            "type": "entrada", "quantity": dados["quantity"], "note": "Cadastro inicial via anuncio",
        })
    return produto


def _substituir_imagens(anuncio, dados):
    if "images" in dados and "imageUrl" in dados:
        raise ErroRegraNegocio({"message": "Envie images ou imageUrl, sem combinar os dois campos."})
    if "images" in dados:
        imagens = normalizar_imagens(dados["images"])
    elif "imageUrl" in dados:
        valor = validar_valor_imagem(dados["imageUrl"])
        imagens = [{"url": valor, "isCover": True, "order": 0}] if valor else []
    else:
        return
    anuncio.imagens.all().delete()
    ImagemAnuncio.objects.bulk_create([
        ImagemAnuncio(anuncio=anuncio, url_arquivo=imagem["url"], eh_capa=imagem["isCover"], ordem=imagem["order"])
        for imagem in imagens
    ])
    # Descarta a colecao em cache para nao retornar imagens antigas.
    getattr(anuncio, "_prefetched_objects_cache", {}).pop("imagens", None)


@transaction.atomic
def criar_anuncio(empresa, dados):
    empresa = Empresa.objects.select_for_update().get(pk=empresa.pk)
    if not empresa.ativo:
        raise ErroRegraNegocio({"message": "Empresa inativa nao pode publicar anuncios."})
    produto = resolver_produto_anuncio(empresa, dados)
    anuncio = Anuncio.objects.create(
        produto=produto, preco_final=dados["price"],
        descricao_especifica=(dados.get("description") or "").strip(),
        nr_qtd=dados["quantity"], localizacao=(dados.get("location") or "").strip(),
    )
    _substituir_imagens(anuncio, dados)
    return anuncio


@transaction.atomic
def atualizar_anuncio(anuncio, dados):
    anuncio, produto = _bloquear_anuncio_produto(anuncio)
    if not produto.ativo or not produto.empresa.ativo:
        raise ErroRegraNegocio({"message": "Este produto ou empresa esta inativo."})
    if "quantity" in dados:
        if dados["quantity"] > produto.quantidade:
            raise ErroRegraNegocio({"message": "A quantidade anunciada nao pode ultrapassar o saldo atual do produto."})
        if dados["quantity"] < quantidade_comprometida(produto.pk, id_anuncio=anuncio.pk):
            raise ErroRegraNegocio({"message": "A quantidade do anuncio nao pode ficar abaixo dos pedidos reservados."})
    if "name" in dados:
        nome = limpar_nome_estoque(dados["name"])
        validar_nome_estoque_unico(produto.empresa, nome, produto_atual=produto)
        produto.nome_residuo = nome
    atualizar_catalogo_produto(produto, nome_categoria=dados.get("type"), sigla_unidade=dados.get("unit"))
    produto.save()
    for campo_requisicao, campo_modelo in {
        "description": "descricao_especifica", "quantity": "nr_qtd",
        "price": "preco_final", "location": "localizacao",
    }.items():
        if campo_requisicao in dados:
            setattr(anuncio, campo_modelo, dados[campo_requisicao])
    anuncio.save()
    _substituir_imagens(anuncio, dados)
    return anuncio


def listar_anuncios_vendedor(empresa):
    return carregar_saldos(
        _anuncios_com_detalhes(Anuncio.objects.filter(produto__empresa=empresa)).order_by("-data_publicacao"),
        prefixo_produto="produto",
    )


@transaction.atomic
def inativar_anuncio(anuncio):
    anuncio, produto = _bloquear_anuncio_produto(anuncio)
    if quantidade_comprometida(produto.pk, id_anuncio=anuncio.pk) > 0:
        raise ErroRegraNegocio({"message": "Este anuncio possui pedidos reservados e nao pode ser inativado."})
    anuncio.situacao_anuncio = Anuncio.Situacao.INATIVO
    anuncio.data_final = timezone.localdate()
    anuncio.save(update_fields=["situacao_anuncio", "data_final"])
    return anuncio


@transaction.atomic
def finalizar_venda_anuncio(anuncio, dados):
    anuncio, produto = _bloquear_anuncio_produto(anuncio)
    quantidade_vendida = dados["soldQuantity"]
    if quantidade_comprometida(produto.pk, id_anuncio=anuncio.pk) > 0:
        raise ErroRegraNegocio({"message": "Este anuncio possui pedidos aguardando pagamento e nao pode ser finalizado manualmente."})
    if anuncio.situacao_anuncio != "ativo" or not produto.ativo:
        raise ErroRegraNegocio({"message": "Apenas anuncios ativos podem ser finalizados."})
    if quantidade_vendida > produto.quantidade:
        raise ErroRegraNegocio({"message": "A quantidade vendida nao pode ultrapassar o saldo atual do produto."})
    if quantidade_vendida > anuncio.nr_qtd:
        raise ErroRegraNegocio({"message": "A quantidade vendida nao pode ultrapassar a quantidade anunciada."})
    movimento = registrar_movimentacao_estoque(produto, produto.empresa, {
        "type": "saida", "quantity": quantidade_vendida,
        "note": f"Venda finalizada pelo anuncio #{anuncio.id_anuncio}",
    })
    anuncio.nr_qtd -= quantidade_vendida
    if anuncio.nr_qtd == 0:
        anuncio.situacao_anuncio = Anuncio.Situacao.VENDIDO
        anuncio.data_final = timezone.localdate()
    anuncio.save(update_fields=["nr_qtd", "situacao_anuncio", "data_final"])
    reserva = None
    if dados.get("reservationQuantity"):
        dados_reserva = {
            "quantity": dados["reservationQuantity"],
            "unitPrice": dados.get("reservationUnitPrice") if dados.get("reservationUnitPrice") is not None else anuncio.preco_final,
            "buyerName": (dados.get("buyerName") or "").strip(),
            "buyerPhone": (dados.get("buyerPhone") or "").strip(),
            "note": dados.get("reservationNote", ""),
        }
        if dados.get("buyerCompanyId"):
            dados_reserva["buyerCompanyId"] = dados["buyerCompanyId"]
        reserva = criar_reserva_produto(produto, dados_reserva)
    return {"ad": anuncio, "movement": movimento, "reservation": reserva}
