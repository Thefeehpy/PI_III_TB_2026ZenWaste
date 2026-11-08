"""Consulta compromissos de estoque compartilhados pelo inventario e pelas compras.

Durante a transicao, pedidos pendentes sao a origem dos compromissos de compra.
Suas reservas vinculadas nao sao somadas novamente. Reservas manuais firmes
comprometem saldo; metas de captacao legadas representam somente demanda.
"""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone


def quantidade_comprometida(
    id_produto,
    id_anuncio=None,
    id_pedido_excluido=None,
    id_reserva_excluida=None,
    agora=None,
):
    from anuncios.models import Reserva
    from pedidos.models import Pedido

    agora = agora or timezone.now()
    pedidos = Pedido.objects.filter(
        anuncio__produto_id=id_produto,
        situacao__in=(Pedido.Situacao.AGUARDANDO_PAGAMENTO, Pedido.Situacao.PENDENTE),
        reserva_expira_em__gt=agora,
    )
    if id_anuncio is not None:
        pedidos = pedidos.filter(anuncio_id=id_anuncio)
    if id_pedido_excluido is not None:
        pedidos = pedidos.exclude(pk=id_pedido_excluido)
    total = pedidos.aggregate(total=Sum("quantidade"))["total"] or Decimal("0")

    # Reservas manuais limitam o produto globalmente, sem pertencer a cada anuncio.
    if id_anuncio is None:
        reservas = Reserva.objects.filter(
            produto_id=id_produto,
            pedido__isnull=True,
            modalidade="compromisso",
            situacao__in=("em_captacao", "pronta"),
        )
        if id_reserva_excluida is not None:
            reservas = reservas.exclude(pk=id_reserva_excluida)
        total += reservas.aggregate(total=Sum("quantidade_reservada"))["total"] or Decimal("0")
    return total
