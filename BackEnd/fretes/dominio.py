"""Valores e políticas da auditoria, sem consultas ou efeitos comerciais."""

from dataclasses import dataclass
from decimal import Decimal

from django.db.models import TextChoices

from fretes.validacoes import validar_valor_monetario


class SituacaoFrete(TextChoices):
    AGUARDANDO_CLASSIFICACAO = "aguardando_classificacao", "Aguardando classificação"
    EM_COTACAO = "em_cotacao", "Em cotação"
    AGUARDANDO_CONFERENCIA = "aguardando_conferencia", "Aguardando conferência"
    COM_DIVERGENCIA = "com_divergencia", "Com divergência"
    AGUARDANDO_ENTREGA = "aguardando_entrega", "Aguardando entrega"
    CONCLUIDO = "concluido", "Concluído"
    CANCELADO = "cancelado", "Cancelado"


class TipoResolucaoDivergencia(TextChoices):
    ACEITE_JUSTIFICADO = "aceite_justificado", "Aceite justificado"
    CTE_CORRIGIDO = "cte_corrigido", "CT-e corrigido"


TOLERANCIA_CONFERENCIA = Decimal("5.00")
SITUACOES_CANCELAVEIS = frozenset({
    SituacaoFrete.AGUARDANDO_CLASSIFICACAO,
    SituacaoFrete.EM_COTACAO,
    SituacaoFrete.AGUARDANDO_CONFERENCIA,
    SituacaoFrete.COM_DIVERGENCIA,
    SituacaoFrete.AGUARDANDO_ENTREGA,
})
SITUACOES_ACOMPANHAMENTO = frozenset({
    SituacaoFrete.COM_DIVERGENCIA,
    SituacaoFrete.AGUARDANDO_ENTREGA,
})


@dataclass(frozen=True)
class ConferenciaFrete:
    """Snapshot imutável: aceitar uma cobrança não altera a diferença factual."""

    valor_referencia: Decimal
    valor_cobrado: Decimal

    def __post_init__(self):
        for campo in ("valor_referencia", "valor_cobrado"):
            object.__setattr__(self, campo, validar_valor_monetario(getattr(self, campo), campo=campo))

    @property
    def diferenca(self):
        return self.valor_cobrado - self.valor_referencia

    @property
    def divergente(self):
        return abs(self.diferenca) > TOLERANCIA_CONFERENCIA


def pode_cancelar_frete(situacao, retirado_em, *, recebimento_confirmado=False):
    """A decisão deve ser reavaliada sob lock antes da escrita pelo serviço."""
    return situacao in SITUACOES_CANCELAVEIS and retirado_em is None and not recebimento_confirmado


def pode_registrar_retirada(situacao, retirado_em, *, recebimento_confirmado):
    return situacao in SITUACOES_ACOMPANHAMENTO and retirado_em is None and not recebimento_confirmado


def pode_confirmar_recebimento(situacao, *, recebimento_confirmado):
    return situacao in SITUACOES_ACOMPANHAMENTO and not recebimento_confirmado


def situacao_apos_conferencia(*, divergencia_aberta, recebimento_confirmado):
    """Destino após conferir documento ou resolver divergência em processo ativo.

    O serviço valida a origem da transição e calcula os fatos sob lock. Receber
    não encerra uma análise pendente; resolvê-la depois do recebimento conclui
    a auditoria, sem exigir outra confirmação de entrega.
    """
    if divergencia_aberta:
        return SituacaoFrete.COM_DIVERGENCIA
    if recebimento_confirmado:
        return SituacaoFrete.CONCLUIDO
    return SituacaoFrete.AGUARDANDO_ENTREGA
