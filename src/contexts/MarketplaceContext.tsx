import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEstoque } from "@/contexts/InventoryContext";
import { useGestaoAnuncios, type ResultadoAcaoAnuncio } from "@/hooks/use-gestao-anuncios";

const ContextoAnuncios = createContext<ReturnType<typeof useGestaoAnuncios> | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { atualizarEstoque } = useEstoque();
  const anuncios = useGestaoAnuncios(user?.id ?? null, atualizarEstoque);
  return <ContextoAnuncios.Provider value={anuncios}>{children}</ContextoAnuncios.Provider>;
}

export function useAnuncios() {
  const contexto = useContext(ContextoAnuncios);
  if (!contexto) throw new Error("useAnuncios deve ser utilizado dentro de MarketplaceProvider.");
  return contexto;
}

function adaptarResultado(resultado: ResultadoAcaoAnuncio) {
  return { success: resultado.sucesso, message: resultado.mensagem };
}

/** Fachada temporária para telas migradas gradualmente, sem mudar seus contratos de props. */
export function useMarketplace() {
  const anuncios = useAnuncios();
  return {
    items: anuncios.anuncios,
    sellerItems: anuncios.anunciosEmpresa,
    isLoading: anuncios.carregando,
    sellerIsLoading: anuncios.carregandoEmpresa,
    error: anuncios.erro,
    sellerError: anuncios.erroEmpresa,
    busyItemIds: anuncios.anunciosEmAlteracao,
    refreshMarketplace: anuncios.atualizarAnuncios,
    refreshSellerItems: anuncios.atualizarAnunciosEmpresa,
    addItem: (...entrada: Parameters<typeof anuncios.criarAnuncio>) => anuncios.criarAnuncio(...entrada).then(adaptarResultado),
    deactivateItem: (...entrada: Parameters<typeof anuncios.desativarAnuncio>) => anuncios.desativarAnuncio(...entrada).then(adaptarResultado),
    finalizeItem: (...entrada: Parameters<typeof anuncios.finalizarVenda>) => anuncios.finalizarVenda(...entrada).then(adaptarResultado),
  };
}
