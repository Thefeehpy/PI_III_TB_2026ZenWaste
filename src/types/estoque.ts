export type SituacaoItemEstoque = "em_estoque" | "em_producao" | "concluido";
export type TipoMovimentacaoEstoque = "entrada" | "saida";

/** Contrato de SerializadorItemEstoque. Quantidades usam a unidade do produto. */
export interface ItemEstoque {
  id: string;
  name: string;
  type: string;
  description: string;
  /** Saldo físico; inclui a quantidade comprometida. */
  quantity: number;
  committedQuantity: number;
  availableQuantity: number;
  unit: string;
  /** Meta de captação legada; não equivale a um compromisso de venda. */
  targetQuantity: number;
  deadline: string;
  status: SituacaoItemEstoque;
  createdAt: string;
  updatedAt: string;
}

export interface MovimentacaoEstoque {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  type: TipoMovimentacaoEstoque;
  quantity: number;
  unit: string;
  note: string;
  createdAt: string;
  resultingQuantity: number;
}

export interface CadastroItemEstoque {
  name: string;
  type: string;
  quantity: number;
  unit: string;
  description?: string;
  targetQuantity?: number | null;
  deadline?: string | null;
}

export type AtualizacaoItemEstoque = Partial<
  Pick<CadastroItemEstoque, "name" | "type" | "unit" | "description" | "targetQuantity" | "deadline">
>;

export interface RegistroMovimentacaoEstoque {
  itemId: string;
  quantity: number;
  type: TipoMovimentacaoEstoque;
  note?: string;
}
