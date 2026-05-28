import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { marketplaceItems as fallbackMarketplaceItems, type SellerWasteItem, type WasteItem } from "@/data/mockData";
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
  const [items, setItems] = useState<WasteItem[]>(fallbackMarketplaceItems);
  const [sellerItems, setSellerItems] = useState<SellerWasteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    try {
      const response = await api.listSellerMarketplaceItems();
      setSellerItems(response.items);
    } catch {
      setSellerItems([]);
    }
  }, []);

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
        try {
          const response = await api.createMarketplaceItem(item);
          setItems((current) => [response.item, ...current.filter((candidate) => candidate.id !== response.item.id)]);
          await refreshSellerItems();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel publicar o anuncio.",
          };
        }
      },
      deactivateItem: async (adId) => {
        try {
          await api.deleteMarketplaceItem(adId);
          setItems((current) => current.filter((item) => item.id !== adId));
          await refreshSellerItems();
          return { success: true, message: "Anuncio encerrado com sucesso." };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel encerrar o anuncio.",
          };
        }
      },
      finalizeItem: async (adId, soldQuantity) => {
        try {
          await api.finalizeMarketplaceItem(adId, soldQuantity);
          setItems((current) => current.filter((item) => item.id !== adId));
          await refreshSellerItems();
          return { success: true, message: "Anuncio finalizado e saldo atualizado." };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel finalizar o anuncio.",
          };
        }
      },
    }),
    [isLoading, items, refreshMarketplace, refreshSellerItems, sellerItems],
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
