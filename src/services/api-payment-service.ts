import { api } from "@/lib/api";
import type { PaymentService } from "@/types/payment";

export function createApiPaymentService(): PaymentService {
  return {
    mode: "demo",
    createOrder: api.createOrder,
    getOrder: api.getOrder,
    listOrders: api.listOrders,
    payWithCard: api.payOrderWithCard,
    createPix: (id, idempotencyKey) => api.createOrderPix(id, idempotencyKey),
    cancelOrder: api.cancelOrder,
    simulateResult: api.simulateOrderResult,
  };
}