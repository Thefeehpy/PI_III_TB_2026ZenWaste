import { afterEach, describe, expect, it, vi } from "vitest";
import { marketplaceItems } from "@/data/mockData";
import { clearAuthToken, setAuthToken } from "@/lib/api";
import { createApiPaymentService } from "@/services/api-payment-service";
import type { PaymentOrder } from "@/types/payment";

const order: PaymentOrder = {
  id: "order-id",
  number: "ZW-TEST",
  createdAt: "2026-10-19T10:00:00Z",
  item: marketplaceItems[0],
  quantity: 2,
  totalCents: 2500,
  buyer: {
    name: "Comprador",
    email: "buyer@example.com",
    document: "11222333000181",
    phone: "11999999999",
  },
  fulfillment: "pickup",
  status: "awaiting_payment",
  installments: 1,
};

describe("Django payment adapter", () => {
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it("sends only listing ID and quantity when creating an order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(order), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("signed-company-token");
    const service = createApiPaymentService();

    await service.createOrder({
      listing: marketplaceItems[0],
      quantity: 2,
      buyer: order.buyer,
      idempotencyKey: "create-key",
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/orders/");
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer signed-company-token",
    );
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe("create-key");
    expect(JSON.parse(String(options.body))).toEqual({
      listingId: marketplaceItems[0].id,
      quantity: 2,
      buyer: order.buyer,
    });
  });

  it("sends only provider token and masked card metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(order), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = createApiPaymentService();

    await service.payWithCard("order-id", {
      method: "credit",
      token: "provider-token",
      brand: "Visa",
      last4: "4242",
      installments: 1,
      idempotencyKey: "card-key",
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body));
    expect(body).toEqual({
      method: "credit",
      token: "provider-token",
      brand: "Visa",
      last4: "4242",
      installments: 1,
    });
    expect(body).not.toHaveProperty("number");
    expect(body).not.toHaveProperty("cvv");
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe("card-key");
  });
});