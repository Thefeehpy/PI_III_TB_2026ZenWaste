"""Consultas compartilhadas da auditoria, sempre limitadas à participação da empresa."""

from decimal import Decimal

from django.db.models import DecimalField, F, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce

from empresas.models import Empresa, PapelEmpresa
from pedidos.models import Pedido

from fretes.models import CotacaoFrete, Frete, HistoricoFrete
from fretes.permissoes import ErroFreteNaoEncontrado


def condicao_remessa_alocada(prefixo=""):
    return ~Q(**{prefixo + "situacao": Frete.Situacao.CANCELADO}) | Q(**{prefixo + "retirado_em__isnull": False}) | Q(**{prefixo + "entrega__isnull": False})


def quantidade_alocada_pedido(pedido):
    return Frete.objects.filter(pedido=pedido).filter(condicao_remessa_alocada()).aggregate(total=Sum("quantidade"))["total"] or Decimal("0.000")


def listar_fretes_empresa(empresa):
    consulta = Frete.objects.all()
    if not empresa or not empresa.ativo:
        return consulta.none()
    consulta = consulta.filter(
        Q(empresa_vendedora=empresa) | Q(empresa_compradora=empresa)
        | Q(transportadora=empresa) | Q(cotacoes__transportadora=empresa),
    ).distinct()
    return consulta.select_related("pedido", "empresa_vendedora", "empresa_compradora", "transportadora", "entrega", "entrega__empresa_confirmadora").prefetch_related(
        Prefetch("cotacoes", queryset=CotacaoFrete.objects.select_related("transportadora")),
        "documentos", "divergencias", "divergencias__empresa_resolvedora", "demandas",
        Prefetch("historico", queryset=HistoricoFrete.objects.select_related("autora")),
    )


def obter_frete_empresa(empresa, identificador):
    try:
        return listar_fretes_empresa(empresa).get(pk=identificador)
    except (Frete.DoesNotExist, ValueError, TypeError) as erro:
        raise ErroFreteNaoEncontrado("Frete não encontrado para esta empresa.") from erro


def listar_pedidos_disponiveis(empresa):
    consulta = Pedido.objects.filter(anuncio__produto__empresa=empresa).exclude(
        situacao__in=(Pedido.Situacao.CANCELADO, Pedido.Situacao.EXPIRADO),
    )
    if not empresa or not empresa.ativo:
        return consulta.none()
    campo_decimal = DecimalField(max_digits=12, decimal_places=3)
    return consulta.select_related("empresa_compradora", "anuncio", "anuncio__produto", "anuncio__produto__empresa").annotate(
        quantidade_alocada=Coalesce(
            Sum("fretes__quantidade", filter=condicao_remessa_alocada("fretes__")),
            Value(Decimal("0.000")), output_field=campo_decimal,
        ),
    ).annotate(
        quantidade_disponivel_frete=F("quantidade") - F("quantidade_alocada"),
    ).filter(quantidade_disponivel_frete__gt=0).order_by("-criado_em", "-id")


def listar_transportadoras():
    return Empresa.objects.filter(ativo=True, papeis__codigo=PapelEmpresa.Codigo.TRANSPORTADORA).distinct().order_by("razao_social", "id_empresa")
