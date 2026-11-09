"""Objetos de leitura e erros internos, sem ORM, HTTP ou autorização ambiental."""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum


class TipoPendencia(StrEnum):
    AUSENCIA = "ausencia"
    REVISAO = "revisao"
    VALIDACAO_OFICIAL = "validacao_oficial"
    ERRO_INTERNO = "erro_interno"


class SituacaoInformacao(StrEnum):
    DISPONIVEL = "disponivel"
    AUSENTE = "ausente"
    INSUFICIENTE = "insuficiente"
    CONFIRMACAO_HUMANA = "confirmacao_humana"
    FONTE_OFICIAL = "fonte_oficial"
    NAO_INFERIR = "nao_inferir"


class ErroValidacaoMTR(ValueError):
    def __init__(self, codigo, mensagem, *, campo=None, tipo=TipoPendencia.REVISAO):
        self.codigo = codigo
        self.campo = campo
        self.tipo = tipo
        super().__init__(mensagem)


@dataclass(frozen=True)
class PendenciaMTR:
    codigo: str
    mensagem: str
    tipo: TipoPendencia


ValorInformacao = str | int | Decimal | date | datetime | None


@dataclass(frozen=True)
class CampoPreenchimento:
    campo: str
    valor: ValorInformacao
    fonte: str | None
    identificador_origem: str | None
    situacao: SituacaoInformacao
    pendencias: tuple[PendenciaMTR, ...] = ()
    requer_validacao_humana: bool = False

    def __post_init__(self):
        if not self.campo or not isinstance(self.situacao, SituacaoInformacao):
            raise ErroValidacaoMTR("estrutura_invalida", "Campo sem identificação ou situação válida.", tipo=TipoPendencia.ERRO_INTERNO)
        if self.valor is not None and (isinstance(self.valor, bool) or not isinstance(self.valor, (str, int, Decimal, date))):
            raise ErroValidacaoMTR("valor_invalido", "Tipo não admitido na informação de leitura.", campo=self.campo)
        if not isinstance(self.pendencias, tuple) or not all(isinstance(p, PendenciaMTR) for p in self.pendencias):
            raise ErroValidacaoMTR("pendencias_invalidas", "Use pendências tipadas e imutáveis.")
        if self.situacao == SituacaoInformacao.DISPONIVEL and self.valor is None:
            raise ErroValidacaoMTR("valor_ausente", "Informação disponível exige valor.", tipo=TipoPendencia.ERRO_INTERNO)
        if self.situacao in (SituacaoInformacao.AUSENTE, SituacaoInformacao.NAO_INFERIR) and self.valor is not None:
            raise ErroValidacaoMTR("inferencia_indevida", "Não atribua valor a uma informação ausente/não inferível.")


@dataclass(frozen=True)
class PrePreenchimentoMTR:
    frete_id: str
    empresa_consultante_id: int
    lido_em: datetime
    campos: tuple[CampoPreenchimento, ...]

    def __post_init__(self):
        if not isinstance(self.campos, tuple) or not all(isinstance(c, CampoPreenchimento) for c in self.campos):
            raise ErroValidacaoMTR("estrutura_invalida", "Use uma coleção imutável de campos tipados.")
        nomes = [c.campo for c in self.campos]
        if len(nomes) != len(set(nomes)):
            raise ErroValidacaoMTR("campo_duplicado", "Campos de pré-preenchimento devem ser únicos.", tipo=TipoPendencia.ERRO_INTERNO)

    def obter(self, campo):
        for informacao in self.campos:
            if informacao.campo == campo:
                return informacao
        raise KeyError(campo)

    @property
    def pendencias(self):
        return tuple(p for c in self.campos for p in c.pendencias)
