import { calculateTotal, isFinalStatus, validateBuyer } from "@/lib/payment";
import type { PaymentOrder, PaymentService } from "@/types/payment";

const wait = () => new Promise((resolve) => setTimeout(resolve, 450));
const memory = new Map<string, StoredOrder[]>();
interface StoredOrder {
  order: PaymentOrder;
  creationKey: string;
  paymentKey?: string;
}

/** Session-scoped, frontend-only demonstration. No payment, stock update or real Pix is made. */
export function createDemoPaymentService(scope: string): PaymentService {
  const storageKey = `zenwaste.checkout.v1.${encodeURIComponent(scope)}`;
  const read = (): StoredOrder[] => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored: unknown = raw
        ? JSON.parse(raw)
        : (memory.get(storageKey) ?? []);
      if (!Array.isArray(stored)) return [];
      return stored.filter((entry): entry is StoredOrder =>
        Boolean(
          entry?.order?.id &&
          entry.order.item &&
          entry.order.buyer &&
          Number.isSafeInteger(entry.order.totalCents),
        ),
      );
    } catch {
      return memory.get(storageKey) ?? [];
    }
  };
  const write = (records: StoredOrder[]) => {
    memory.set(storageKey, records);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      /* Retain the current session in memory if browser storage is unavailable. */
    }
  };
  const normalized = (order: PaymentOrder): PaymentOrder =>
    order.status === "pending" &&
    order.method === "pix" &&
    order.pix &&
    Date.parse(order.pix.expiresAt) <= Date.now()
      ? { ...order, status: "expired" }
      : order;
  const find = (id: string) => {
    const entry = read().find((record) => record.order.id === id);
    if (!entry)
      throw new Error(
        "Este pedido não foi encontrado nesta sessão. Volte ao marketplace para começar uma compra.",
      );
    return normalized(entry.order);
  };
  const update = (
    id: string,
    change: (order: PaymentOrder) => PaymentOrder,
    paymentKey?: string,
  ) => {
    const records = read();
    const index = records.findIndex((record) => record.order.id === id);
    if (index < 0) return find(id);
    const current = normalized(records[index].order);
    if (isFinalStatus(current.status)) return current;
    const order = change(current);
    records[index] = {
      ...records[index],
      order,
      ...(paymentKey ? { paymentKey } : {}),
    };
    write(records);
    return order;
  };

  return {
    mode: "demo",
    async createOrder(input) {
      await wait();
      const records = read();
      const previous = records.find(
        (record) => record.creationKey === input.idempotencyKey,
      );
      if (previous) return normalized(previous.order);
      const { listing, quantity, buyer } = input;
      const totalCents = calculateTotal(listing.price, quantity);
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > listing.quantity ||
        !Number.isSafeInteger(totalCents) ||
        totalCents <= 0
      ) {
        throw new Error(
          "Confira a quantidade e o valor do material antes de continuar.",
        );
      }
      if (Object.keys(validateBuyer(buyer)).length)
        throw new Error("Confira os dados do comprador.");
      const id = crypto.randomUUID();
      const order: PaymentOrder = {
        id,
        number: `ZW-${id.slice(0, 8).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        item: { ...listing },
        quantity,
        totalCents,
        buyer: { ...buyer },
        fulfillment: "pickup",
        status: "awaiting_payment",
        installments: 1,
      };
      write([{ order, creationKey: input.idempotencyKey }, ...records]);
      return order;
    },
    async getOrder(id) {
      await wait();
      return find(id);
    },
    async listOrders() {
      await wait();
      return read().map(({ order }) => normalized(order));
    },
    async payWithCard(id, input) {
      await wait();
      const entry = read().find((record) => record.order.id === id);
      if (entry?.paymentKey === input.idempotencyKey) return find(id);
      if (!input.token.startsWith("demo_"))
        throw new Error("A demonstração aceita apenas tokens de teste.");
      if (
        input.installments < 1 ||
        input.installments > 12 ||
        (input.method === "debit" && input.installments !== 1)
      )
        throw new Error("Confira o parcelamento escolhido.");
      return update(
        id,
        (order) => ({
          ...order,
          method: input.method,
          installments: input.installments,
          status: input.token.startsWith("demo_declined_") ? "failed" : "paid",
          paidAt: input.token.startsWith("demo_declined_")
            ? undefined
            : new Date().toISOString(),
          card: { brand: input.brand, last4: input.last4 },
          pix: undefined,
        }),
        input.idempotencyKey,
      );
    },
    async createPix(id) {
      await wait();
      return update(id, (order) => {
        if (order.status === "pending" && order.method === "pix") return order;
        const pixId = crypto.randomUUID();
        return {
          ...order,
          method: "pix",
          status: "pending",
          installments: 1,
          card: undefined,
          pix: {
            id: pixId,
            // Deliberately NOT a bank payment payload. The real backend must supply the provider's exact BR Code.
            copyPaste: `ZENWASTE|PIX-DEMONSTRACAO|SEM-VALOR-DE-PAGAMENTO|${pixId}|BRL:${(order.totalCents / 100).toFixed(2)}`,
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          },
        };
      });
    },
    async cancelOrder(id) {
      await wait();
      return update(id, (order) => ({
        ...order,
        status: "canceled",
        pix: undefined,
      }));
    },
    async simulateResult(id, result) {
      await wait();
      return update(id, (order) => {
        if (order.status === "expired")
          throw new Error(
            "Este código expirou. Gere um novo Pix para continuar.",
          );
        return {
          ...order,
          status: result,
          ...(result === "paid" ? { paidAt: new Date().toISOString() } : {}),
        };
      });
    },
  };
}
