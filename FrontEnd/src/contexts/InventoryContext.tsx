import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { getInventoryItemStatus } from "@/lib/inventory";

const ITEMS_STORAGE_KEY = "zenwaste.inventory-items";
const MOVEMENTS_STORAGE_KEY = "zenwaste.inventory-movements";

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
  addItem: (item: CreateInventoryItemInput) => void;
  adjustItemQuantity: (input: AdjustInventoryQuantityInput) => InventoryActionResult;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

function normalizeStoredItem(raw: unknown): InventoryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<InventoryItem>;
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const targetQuantity = Math.max(1, Number(item.targetQuantity) || 1);
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : createdAt;

  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    name: typeof item.name === "string" && item.name.trim() ? item.name : "Item sem nome",
    type: typeof item.type === "string" && item.type.trim() ? item.type : "Não informado",
    quantity,
    unit: typeof item.unit === "string" && item.unit.trim() ? item.unit : "kg",
    targetQuantity,
    deadline: typeof item.deadline === "string" ? item.deadline : new Date().toISOString().slice(0, 10),
    status: getInventoryItemStatus(quantity, targetQuantity),
    createdAt,
    updatedAt,
  };
}

function normalizeStoredMovement(raw: unknown): InventoryMovement | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const movement = raw as Partial<InventoryMovement>;

  return {
    id: typeof movement.id === "string" ? movement.id : crypto.randomUUID(),
    itemId: typeof movement.itemId === "string" ? movement.itemId : "",
    itemName: typeof movement.itemName === "string" ? movement.itemName : "Item sem nome",
    itemType: typeof movement.itemType === "string" ? movement.itemType : "Não informado",
    type: movement.type === "saida" ? "saida" : "entrada",
    quantity: Math.max(0, Number(movement.quantity) || 0),
    unit: typeof movement.unit === "string" && movement.unit.trim() ? movement.unit : "kg",
    note: typeof movement.note === "string" && movement.note.trim() ? movement.note.trim() : undefined,
    createdAt: typeof movement.createdAt === "string" ? movement.createdAt : new Date().toISOString(),
    resultingQuantity: Math.max(0, Number(movement.resultingQuantity) || 0),
  };
}

function readStoredItems(): InventoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(ITEMS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeStoredItem)
          .filter((item): item is InventoryItem => item !== null)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      : [];
  } catch {
    return [];
  }
}

function readStoredMovements(): InventoryMovement[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeStoredMovement)
          .filter((movement): movement is InventoryMovement => movement !== null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];
  } catch {
    return [];
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>(() => readStoredItems());
  const [movements, setMovements] = useState<InventoryMovement[]>(() => readStoredMovements());

  useEffect(() => {
    window.localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
  }, [movements]);

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      movements,
      addItem: (item) => {
        const now = new Date().toISOString();
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const targetQuantity = Math.max(1, Number(item.targetQuantity) || 1);

        const nextItem: InventoryItem = {
          id: crypto.randomUUID(),
          name: item.name.trim(),
          type: item.type,
          quantity,
          unit: item.unit,
          targetQuantity,
          deadline: item.deadline,
          status: getInventoryItemStatus(quantity, targetQuantity),
          createdAt: now,
          updatedAt: now,
        };

        setItems((current) => [nextItem, ...current]);

        if (quantity > 0) {
          const initialMovement: InventoryMovement = {
            id: crypto.randomUUID(),
            itemId: nextItem.id,
            itemName: nextItem.name,
            itemType: nextItem.type,
            type: "entrada",
            quantity,
            unit: nextItem.unit,
            note: "Cadastro inicial do item.",
            createdAt: now,
            resultingQuantity: quantity,
          };

          setMovements((current) => [initialMovement, ...current]);
        }
      },
      adjustItemQuantity: (input) => {
        const now = new Date().toISOString();
        const quantity = Number(input.quantity);
        let createdMovement: InventoryMovement | null = null;
        let result: InventoryActionResult = {
          success: false,
          message: "Não foi possível localizar o item selecionado.",
        };

        setItems((current) => {
          const selectedItem = current.find((item) => item.id === input.itemId);

          if (!selectedItem) {
            result = {
              success: false,
              message: "Não foi possível localizar o item selecionado.",
            };
            return current;
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            result = {
              success: false,
              message: "Informe uma quantidade válida para registrar a movimentação.",
            };
            return current;
          }

          if (input.type === "saida" && quantity > selectedItem.quantity) {
            result = {
              success: false,
              message: "A saída não pode ser maior que o saldo disponível em estoque.",
            };
            return current;
          }

          const nextQuantity =
            input.type === "entrada"
              ? selectedItem.quantity + quantity
              : Math.max(0, selectedItem.quantity - quantity);

          const updatedItem: InventoryItem = {
            ...selectedItem,
            quantity: nextQuantity,
            updatedAt: now,
            status: getInventoryItemStatus(nextQuantity, selectedItem.targetQuantity),
          };

          createdMovement = {
            id: crypto.randomUUID(),
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            itemType: selectedItem.type,
            type: input.type,
            quantity,
            unit: selectedItem.unit,
            note: input.note?.trim() || undefined,
            createdAt: now,
            resultingQuantity: nextQuantity,
          };

          result = {
            success: true,
            message:
              input.type === "entrada"
                ? "Entrada registrada com sucesso."
                : "Saída registrada com sucesso.",
          };

          return [updatedItem, ...current.filter((item) => item.id !== selectedItem.id)];
        });

        if (createdMovement) {
          setMovements((current) => [createdMovement as InventoryMovement, ...current]);
        }

        return result;
      },
    }),
    [items, movements],
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
