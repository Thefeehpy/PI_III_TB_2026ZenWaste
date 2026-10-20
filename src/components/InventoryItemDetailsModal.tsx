import { useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  History,
  Loader2,
  Package2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryMovementModal } from "@/components/InventoryMovementModal";
import { InventoryReservationModal } from "@/components/InventoryReservationModal";
import { InventoryMovementHistoryModal } from "@/components/InventoryMovementHistoryModal";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem } from "@/data/mockData";
import { toast } from "sonner";
import {
  formatInventoryCalendarDate,
  formatInventoryQuantity,
  inventoryStatusMap,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface InventoryItemDetailsModalProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemDeleted?: () => void;
}

type ItemAction = "reservation" | "entrada" | "saida" | "history" | "delete";

export function InventoryItemDetailsModal(
  props: InventoryItemDetailsModalProps,
) {
  if (!props.item || !props.open) return null;
  return <ItemDetails key={props.item.id} {...props} item={props.item} />;
}

function ItemDetails({
  item,
  open,
  onOpenChange,
  onItemDeleted,
}: InventoryItemDetailsModalProps & { item: InventoryItem }) {
  const [action, setAction] = useState<ItemAction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const actionButton = useRef<HTMLButtonElement | null>(null);
  const deleteLock = useRef(false);
  const { deleteItem, movements } = useInventory();
  const status = inventoryStatusMap[item.status];
  const reserved = item.targetQuantity > 0;
  const missing = Math.max(item.targetQuantity - item.quantity, 0);
  const free = Math.max(item.quantity - item.targetQuantity, 0);
  const coverage = reserved
    ? Math.min(100, Math.round((item.quantity / item.targetQuantity) * 100))
    : 0;
  const movementCount = movements.filter(
    (movement) => movement.itemId === item.id,
  ).length;
  const openAction = (next: ItemAction, trigger: HTMLButtonElement) => {
    actionButton.current = trigger;
    setAction(next);
  };
  const closeAction = (next: boolean) => {
    if (!next) setAction(null);
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    actionButton.current?.focus();
  };

  const handleDelete = async () => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    try {
      const result = await deleteItem(item.id);
      if (!result.success) {
        toast.error("Item não excluído", { description: result.message });
        return;
      }
      toast.success("Item excluído", { description: result.message });
      onOpenChange(false);
      onItemDeleted?.();
    } catch {
      toast.error("Item não excluído", {
        description: "Não foi possível excluir o item. Tente novamente.",
      });
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!action) onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid="inventory-details-modal"
        closeLabel="Fechar detalhes"
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-[28px] border-border/70 p-0 shadow-2xl sm:rounded-[28px]"
      >
        <DialogHeader className="shrink-0 px-6 pb-5 pt-6 text-left sm:px-7">
          <div className="flex items-center gap-4 pr-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="break-words text-2xl font-semibold tracking-tight">
                {item.name}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm">
                {item.type}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 pb-5 sm:px-7">
          <div className="rounded-[22px] border border-primary/15 bg-primary/[0.045] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Saldo em estoque
              </p>
              <Badge
                variant={status.badgeVariant}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium",
                  status.className,
                )}
              >
                {!reserved && item.quantity > 0 ? "Disponível" : status.label}
              </Badge>
            </div>
            <p
              className="mt-2 flex flex-wrap items-baseline gap-x-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
              data-testid="inventory-current-balance"
            >
              {item.quantity.toLocaleString("pt-BR")}
              <span className="text-lg font-medium tracking-normal text-muted-foreground">
                {item.unit}
              </span>
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-primary/10 pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Reservado</p>
                <p className="mt-1.5 font-semibold">
                  {reserved
                    ? formatInventoryQuantity(item.targetQuantity, item.unit)
                    : "Sem reserva"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Livre após reserva
                </p>
                <p className="mt-1.5 font-semibold">
                  {formatInventoryQuantity(free, item.unit)}
                </p>
              </div>
            </div>
          </div>
          {reserved ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <p className="text-muted-foreground">Cobertura da reserva</p>
                <span className="font-semibold text-primary">{coverage}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Cobertura da reserva"
                aria-valuenow={coverage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: String(coverage) + "%" }}
                />
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {missing > 0 ? (
                  <>
                    Faltam{" "}
                    <strong className="font-semibold text-foreground">
                      {formatInventoryQuantity(missing, item.unit)}
                    </strong>{" "}
                    para cobrir a reserva.
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Reserva totalmente coberta.
                  </>
                )}
              </p>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Prazo da reserva
            </span>
            <span className="font-medium">
              {reserved && item.deadline
                ? formatInventoryCalendarDate(item.deadline)
                : "Não definido"}
            </span>
          </div>
        </div>
        <footer className="shrink-0 border-t border-border/70 bg-muted/20 px-5 pb-3 pt-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-2 whitespace-normal rounded-2xl bg-card px-2 py-3 text-xs sm:h-12 sm:flex-row sm:text-sm"
              onClick={(e) => openAction("reservation", e.currentTarget)}
            >
              <Pencil className="h-4 w-4" />
              {reserved ? "Editar reserva" : "Criar reserva"}
            </Button>
            <Button
              type="button"
              className="h-auto min-w-0 flex-col gap-2 rounded-2xl px-2 py-3 text-xs sm:h-12 sm:flex-row sm:text-sm"
              onClick={(e) => openAction("entrada", e.currentTarget)}
            >
              <ArrowUpRight className="h-4 w-4" />
              Entrada
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col gap-2 rounded-2xl border-destructive/20 bg-card px-2 py-3 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive sm:h-12 sm:flex-row sm:text-sm"
              onClick={(e) => openAction("saida", e.currentTarget)}
            >
              <ArrowDownRight className="h-4 w-4" />
              Saída
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-1.5 rounded-xl px-2 text-xs text-muted-foreground"
              onClick={(e) => openAction("history", e.currentTarget)}
            >
              <History className="h-3.5 w-3.5" />
              Histórico{movementCount ? " (" + movementCount + ")" : ""}
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-xl px-2 text-xs text-muted-foreground hover:bg-destructive/5 hover:text-destructive"
              onClick={(e) => openAction("delete", e.currentTarget)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir item
            </Button>
          </div>
        </footer>

        <InventoryReservationModal
          item={item}
          open={action === "reservation"}
          onOpenChange={closeAction}
          onCloseAutoFocus={restoreFocus}
        />
        <InventoryMovementModal
          item={item}
          open={action === "entrada" || action === "saida"}
          onOpenChange={closeAction}
          initialType={action === "saida" ? "saida" : "entrada"}
          onCloseAutoFocus={restoreFocus}
        />
        <InventoryMovementHistoryModal
          item={item}
          open={action === "history"}
          onOpenChange={closeAction}
          onCloseAutoFocus={restoreFocus}
        />
        <AlertDialog
          open={action === "delete"}
          onOpenChange={(next) => {
            if (!deleting) closeAction(next);
          }}
        >
          <AlertDialogContent
            onCloseAutoFocus={restoreFocus}
            className="z-[70] w-[calc(100%-2rem)] rounded-3xl sm:rounded-3xl"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {item.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                O item será removido do estoque e os anúncios vinculados serão
                encerrados. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                className="rounded-xl"
                onClick={() => setAction(null)}
              >
                Manter item
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                className="rounded-xl"
                onClick={() => void handleDelete()}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Excluindo…" : "Confirmar exclusão"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
