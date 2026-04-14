import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { marketplaceItems as fallbackMarketplaceItems, type WasteItem } from "@/data/mockData";
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
  isLoading: boolean;
  refreshMarketplace: () => Promise<void>;
  addItem: (item: CreateMarketplaceItemInput) => Promise<MarketplaceActionResult>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WasteItem[]>(fallbackMarketplaceItems);
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

  useEffect(() => {
    void refreshMarketplace();
  }, [refreshMarketplace]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      items,
      isLoading,
      refreshMarketplace,
      addItem: async (item) => {
        try {
          const response = await api.createMarketplaceItem(item);
          setItems((current) => [response.item, ...current.filter((candidate) => candidate.id !== response.item.id)]);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel publicar o anuncio.",
          };
        }
      },
    }),
    [isLoading, items, refreshMarketplace],
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
