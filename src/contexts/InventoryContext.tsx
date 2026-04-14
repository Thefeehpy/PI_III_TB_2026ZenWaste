import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface CreateInventoryItemInput {
  name: string;
  type: string;
  quantity: number;
  unit: string;
  targetQuantity: number;
  deadline: string;
}

interface AdjustInventoryQuantityInput {
  itemId: string;
  quantity: number;
  type: InventoryMovement["type"];
  note?: string;
}

interface InventoryActionResult {
  success: boolean;
  message: string;
}

interface InventoryContextValue {
  items: InventoryItem[];
  movements: InventoryMovement[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  addItem: (item: CreateInventoryItemInput) => Promise<InventoryActionResult>;
  adjustItemQuantity: (input: AdjustInventoryQuantityInput) => Promise<InventoryActionResult>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

function sortItems(items: InventoryItem[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortMovements(movements: InventoryMovement[]) {
  return [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshInventory = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setMovements([]);
      return;
    }

    setIsLoading(true);
    try {
      const [itemsResponse, movementsResponse] = await Promise.all([
        api.listInventoryItems(),
        api.listInventoryMovements(),
      ]);

      setItems(sortItems(itemsResponse.items));
      setMovements(sortMovements(movementsResponse.movements));
    } catch {
      setItems([]);
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      movements,
      isLoading,
      refreshInventory,
      addItem: async (item) => {
        try {
          const quantity = Math.max(0, Number(item.quantity) || 0);
          const targetQuantity = Math.max(1, Number(item.targetQuantity) || 1);
          const response = await api.createInventoryItem({
            name: item.name.trim(),
            type: item.type,
            quantity,
            unit: item.unit,
            targetQuantity,
            deadline: item.deadline,
          });

          setItems((current) => sortItems([response.item, ...current]));

          const movementsResponse = await api.listInventoryMovements();
          setMovements(sortMovements(movementsResponse.movements));

          return {
            success: true,
            message: "Item cadastrado com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel cadastrar o item.",
          };
        }
      },
      adjustItemQuantity: async (input) => {
        try {
          const quantity = Number(input.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return {
              success: false,
              message: "Informe uma quantidade valida para registrar a movimentacao.",
            };
          }

          const response = await api.adjustInventoryItemQuantity({
            ...input,
            quantity,
          });

          setItems((current) => sortItems([response.item, ...current.filter((item) => item.id !== response.item.id)]));
          setMovements((current) => sortMovements([response.movement, ...current]));

          return {
            success: true,
            message: input.type === "entrada" ? "Entrada registrada com sucesso." : "Saida registrada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel registrar a movimentacao.",
          };
        }
      },
    }),
    [isLoading, items, movements, refreshInventory],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }

  return context;
}
