import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGestaoEstoque, type ResultadoAcaoEstoque } from "@/hooks/use-gestao-estoque";

const ContextoEstoque = createContext<ReturnType<typeof useGestaoEstoque> | undefined>(undefined);

export function ProvedorEstoque({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const estoque = useGestaoEstoque(user?.id ?? null);
  return <ContextoEstoque.Provider value={estoque}>{children}</ContextoEstoque.Provider>;
}

export function useEstoque() {
  const contexto = useContext(ContextoEstoque);
  if (!contexto) throw new Error("useEstoque deve ser utilizado dentro de ProvedorEstoque.");
  return contexto;
}

/** Compatibilidade temporária para as telas que serão migradas por domínio. */
export const InventoryProvider = ProvedorEstoque;

function adaptarResultado(resultado: ResultadoAcaoEstoque) {
  return { success: resultado.sucesso, message: resultado.mensagem };
}

export function useInventory() {
  const estoque = useEstoque();
  return {
    items: estoque.itens,
    movements: estoque.movimentacoes,
    isLoading: estoque.carregando,
    error: estoque.erro,
    movementsError: estoque.erroMovimentacoes,
    refreshInventory: estoque.atualizarEstoque,
    addItem: (...entrada: Parameters<typeof estoque.cadastrarItem>) => estoque.cadastrarItem(...entrada).then(adaptarResultado),
    updateItem: (...entrada: Parameters<typeof estoque.atualizarItem>) => estoque.atualizarItem(...entrada).then(adaptarResultado),
    adjustItemQuantity: (...entrada: Parameters<typeof estoque.registrarMovimentacao>) => estoque.registrarMovimentacao(...entrada).then(adaptarResultado),
    deleteItem: (...entrada: Parameters<typeof estoque.desativarItem>) => estoque.desativarItem(...entrada).then(adaptarResultado),
  };
}
