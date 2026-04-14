import type { InventoryItem, InventoryMovement } from "@/data/mockData";

export const inventoryStatusMap: Record<
  InventoryItem["status"],
  {
    label: string;
    badgeVariant: "default" | "secondary" | "outline";
    className: string;
    color: string;
    description: string;
  }
> = {
  em_estoque: {
    label: "Sem saldo",
    badgeVariant: "outline",
    className: "border-warning/30 bg-warning/10 text-warning",
    color: "hsl(38 92% 50%)",
    description: "Item cadastrado, mas sem quantidade disponível no momento.",
  },
  em_producao: {
    label: "Abaixo da meta",
    badgeVariant: "outline",
    className: "border-info/25 bg-info/10 text-info",
    color: "hsl(213 50% 45%)",
    description: "Há saldo disponível, mas o volume ainda está abaixo da meta definida.",
  },
  concluido: {
    label: "Meta atingida",
    badgeVariant: "secondary",
    className: "border-primary/25 bg-primary/10 text-primary",
    color: "hsl(152 55% 35%)",
    description: "O volume atual já atingiu ou ultrapassou a meta do item.",
  },
};

export const inventoryMovementMap: Record<
  InventoryMovement["type"],
  {
    label: string;
    badgeVariant: "default" | "outline";
    className: string;
  }
> = {
  entrada: {
    label: "Entrada",
    badgeVariant: "default",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  saida: {
    label: "Saída",
    badgeVariant: "outline",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

export function getInventoryItemStatus(quantity: number, targetQuantity: number): InventoryItem["status"] {
  const safeTarget = Math.max(targetQuantity, 1);

  if (quantity <= 0) {
    return "em_estoque";
  }

  if (quantity >= safeTarget) {
    return "concluido";
  }

  return "em_producao";
}

export function getInventoryProgress(item: Pick<InventoryItem, "quantity" | "targetQuantity">) {
  const safeTarget = Math.max(item.targetQuantity, 1);
  return Math.min(100, Math.round((Math.max(item.quantity, 0) / safeTarget) * 100));
}

export function formatInventoryQuantity(value: number, unit: string) {
  return `${value.toLocaleString("pt-BR")} ${unit}`;
}

export function formatInventoryDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatInventoryChartDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
