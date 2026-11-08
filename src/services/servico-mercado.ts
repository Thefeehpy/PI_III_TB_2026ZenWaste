import { requisitar } from "@/services/cliente-http";
import type {
  ContextoSugestaoAnuncio,
  PrecosMercado,
  SugestaoDescricao,
  SugestaoPreco,
} from "@/types/mercado";

export const servicoMercado = {
  obterPrecos() {
    return requisitar<PrecosMercado>("/market/prices/");
  },

  sugerirPreco(entrada: string | ContextoSugestaoAnuncio) {
    return requisitar<SugestaoPreco>("/market/suggest-price/", {
      method: "POST",
      body: JSON.stringify(typeof entrada === "string" ? { type: entrada } : entrada),
    });
  },

  sugerirDescricao(entrada: ContextoSugestaoAnuncio & { name: string }) {
    return requisitar<SugestaoDescricao>("/market/suggest-description/", {
      method: "POST",
      body: JSON.stringify(entrada),
    });
  },
};
