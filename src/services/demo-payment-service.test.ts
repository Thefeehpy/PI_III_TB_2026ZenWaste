import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoPaymentService } from "@/services/demo-payment-service";
import { marketplaceItems } from "@/data/mockData";

const input = () => ({
  listing: marketplaceItems[0],
  quantity: 10,
  buyer: {
    name: "Empresa de teste",
    document: "11222333000181",
    email: "teste@example.com",
    phone: "11999999999",
  },
  idempotencyKey: crypto.randomUUID(),
});

describe("frontend payment lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  async function settle<T>(promise: Promise<T>) {
    await vi.advanceTimersByTimeAsync(500);
    return promise;
  }

  it("creates one order for concurrent retries and isolates orders by account", async () => {
    const service = createDemoPaymentService(crypto.randomUUID());
    const request = input();
    const [first, second] = await settle(
      Promise.all([service.createOrder(request), service.createOrder(request)]),
    );
    expect(first.id).toBe(second.id);
    expect(await settle(service.listOrders())).toHaveLength(1);
    expect(
      await settle(createDemoPaymentService("another-user").listOrders()),
    ).toEqual([]);
  });

  it("reuses a valid Pix, expires it, then generates a different code", async () => {
    const service = createDemoPaymentService(crypto.randomUUID());
    const order = await settle(service.createOrder(input()));
    const first = await settle(service.createPix(order.id, "pix-first"));
    const reused = await settle(service.createPix(order.id, "pix-retry"));
    expect(reused.pix.id).toBe(first.pix.id);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect((await settle(service.getOrder(order.id))).status).toBe("expired");
    const renewed = await settle(service.createPix(order.id, "pix-renewed"));
    expect(renewed.pix.id).not.toBe(first.pix.id);
    expect(renewed.status).toBe("pending");
    expect(renewed.pix.copyPaste).toContain("SEM-VALOR-DE-PAGAMENTO");
  });

  it("does not approve on status consultation and keeps paid orders final", async () => {
    const service = createDemoPaymentService(crypto.randomUUID());
    const order = await settle(service.createOrder(input()));
    await settle(service.createPix(order.id, "pix-pending"));
    expect((await settle(service.getOrder(order.id))).status).toBe("pending");
    expect(
      (await settle(service.simulateResult!(order.id, "paid"))).status,
    ).toBe("paid");
    expect((await settle(service.cancelOrder(order.id))).status).toBe("paid");
  });

  it("supports a declined card followed by a debit retry and stores only masked metadata", async () => {
    const scope = crypto.randomUUID();
    const service = createDemoPaymentService(scope);
    const order = await settle(service.createOrder(input()));
    const card = {
      method: "credit" as const,
      token: "demo_declined_test",
      brand: "Visa",
      last4: "4242",
      installments: 3,
      idempotencyKey: crypto.randomUUID(),
    };
    expect((await settle(service.payWithCard(order.id, card))).status).toBe(
      "failed",
    );
    const paid = await settle(
      service.payWithCard(order.id, {
        ...card,
        method: "debit",
        installments: 1,
        token: "demo_approved_test",
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    expect(paid.status).toBe("paid");
    expect(paid.installments).toBe(1);
    const saved = sessionStorage.getItem(`zenwaste.checkout.v1.${scope}`)!;
    expect(saved).not.toContain("demo_approved");
    expect(saved).not.toContain("4242424242424242");
    expect(saved).not.toContain('"cvv"');
  });

  it("keeps canceled orders closed when a payment is attempted later", async () => {
    const service = createDemoPaymentService(crypto.randomUUID());
    const order = await settle(service.createOrder(input()));
    await settle(service.cancelOrder(order.id));
    expect((await settle(service.createPix(order.id, "pix-canceled"))).status).toBe("canceled");
  });
});
