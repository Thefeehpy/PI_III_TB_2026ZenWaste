import { afterEach, describe, expect, it, vi } from "vitest";
import { marketplaceItems } from "@/test/fixtures/anuncios";
import { removerTokenAutenticacao, armazenarTokenAutenticacao } from "@/services/cliente-http";
import { createApiPaymentService } from "@/services/api-payment-service";
import type { PaymentOrder } from "@/types/payment";
import { empresaR1, promessaControlada } from "@/test/fixtures/acesso";

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
  it("não entrega resultado de criação à sessão que substituiu a autora", async () => {
    armazenarTokenAutenticacao("sessao-a");
    const resposta = promessaControlada<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(resposta.promessa));
    const operacao = createApiPaymentService(empresaR1).createOrder({
      listing: marketplaceItems[0], quantity: 1, buyer: order.buyer, idempotencyKey: "teste-tardio",
    });
    armazenarTokenAutenticacao("sessao-b");
    resposta.resolver(new Response(JSON.stringify(order), { status: 201 }));
    await expect(operacao).rejects.toMatchObject({ status: 409 });
  });
  afterEach(() => {
    removerTokenAutenticacao();
    vi.unstubAllGlobals();
  });

  it("sends only listing ID and quantity when creating an order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(order), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    armazenarTokenAutenticacao("signed-company-token");
    const service = createApiPaymentService(empresaR1);

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

  it.each(["52998224725", "11444777000161"])("recusa documento empresarial incompatível sem enviar pedido: %s", async (document) => {
    armazenarTokenAutenticacao("sessao-r1");
    const executar = vi.fn();
    vi.stubGlobal("fetch", executar);
    await expect(createApiPaymentService(empresaR1).createOrder({
      listing: marketplaceItems[0], quantity: 1, buyer: { ...order.buyer, document }, idempotencyKey: "teste-r1",
    })).rejects.toMatchObject({ status: 400 });
    expect(executar).not.toHaveBeenCalled();
  });

  it("não cria pedido sem empresa confirmada nem reutiliza instância de outra sessão", async () => {
    armazenarTokenAutenticacao("sessao-a");
    const antigo = createApiPaymentService(empresaR1);
    const executar = vi.fn();
    vi.stubGlobal("fetch", executar);
    const entrada = { listing: marketplaceItems[0], quantity: 1, buyer: order.buyer, idempotencyKey: "teste-r1" };
    await expect(createApiPaymentService().createOrder(entrada)).rejects.toMatchObject({ status: 409 });
    armazenarTokenAutenticacao("sessao-b");
    await expect(antigo.createOrder(entrada)).rejects.toMatchObject({ status: 409 });
    expect(executar).not.toHaveBeenCalled();
  });
});
