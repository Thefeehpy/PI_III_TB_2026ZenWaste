export type SituacaoReserva = "em_captacao" | "pronta" | "finalizada" | "cancelada" | "expirada";
export type SituacaoAtualizavelReserva = Exclude<SituacaoReserva, "expirada">;
export type ModalidadeReserva = "captacao" | "compromisso";

/** Contrato de SerializadorReserva; comprador/pedido nulos preservam registros legados. */
export interface Reserva {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  unit: string;
  currentQuantity: number;
  missingQuantity: number;
  buyerCompanyId: number | null;
  orderId: string | null;
  modality: ModalidadeReserva;
  buyerName: string;
  buyerPhone: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: SituacaoReserva;
  note: string;
  deadline: string;
  reservedAt: string;
  finalizedAt: string;
}

export interface CadastroReserva {
  quantity: number;
  unitPrice: number;
  buyerCompanyId?: number;
  buyerName?: string;
  buyerPhone?: string;
  deadline?: string | null;
  note?: string;
}
