"""Estrategias de movimentacao: calculo e validacao de dominio sem acessar o banco."""

from abc import ABC, abstractmethod
from decimal import Decimal, InvalidOperation

from app.excecoes import ErroRegraNegocio


QUANTIDADE_MAXIMA = Decimal("999999999.999")


def validar_quantidade_estoque(valor, *, permitir_zero=False):
    try:
        quantidade = Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        raise ErroRegraNegocio({"message": "Informe uma quantidade numerica valida."})
    minimo = Decimal("0") if permitir_zero else Decimal("0.001")
    if (
        not quantidade.is_finite() or quantidade < minimo or quantidade > QUANTIDADE_MAXIMA
        or quantidade != quantidade.quantize(Decimal("0.001"))
    ):
        raise ErroRegraNegocio({"message": "Quantidade fora do limite permitido ou com mais de tres casas decimais."})
    return quantidade


class PoliticaMovimentacao(ABC):
    @abstractmethod
    def calcular_saldo_resultante(self, saldo, quantidade, comprometido=Decimal("0")):
        """Retorna o saldo fisico respeitando os compromissos de estoque."""


class PoliticaEntrada(PoliticaMovimentacao):
    def calcular_saldo_resultante(self, saldo, quantidade, comprometido=Decimal("0")):
        return validar_quantidade_estoque(saldo + validar_quantidade_estoque(quantidade), permitir_zero=True)


class PoliticaSaida(PoliticaMovimentacao):
    def calcular_saldo_resultante(self, saldo, quantidade, comprometido=Decimal("0")):
        resultado = saldo - validar_quantidade_estoque(quantidade)
        if resultado < 0:
            raise ErroRegraNegocio({"message": "Saida maior que a quantidade disponivel."})
        if resultado < comprometido:
            raise ErroRegraNegocio({"message": "Esta quantidade esta comprometida por reservas ou pedidos ativos."})
        return validar_quantidade_estoque(resultado, permitir_zero=True)


def obter_politica_movimentacao(tipo_movimentacao):
    politicas = {"entrada": PoliticaEntrada, "saida": PoliticaSaida}
    try:
        return politicas[tipo_movimentacao]()
    except (KeyError, TypeError):
        raise ErroRegraNegocio({"message": "Tipo de movimentacao invalido."})
