import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryItem } from "@/data/mockData";
import {
  formatInventoryDate,
  formatInventoryQuantity,
  getInventoryProgress,
  inventoryStatusMap,
} from "@/lib/inventory";

interface StockTableProps {
  items: InventoryItem[];
  onAdjustItem: (item: InventoryItem, type: "entrada" | "saida") => void;
}

export function StockTable({ items, onAdjustItem }: StockTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground">Nenhum item cadastrado no estoque</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre o primeiro item para começar a registrar entradas, saídas e acompanhar a meta de saldo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Saldo atual</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Última movimentação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const progress = getInventoryProgress(item);
            const status = inventoryStatusMap[item.status];
            const remaining = Math.max(item.targetQuantity - item.quantity, 0);

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{item.type}</span>
                      <span className="text-border">•</span>
                      <span>Prazo {new Date(item.deadline).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{formatInventoryQuantity(item.quantity, item.unit)}</p>
                    <p className="text-xs text-muted-foreground">disponível agora</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {formatInventoryQuantity(item.targetQuantity, item.unit)}
                    </p>
                    <p className="text-xs text-muted-foreground">meta definida</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-[180px] space-y-2">
                    <Progress value={progress} className="h-2 flex-1" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{progress}% da meta</span>
                      <span>
                        {remaining > 0
                          ? `faltam ${formatInventoryQuantity(remaining, item.unit)}`
                          : "meta alcançada"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{formatInventoryDate(item.updatedAt)}</p>
                    <p className="text-xs text-muted-foreground">última atualização do saldo</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={status.badgeVariant} className={status.className}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => onAdjustItem(item, "entrada")}
                    >
                      <Plus className="h-4 w-4" />
                      Entrada
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onAdjustItem(item, "saida")}
                    >
                      <Minus className="h-4 w-4" />
                      Saída
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
