import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { marketplaceItems as fallbackMarketplaceItems, type SellerWasteItem, type WasteItem } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface CreateMarketplaceItemInput {
  inventoryId?: string;
  name: string;
  type: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  imageUrl?: string;
}

interface MarketplaceActionResult {
  success: boolean;
  message?: string;
}

interface MarketplaceContextValue {
  items: WasteItem[];
  sellerItems: SellerWasteItem[];
  isLoading: boolean;
  refreshMarketplace: () => Promise<void>;
  refreshSellerItems: () => Promise<void>;
  addItem: (item: CreateMarketplaceItemInput) => Promise<MarketplaceActionResult>;
  deactivateItem: (adId: string) => Promise<MarketplaceActionResult>;
  finalizeItem: (adId: string, soldQuantity: number) => Promise<MarketplaceActionResult>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const authUserId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(authUserId);
  const [items, setItems] = useState<WasteItem[]>(fallbackMarketplaceItems);
  const [sellerItems, setSellerItems] = useState<SellerWasteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    activeUserIdRef.current = authUserId;

    if (!authUserId) {
      setSellerItems([]);
    }
  }, [authUserId]);

  const canApplySellerResponse = useCallback((requestUserId: string | null) => {
    return Boolean(requestUserId) && activeUserIdRef.current === requestUserId;
  }, []);

  const refreshMarketplace = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.listMarketplaceItems();
      setItems(response.items);
    } catch {
      setItems(fallbackMarketplaceItems);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSellerItems = useCallback(async () => {
    const requestUserId = authUserId;
    if (!requestUserId) {
      setSellerItems([]);
      return;
    }

    try {
      const response = await api.listSellerMarketplaceItems();
      if (canApplySellerResponse(requestUserId)) {
        setSellerItems(response.items);
      }
    } catch {
      if (canApplySellerResponse(requestUserId)) {
        setSellerItems([]);
      }
    }
  }, [authUserId, canApplySellerResponse]);

  useEffect(() => {
    void refreshMarketplace();
    void refreshSellerItems();
  }, [refreshMarketplace, refreshSellerItems]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      items,
      sellerItems,
      isLoading,
      refreshMarketplace,
      refreshSellerItems,
      addItem: async (item) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticacao obrigatoria.",
          };
        }

        try {
          const response = await api.createMarketplaceItem(item);
          setItems((current) => [response.item, ...current.filter((candidate) => candidate.id !== response.item.id)]);
          if (canApplySellerResponse(requestUserId)) {
            await refreshSellerItems();
          }
          return { success: true };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel publicar o anuncio.",
          };
        }
      },
      deactivateItem: async (adId) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticacao obrigatoria.",
          };
        }

        try {
          await api.deleteMarketplaceItem(adId);
          setItems((current) => current.filter((item) => item.id !== adId));
          if (canApplySellerResponse(requestUserId)) {
            await refreshSellerItems();
          }
          return { success: true, message: "Anuncio encerrado com sucesso." };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel encerrar o anuncio.",
          };
        }
      },
      finalizeItem: async (adId, soldQuantity) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticacao obrigatoria.",
          };
        }

        try {
          await api.finalizeMarketplaceItem(adId, soldQuantity);
          setItems((current) => current.filter((item) => item.id !== adId));
          if (canApplySellerResponse(requestUserId)) {
            await refreshSellerItems();
          }
          return { success: true, message: "Anuncio finalizado e saldo atualizado." };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel finalizar o anuncio.",
          };
        }
      },
    }),
    [authUserId, canApplySellerResponse, isLoading, items, refreshMarketplace, refreshSellerItems, sellerItems],
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);

  if (!context) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider");
  }

  return context;
}
