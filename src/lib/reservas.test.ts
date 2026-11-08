import { describe, expect, it } from "vitest";
import { apresentarReserva } from "./reservas";
import type { Reserva } from "@/types/reserva";

const reserva: Reserva = {
  id: "10", itemId: "1", itemName: "Metal", itemType: "Sucata", unit: "kg",
  currentQuantity: 100, missingQuantity: 0, buyerCompanyId: 2, orderId: null,
  modality: "compromisso", buyerName: "Compradora real", buyerPhone: "", quantity: 50,
  unitPrice: 5, totalPrice: 250, status: "pronta", note: "", deadline: "2026-11-20",
  reservedAt: "2026-11-06T12:00:00Z", finalizedAt: "",
};
const agora = new Date(2026, 10, 6);

describe("apresentação de reservas reais", () => {
  it("exibe comprador e modalidade recebidos sem criar uma empresa fictícia", () => {
    expect(apresentarReserva(reserva, agora)).toMatchObject({ comprador: "Compradora real", origem: "Compromisso de estoque", situacao: "coberta" });
    expect(apresentarReserva({ ...reserva, buyerName: "", buyerCompanyId: null, modality: "captacao" }, agora)).toMatchObject({ comprador: "Comprador não informado", origem: "Meta de captação" });
  });

  it("identifica pedido vinculado e preserva os saldos calculados pelo backend", () => {
    const dados = apresentarReserva({ ...reserva, orderId: "pedido-1", currentQuantity: 15.123, missingQuantity: 34.877 }, agora);
    expect(dados).toMatchObject({ origem: "Pedido vinculado", pedidoId: "pedido-1", saldoFisico: 15.123, quantidadeFaltante: 34.877, progresso: 30 });
  });

  it.each(["finalizada", "cancelada", "expirada"] as const)("mantém %s fora da cobertura ativa mesmo sem saldo físico", (status) => {
    const dados = apresentarReserva({ ...reserva, status, currentQuantity: 0, missingQuantity: 50 }, agora);
    expect(dados.situacao).toBe(status);
    expect(dados.ativa).toBe(false);
  });

  it("não inventa prazo para uma reserva sem data limite", () => {
    expect(apresentarReserva({ ...reserva, deadline: "" }, agora)).toMatchObject({ prazo: "", diasRestantes: null });
  });
});
