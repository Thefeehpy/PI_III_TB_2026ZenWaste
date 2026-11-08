import { requisitar } from "@/services/cliente-http";
import type {
  AtualizacaoItemEstoque,
  CadastroItemEstoque,
  ItemEstoque,
  MovimentacaoEstoque,
  RegistroMovimentacaoEstoque,
} from "@/types/estoque";

export const servicoEstoque = {
  listarItens(opcoes: Pick<RequestInit, "signal"> = {}) {
    return requisitar<{ items: ItemEstoque[] }>("/inventory/items/", opcoes);
  },

  cadastrarItem(entrada: CadastroItemEstoque) {
    return requisitar<{ item: ItemEstoque }>("/inventory/items/", {
      method: "POST",
      body: JSON.stringify(entrada),
    });
  },

  atualizarItem(id: string, entrada: AtualizacaoItemEstoque) {
    return requisitar<{ item: ItemEstoque }>(`/inventory/items/${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(entrada),
    });
  },

  desativarItem(id: string) {
    return requisitar<{ message: string; closedAds: number }>(`/inventory/items/${encodeURIComponent(id)}/`, {
      method: "DELETE",
    });
  },

  listarMovimentacoes(opcoes: Pick<RequestInit, "signal"> = {}) {
    return requisitar<{ movements: MovimentacaoEstoque[] }>("/inventory/movements/", opcoes);
  },

  registrarMovimentacao(entrada: RegistroMovimentacaoEstoque) {
    return requisitar<{ item: ItemEstoque; movement: MovimentacaoEstoque }>(
      `/inventory/items/${encodeURIComponent(entrada.itemId)}/movements/`,
      {
        method: "POST",
        body: JSON.stringify({ quantity: entrada.quantity, type: entrada.type, note: entrada.note }),
      },
    );
  },
};
