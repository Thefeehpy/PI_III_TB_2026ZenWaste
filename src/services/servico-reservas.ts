import { requisitar } from "@/services/cliente-http";
import type { CadastroReserva, Reserva, SituacaoAtualizavelReserva } from "@/types/reserva";

export const servicoReservas = {
  listarReservas() {
    return requisitar<{ items: Reserva[] }>("/inventory/reservations/");
  },

  cadastrarReserva(idProduto: string, entrada: CadastroReserva) {
    return requisitar<{ reservation: Reserva }>(
      `/inventory/items/${encodeURIComponent(idProduto)}/reservations/`,
      { method: "POST", body: JSON.stringify(entrada) },
    );
  },

  atualizarSituacao(id: string, situacao: SituacaoAtualizavelReserva) {
    return requisitar<{ reservation: Reserva }>(`/inventory/reservations/${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: situacao }),
    });
  },
};
