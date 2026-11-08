"""Resolve registros normalizados de catalogo sem duplicar rotulos."""

from app.excecoes import ErroRegraNegocio
from produtos.models import CategoriaResiduo, UnidadeMedida


def _limpar_rotulo(valor, *, maximo, rotulo):
    valor = " ".join(str(valor or "").strip().split())
    if not valor or len(valor) > maximo:
        raise ErroRegraNegocio({"message": f"{rotulo} deve conter entre 1 e {maximo} caracteres."})
    return valor


def resolver_categoria(nome):
    nome = _limpar_rotulo(nome, maximo=50, rotulo="A categoria")
    categoria, _ = CategoriaResiduo.objects.get_or_create(
        nome_material__iexact=nome, defaults={"nome_material": nome},
    )
    if not categoria.ativo:
        raise ErroRegraNegocio({"message": "A categoria selecionada esta inativa."})
    return categoria


def resolver_unidade(sigla, descricao=None):
    sigla = _limpar_rotulo(sigla or "kg", maximo=12, rotulo="A unidade").lower()
    descricoes = {"kg": "quilograma", "t": "tonelada", "un": "unidade", "l": "litro", "m3": "metro cubico"}
    unidade, _ = UnidadeMedida.objects.get_or_create(
        sigla__iexact=sigla,
        defaults={"sigla": sigla, "descricao": descricao or descricoes.get(sigla, sigla)},
    )
    if not unidade.ativo:
        raise ErroRegraNegocio({"message": "A unidade selecionada esta inativa."})
    return unidade


def atualizar_catalogo_produto(produto, *, nome_categoria=None, sigla_unidade=None):
    """Altera um produto bloqueado; o servico chamador realiza a persistencia."""
    if nome_categoria is not None:
        produto.categoria = resolver_categoria(nome_categoria)
    if sigla_unidade is not None:
        unidade = resolver_unidade(sigla_unidade)
        if unidade.pk != produto.unidade_medida_id and (
            produto.movimentacoes.exists() or produto.reservas.exists() or produto.anuncios.exists()
        ):
            raise ErroRegraNegocio({"message": "A unidade de um produto com historico nao pode ser alterada."})
        produto.unidade_medida = unidade
