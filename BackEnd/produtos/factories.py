from decimal import Decimal
from rest_framework import serializers

class MovimentacaoBase:
    def __init__(self, produto, quantidade):
        self.produto = produto
        self.quantidade = quantidade

    def calcular_saldo(self):
        raise NotImplementedError("As subclasses devem implementar o cálculo de saldo.")

    def validar(self, saldo_resultante):
        # Validação padrão (opcional) que pode ser sobrescrita
        pass

class MovimentacaoEntrada(MovimentacaoBase):
    def calcular_saldo(self):
        return self.produto.quantidade + self.quantidade

class MovimentacaoSaida(MovimentacaoBase):
    def calcular_saldo(self):
        return self.produto.quantidade - self.quantidade

    def validar(self, saldo_resultante):
        if saldo_resultante < Decimal("0"):
            raise serializers.ValidationError({"message": "Saida maior que a quantidade disponivel."})

class MovimentacaoEstoqueFactory:
    @staticmethod
    def criar(tipo, produto, quantidade):
        estrategias = {
            "entrada": MovimentacaoEntrada,
            "saida": MovimentacaoSaida,
        }
        
        classe_movimentacao = estrategias.get(tipo)
        if not classe_movimentacao:
            raise serializers.ValidationError({"message": f"Tipo de movimentacao '{tipo}' nao suportado."})
            
        return classe_movimentacao(produto, quantidade)