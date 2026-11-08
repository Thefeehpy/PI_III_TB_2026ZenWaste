import type { Reserva } from "@/types/reserva";

export type SituacaoExibicaoReserva = "coberta" | "pendente" | "atencao" | "finalizada" | "cancelada" | "expirada";

export function diasRestantesReserva(prazo: string, agora = new Date()): number | null {
  if (!prazo) return null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? new Date(`${prazo}T00:00:00`) : new Date(prazo);
  if (Number.isNaN(data.getTime())) return null;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  data.setHours(0, 0, 0, 0);
  return Math.round((data.getTime() - hoje.getTime()) / 86_400_000);
}

/** Projeção de exibição; usa saldo e faltante calculados pelo backend, sem reservar estoque. */
export function apresentarReserva(reserva: Reserva, agora = new Date()) {
  const ativa = reserva.status === "em_captacao" || reserva.status === "pronta";
  const diasRestantes = diasRestantesReserva(reserva.deadline, agora);
  const situacao: SituacaoExibicaoReserva = reserva.status === "finalizada" || reserva.status === "cancelada" || reserva.status === "expirada"
    ? reserva.status
    : reserva.missingQuantity <= 0 ? "coberta"
      : diasRestantes !== null && diasRestantes <= 7 ? "atencao" : "pendente";
  return {
    id: reserva.id,
    nomeProduto: reserva.itemName,
    categoria: reserva.itemType,
    unidade: reserva.unit,
    quantidadeReservada: reserva.quantity,
    saldoFisico: reserva.currentQuantity,
    quantidadeFaltante: reserva.missingQuantity,
    comprador: reserva.buyerName.trim() || (reserva.buyerCompanyId ? `Empresa #${reserva.buyerCompanyId}` : "Comprador não informado"),
    prazo: reserva.deadline,
    diasRestantes,
    progresso: reserva.quantity > 0 ? Math.max(0, Math.min(100, Math.round((reserva.quantity - reserva.missingQuantity) / reserva.quantity * 100))) : 0,
    situacao,
    ativa,
    modalidade: reserva.modality,
    pedidoId: reserva.orderId,
    origem: reserva.orderId ? "Pedido vinculado" : reserva.modality === "compromisso" ? "Compromisso de estoque" : "Meta de captação",
    observacao: reserva.note,
  };
}
