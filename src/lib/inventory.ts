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
  sem_saldo: {
    label: "Sem saldo",
    badgeVariant: "outline",
    className: "border-warning/30 bg-warning/10 text-warning",
    color: "hsl(38 92% 50%)",
    description: "Item cadastrado, mas sem quantidade disponivel no momento.",
  },
  disponivel: {
    label: "Disponivel",
    badgeVariant: "secondary",
    className: "border-primary/25 bg-primary/10 text-primary",
    color: "hsl(152 55% 35%)",
    description: "Ha saldo disponivel para operacao ou anuncio.",
  },
  em_estoque: {
    label: "Sem saldo",
    badgeVariant: "outline",
    className: "border-warning/30 bg-warning/10 text-warning",
    color: "hsl(38 92% 50%)",
    description: "Item cadastrado, mas sem quantidade disponivel no momento.",
  },
  em_producao: {
    label: "Disponivel",
    badgeVariant: "outline",
    className: "border-info/25 bg-info/10 text-info",
    color: "hsl(213 50% 45%)",
    description: "Ha saldo disponivel para operacao ou anuncio.",
  },
  concluido: {
    label: "Disponivel",
    badgeVariant: "secondary",
    className: "border-primary/25 bg-primary/10 text-primary",
    color: "hsl(152 55% 35%)",
    description: "Ha saldo disponivel para operacao ou anuncio.",
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
    label: "Saida",
    badgeVariant: "outline",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

export function getInventoryItemStatus(quantity: number): InventoryItem["status"] {
  return quantity > 0 ? "disponivel" : "sem_saldo";
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
