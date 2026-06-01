import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface CreateInventoryItemInput {
  name: string;
  type: string;
  quantity: number;
  unit: string;
}

interface AdjustInventoryQuantityInput {
  itemId: string;
  quantity: number;
  type: InventoryMovement["type"];
  note?: string;
}

interface UpdateInventoryItemInput {
  itemId: string;
  name?: string;
  type?: string;
  unit?: string;
  targetQuantity?: number;
  deadline?: string;
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
  updateItem: (input: UpdateInventoryItemInput) => Promise<InventoryActionResult>;
  adjustItemQuantity: (input: AdjustInventoryQuantityInput) => Promise<InventoryActionResult>;
  deleteItem: (itemId: string) => Promise<InventoryActionResult>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

function sortItems(items: InventoryItem[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortMovements(movements: InventoryMovement[]) {
  return [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const authUserId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(authUserId);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    activeUserIdRef.current = authUserId;

    if (!authUserId) {
      setItems([]);
      setMovements([]);
      setIsLoading(false);
    }
  }, [authUserId]);

  const canApplyResponse = useCallback((requestUserId: string | null) => {
    return Boolean(requestUserId) && activeUserIdRef.current === requestUserId;
  }, []);

  const refreshInventory = useCallback(async () => {
    const requestUserId = authUserId;

    if (!requestUserId) {
      setItems([]);
      setMovements([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [itemsResponse, movementsResponse] = await Promise.all([
        api.listInventoryItems(),
        api.listInventoryMovements(),
      ]);

      if (canApplyResponse(requestUserId)) {
        setItems(sortItems(itemsResponse.items));
        setMovements(sortMovements(movementsResponse.movements));
      }
    } catch {
      if (canApplyResponse(requestUserId)) {
        setItems([]);
        setMovements([]);
      }
    } finally {
      if (canApplyResponse(requestUserId)) {
        setIsLoading(false);
      }
    }
  }, [authUserId, canApplyResponse]);

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
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticação obrigatória.",
          };
        }

        try {
          const quantity = Math.max(0, Number(item.quantity) || 0);
          const response = await api.createInventoryItem({
            name: item.name.trim(),
            type: item.type,
            quantity,
            unit: item.unit,
          });

          if (canApplyResponse(requestUserId)) {
            setItems((current) => sortItems([response.item, ...current]));
          }

          const movementsResponse = await api.listInventoryMovements();
          if (canApplyResponse(requestUserId)) {
            setMovements(sortMovements(movementsResponse.movements));
          }

          return {
            success: true,
            message: "Item cadastrado com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Não foi possível cadastrar o item.",
          };
        }
      },
      updateItem: async (input) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticação obrigatória.",
          };
        }

        try {
          const payload: Partial<Pick<InventoryItem, "name" | "type" | "unit" | "targetQuantity" | "deadline">> = {};

          if (input.name !== undefined) {
            payload.name = input.name.trim();
          }

          if (input.type !== undefined) {
            payload.type = input.type;
          }

          if (input.unit !== undefined) {
            payload.unit = input.unit;
          }

          if (input.targetQuantity !== undefined) {
            const targetQuantity = Math.max(1, Number(input.targetQuantity) || 1);
            payload.targetQuantity = targetQuantity;
          }

          if (input.deadline !== undefined) {
            payload.deadline = input.deadline;
          }

          const response = await api.updateInventoryItem(input.itemId, payload);

          if (canApplyResponse(requestUserId)) {
            setItems((current) => sortItems([response.item, ...current.filter((item) => item.id !== response.item.id)]));
          }

          return {
            success: true,
            message: "Reserva atualizada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Não foi possível atualizar a reserva.",
          };
        }
      },
      adjustItemQuantity: async (input) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticação obrigatória.",
          };
        }

        try {
          const quantity = Number(input.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return {
              success: false,
              message: "Informe uma quantidade válida para registrar a movimentação.",
            };
          }

          const response = await api.adjustInventoryItemQuantity({
            ...input,
            quantity,
          });

          if (canApplyResponse(requestUserId)) {
            setItems((current) => sortItems([response.item, ...current.filter((item) => item.id !== response.item.id)]));
            setMovements((current) => sortMovements([response.movement, ...current]));
          }

          return {
            success: true,
            message: input.type === "entrada" ? "Entrada registrada com sucesso." : "Saida registrada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Não foi possível registrar a movimentação.",
          };
        }
      },
      deleteItem: async (itemId) => {
        const requestUserId = authUserId;
        if (!requestUserId) {
          return {
            success: false,
            message: "Autenticação obrigatória.",
          };
        }

        try {
          const response = await api.deleteInventoryItem(itemId);
          if (canApplyResponse(requestUserId)) {
            setItems((current) => current.filter((item) => item.id !== itemId));
            setMovements((current) => current.filter((movement) => movement.itemId !== itemId));
          }

          return {
            success: true,
            message:
              response.closedAds > 0
                ? "Item excluído e anúncios vinculados encerrados."
                : "Item excluído com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Não foi possível excluir o item.",
          };
        }
      },
    }),
    [authUserId, canApplyResponse, isLoading, items, movements, refreshInventory],
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

