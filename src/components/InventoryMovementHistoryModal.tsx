import { ArrowDownRight, ArrowUpRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEstoque } from "@/contexts/InventoryContext";
import type { ItemEstoque } from "@/types/estoque";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export function InventoryMovementHistoryModal({
  item,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  item: ItemEstoque;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { movimentacoes: movements, carregando, erroMovimentacoes, atualizarEstoque } = useEstoque();
  const history = movements.filter((movement) => movement.itemId === item.id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel="Fechar histórico"
        overlayClassName="z-[60] bg-black/40 backdrop-blur-[2px]"
        className="z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:rounded-[28px]"
      >
        <DialogHeader className="shrink-0 border-b border-border/60 p-6 text-left">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </span>
          <DialogTitle className="text-xl">
            Histórico de movimentações
          </DialogTitle>
          <DialogDescription className="break-words">
            {item.name} · {history.length} registro
            {history.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>
        {erroMovimentacoes ? (
          <div role="alert" className="mx-6 my-3 rounded-xl bg-destructive/10 p-3 text-sm">
            <p>{erroMovimentacoes}</p>
            <Button variant="outline" className="mt-2" disabled={carregando} onClick={() => void atualizarEstoque()}>Tentar novamente</Button>
          </div>
        ) : null}
        <div className="min-h-0 overflow-y-auto px-6 py-2">
          {carregando && !history.length ? <p role="status" className="py-6 text-sm text-muted-foreground">Carregando histórico…</p> : history.length ? (
            <ol className="divide-y divide-border/60">
              {history.map((movement) => {
                const entry = movement.type === "entrada";
                const Icon = entry ? ArrowUpRight : ArrowDownRight;
                return (
                  <li key={movement.id} className="flex items-start gap-3 py-4">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        entry
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {entry ? "Entrada" : "Saída"}
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            entry ? "text-primary" : "text-destructive",
                          )}
                        >
                          {entry ? "+" : "−"}
                          {formatInventoryQuantity(
                            movement.quantity,
                            movement.unit,
                          )}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatInventoryDate(movement.createdAt)}
                      </p>
                      {movement.note ? (
                        <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
                          {movement.note}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Saldo após operação:{" "}
                        <span className="font-medium text-foreground">
                          {formatInventoryQuantity(
                            movement.resultingQuantity,
                            movement.unit,
                          )}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : !erroMovimentacoes ? (
            <div className="py-12 text-center">
              <History className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma movimentação ainda</p>
              <p className="mt-2 text-xs text-muted-foreground">
                As entradas e saídas deste item aparecerão aqui.
              </p>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-border/70 bg-muted/20 p-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Voltar aos detalhes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
