import { requisitar } from "@/services/cliente-http";
import type {
  Anuncio,
  AnuncioVendedor,
  AtualizacaoAnuncio,
  CadastroAnuncio,
  FinalizacaoVendaAnuncio,
} from "@/types/anuncio";
import type { ItemEstoque, MovimentacaoEstoque } from "@/types/estoque";
import type { Reserva } from "@/types/reserva";

export const servicoAnuncios = {
  listar() {
    return requisitar<{ items: Anuncio[] }>("/marketplace/ads/");
  },

  criar(entrada: CadastroAnuncio) {
    return requisitar<{ item: Anuncio }>("/marketplace/ads/", {
      method: "POST",
      body: JSON.stringify(entrada),
    });
  },

  atualizar(id: string, entrada: AtualizacaoAnuncio) {
    return requisitar<{ item: Anuncio }>(`/marketplace/ads/${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(entrada),
    });
  },

  listarDaEmpresa() {
    return requisitar<{ items: AnuncioVendedor[] }>("/marketplace/ads/mine/");
  },

  desativar(id: string) {
    return requisitar<void>(`/marketplace/ads/${encodeURIComponent(id)}/`, { method: "DELETE" });
  },

  finalizarVenda(id: string, entrada: FinalizacaoVendaAnuncio) {
    return requisitar<{
      ad: AnuncioVendedor;
      item: ItemEstoque;
      movement: MovimentacaoEstoque;
      reservation?: Reserva;
    }>(`/marketplace/ads/${encodeURIComponent(id)}/finalize/`, {
      method: "POST",
      body: JSON.stringify(entrada),
    });
  },
};
