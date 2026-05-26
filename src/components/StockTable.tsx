import { CalendarClock, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryItem } from "@/data/mockData";
import { formatInventoryCalendarDate, formatInventoryQuantity, inventoryStatusMap } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface StockTableProps {
  items: InventoryItem[];
  onViewItem: (item: InventoryItem) => void;
}

export function StockTable({ items, onViewItem }: StockTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground">Nenhum item cadastrado no estoque</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre o primeiro item para comecar a organizar seus produtos e abrir os detalhes de cada um em um modal.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const status = inventoryStatusMap[item.status];
        const reservationGap = Math.max(item.targetQuantity - item.quantity, 0);
        const summaryText =
          reservationGap > 0
            ? `Faltam ${formatInventoryQuantity(reservationGap, item.unit)} para cobrir a reserva.`
            : "Reserva coberta e item pronto para seguir operando.";

        return (
          <Card
            key={item.id}
            className="rounded-[28px] border-border/70 bg-card/95 shadow-sm transition-transform duration-300 hover:-translate-y-1"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.type}</p>
                </div>

                <Badge variant={status.badgeVariant} className={cn("w-fit rounded-full px-3 py-1", status.className)}>
                  {status.label}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saldo</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatInventoryQuantity(item.quantity, item.unit)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reserva</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatInventoryQuantity(item.targetQuantity, item.unit)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  Prazo
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{formatInventoryCalendarDate(item.deadline)}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{summaryText}</p>
              </div>

              <Button className="mt-5 w-full justify-between rounded-2xl" onClick={() => onViewItem(item)}>
                Ver detalhes do item
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
