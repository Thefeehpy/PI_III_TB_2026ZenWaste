"""Carregamento de saldos para leitura, sem reutilizar caches nas escritas transacionais."""
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone

from anuncios.models import Anuncio, Reserva
from pedidos.models import Pedido
from produtos.disponibilidade import quantidade_comprometida


def carregar_saldos(consulta, *, prefixo_produto=""):
    prefixo = f"{prefixo_produto}__" if prefixo_produto else ""
    pedidos = Pedido.objects.filter(
        situacao__in=(Pedido.Situacao.AGUARDANDO_PAGAMENTO, Pedido.Situacao.PENDENTE),
        reserva_expira_em__gt=timezone.now(),
    )
    anuncios = Anuncio.objects.prefetch_related(
        Prefetch("pedidos", queryset=pedidos, to_attr="_pedidos_para_saldo"),
    )
    reservas = Reserva.objects.filter(
        situacao__in=("em_captacao", "pronta"),
    ).order_by("data_reserva")
    return consulta.prefetch_related(
        Prefetch(f"{prefixo}anuncios", queryset=anuncios, to_attr="_anuncios_para_saldo"),
        Prefetch(f"{prefixo}reservas", queryset=reservas, to_attr="_reservas_para_saldo"),
    )


def quantidade_comprometida_carregada(produto, *, id_anuncio=None):
    if not hasattr(produto, "_anuncios_para_saldo"):
        return quantidade_comprometida(produto.pk, id_anuncio=id_anuncio)
    total = sum(
        (
            pedido.quantidade
            for anuncio in produto._anuncios_para_saldo
            if id_anuncio is None or anuncio.pk == id_anuncio
            for pedido in anuncio._pedidos_para_saldo
        ),
        Decimal("0"),
    )
    if id_anuncio is None:
        total += sum(
            (
                reserva.quantidade_reservada
                for reserva in produto._reservas_para_saldo
                if reserva.modalidade == "compromisso" and reserva.pedido_id is None
            ),
            Decimal("0"),
        )
    return total

