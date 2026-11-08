import { requisitar } from "@/services/cliente-http";
import type { CardPaymentInput, CreateOrderInput, PaymentOrder } from "@/types/payment";

/** Preserva o contrato do adaptador de pagamento, inclusive as chaves de idempotência. */
export const servicoPedidos = {
  criar(entrada: CreateOrderInput) {
    return requisitar<PaymentOrder>("/orders/", {
      method: "POST",
      headers: { "Idempotency-Key": entrada.idempotencyKey },
      body: JSON.stringify({ listingId: entrada.listing.id, quantity: entrada.quantity, buyer: entrada.buyer }),
    });
  },

  obter(id: string) {
    return requisitar<PaymentOrder>(`/orders/${encodeURIComponent(id)}/`);
  },

  async listar() {
    const resposta = await requisitar<{ items: PaymentOrder[] }>("/orders/");
    return resposta.items;
  },

  pagarComCartao(id: string, entrada: CardPaymentInput) {
    return requisitar<PaymentOrder>(`/orders/${encodeURIComponent(id)}/payments/`, {
      method: "POST",
      headers: { "Idempotency-Key": entrada.idempotencyKey },
      body: JSON.stringify({
        method: entrada.method,
        token: entrada.token,
        brand: entrada.brand,
        last4: entrada.last4,
        installments: entrada.installments,
      }),
    });
  },

  criarPix(id: string, chaveIdempotencia: string) {
    return requisitar<PaymentOrder>(`/orders/${encodeURIComponent(id)}/pix/`, {
      method: "POST",
      headers: { "Idempotency-Key": chaveIdempotencia },
      body: JSON.stringify({}),
    });
  },

  cancelar(id: string) {
    return requisitar<PaymentOrder>(`/orders/${encodeURIComponent(id)}/cancel/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  simularResultado(id: string, resultado: "paid" | "failed") {
    return requisitar<PaymentOrder>(`/orders/${encodeURIComponent(id)}/sandbox-result/`, {
      method: "POST",
      body: JSON.stringify({ result: resultado }),
    });
  },
};
