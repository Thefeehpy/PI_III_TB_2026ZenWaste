from django.db import transaction
from rest_framework import serializers
from produtos.services import register_inventory_movement, create_product_reservation

class VendaAdBuilder:
    def __init__(self, anuncio):
        self.anuncio = anuncio
        self.produto = anuncio.produto
        self.empresa = self.produto.empresa
        self.sold_quantity = None
        self.reservation_data = None
        
        self._movimento = None
        self._reserva = None

    def com_quantidade_vendida(self, quantity):
        if self.anuncio.status_anuncio != "ativo":
            raise serializers.ValidationError({"message": "Apenas anuncios ativos podem ser finalizados."})
        
        if quantity > self.produto.quantidade:
            raise serializers.ValidationError({
                "message": "A quantidade vendida nao pode ultrapassar o saldo atual do produto."
            })
            
        if quantity > self.anuncio.nr_qtd:
            raise serializers.ValidationError({
                "message": "A quantidade vendida nao pode ultrapassar a quantidade anunciada."
            })
            
        self.sold_quantity = quantity
        return self

    def adicionar_reserva(self, data):
        reservation_quantity = data.get("reservationQuantity")
        if not reservation_quantity:
            return self

        buyer_name = (data.get("buyerName") or "").strip()
        buyer_phone = (data.get("buyerPhone") or "").strip()

        if not buyer_name or not buyer_phone:
            raise serializers.ValidationError({
                "message": "Informe nome e numero do comprador para criar a reserva."
            })

        self.reservation_data = data
        return self

    @transaction.atomic
    def executar(self):
        if not self.sold_quantity:
            raise ValueError("Quantidade vendida não definida antes da execução.")

        # 1. Registrar saída no estoque
        self._movimento = register_inventory_movement(self.produto, self.empresa, {
            "type": "saida",
            "quantity": self.sold_quantity,
            "note": f"Venda finalizada pelo anuncio #{self.anuncio.id_anuncio}",
        })

        # 2. Atualizar status do Anúncio
        self.anuncio.finalizar_venda()

        # 3. Criar Reserva (Opcional)
        if self.reservation_data:
            self._reserva = create_product_reservation(self.produto, {
                "quantity": self.reservation_data["reservationQuantity"],
                "unitPrice": self.reservation_data.get("reservationUnitPrice") or self.anuncio.preco_final,
                "buyerName": self.reservation_data.get("buyerName"),
                "buyerPhone": self.reservation_data.get("buyerPhone"),
                "note": self.reservation_data.get("reservationNote", ""),
            })

        return {
            "ad": self.anuncio,
            "movement": self._movimento,
            "reservation": self._reserva,
        }
