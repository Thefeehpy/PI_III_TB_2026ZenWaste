import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { marketplaceItems as initialMarketplaceItems, type WasteItem } from "@/data/mockData";

const STORAGE_KEY = "zenwaste.marketplace-items";

interface CreateMarketplaceItemInput {
  name: string;
  type: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  company: string;
  imageUrl?: string;
}

interface MarketplaceContextValue {
  items: WasteItem[];
  addItem: (item: CreateMarketplaceItemInput) => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

function readStoredItems(): WasteItem[] {
  if (typeof window === "undefined") {
    return initialMarketplaceItems;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return initialMarketplaceItems;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WasteItem[]) : initialMarketplaceItems;
  } catch {
    return initialMarketplaceItems;
  }
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WasteItem[]>(() => readStoredItems());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<MarketplaceContextValue>(() => ({
    items,
    addItem: (item) => {
      setItems((current) => [
        {
          id: crypto.randomUUID(),
          name: item.name,
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          location: item.location,
          company: item.company,
          imageUrl: item.imageUrl || "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=400&h=300&fit=crop",
          createdAt: new Date().toISOString().slice(0, 10),
        },
        ...current,
      ]);
    },
  }), [items]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);

  if (!context) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider");
  }

  return context;
}
