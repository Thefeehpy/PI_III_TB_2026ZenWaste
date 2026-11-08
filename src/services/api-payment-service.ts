import { servicoPedidos } from "@/services/servico-pedidos";
import type { PaymentService } from "@/types/payment";

export function createApiPaymentService(): PaymentService {
  return {
    mode: "demo",
    createOrder: servicoPedidos.criar,
    getOrder: servicoPedidos.obter,
    listOrders: servicoPedidos.listar,
    payWithCard: servicoPedidos.pagarComCartao,
    createPix: servicoPedidos.criarPix,
    cancelOrder: servicoPedidos.cancelar,
    simulateResult: servicoPedidos.simularResultado,
  };
}
