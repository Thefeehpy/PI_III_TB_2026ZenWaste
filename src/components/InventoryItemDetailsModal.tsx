import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Clock3, Package2, Target, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import {
  formatInventoryCalendarDate,
  formatInventoryDate,
  formatInventoryQuantity,
  inventoryMovementMap,
  inventoryStatusMap,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface InventoryItemDetailsModalProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestMovement: (item: InventoryItem, type: InventoryMovement["type"]) => void;
  onItemDeleted?: () => void;
}

type ReservationDraft = {
  targetQuantity: string;
  deadline: string;
};

function buildReservationDraft(item: InventoryItem): ReservationDraft {
  const hasReservation = item.targetQuantity > 0;

  return {
    targetQuantity: hasReservation ? String(item.targetQuantity) : "",
    deadline: hasReservation ? item.deadline : "",
  };
}

export function InventoryItemDetailsModal({
  item,
  open,
  onOpenChange,
  onRequestMovement,
  onItemDeleted,
}: InventoryItemDetailsModalProps) {
  const [isEditingReservation, setIsEditingReservation] = useState(false);
  const [isSavingReservation, setIsSavingReservation] = useState(false);
  const [reservationDraft, setReservationDraft] = useState<ReservationDraft>({
    targetQuantity: "",
    deadline: "",
  });
  const { deleteItem, movements, updateItem } = useInventory();
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !item) {
      setIsEditingReservation(false);
      setIsSavingReservation(false);
      setReservationDraft({
        targetQuantity: "",
        deadline: "",
      });
      return;
    }

    setIsEditingReservation(false);
    setIsSavingReservation(false);
    setReservationDraft(buildReservationDraft(item));
  }, [open, item]);

  const itemMovements = useMemo(
    () => (item ? movements.filter((movement) => movement.itemId === item.id) : []),
    [item, movements],
  );

  if (!item) {
    return null;
  }

  const status = inventoryStatusMap[item.status];
  const hasReservation = item.targetQuantity > 0;
  const reservationGap = Math.max(item.targetQuantity - item.quantity, 0);
  const availableAfterReservation = Math.max(item.quantity - item.targetQuantity, 0);
  const latestMovement = itemMovements[0];
  const handleSaveReservation = async () => {
    const numericTargetQuantity = Number(reservationDraft.targetQuantity);

    if (!Number.isFinite(numericTargetQuantity) || numericTargetQuantity <= 0) {
      toast({
        title: "Reserva invalida",
        description: "Informe uma quantidade reservada maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (!reservationDraft.deadline) {
      toast({
        title: "Prazo obrigatorio",
        description: "Defina o prazo da reserva antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingReservation(true);

    const result = await updateItem({
      itemId: item.id,
      targetQuantity: numericTargetQuantity,
      deadline: reservationDraft.deadline,
    });

    setIsSavingReservation(false);

    if (!result.success) {
      toast({
        title: "Reserva nao atualizada",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Reserva atualizada",
      description: result.message,
    });

    setIsEditingReservation(false);
  };

  const handleOpenMovement = (type: InventoryMovement["type"]) => {
    onOpenChange(false);
    onRequestMovement(item, type);
  };

  const handleDeleteItem = async () => {
    const result = await deleteItem(item.id);

    if (!result.success) {
      toast({
        title: "Item nao excluido",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Item excluido",
      description: result.message,
    });

    onOpenChange(false);
    onItemDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-5xl">
        <div className="border-b border-border bg-muted/30 px-6 py-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="text-2xl">{item.name}</DialogTitle>
                <DialogDescription className="mt-2 max-w-3xl leading-6">
                  Consulte as informacoes completas deste produto, acompanhe entradas e saidas e ajuste a reserva do
                  cliente no mesmo lugar.
                </DialogDescription>
              </div>

              <Badge variant={status.badgeVariant} className={cn("w-fit rounded-full px-3 py-1", status.className)}>
                {status.label}
              </Badge>
            </div>
          </DialogHeader>

          <div className="mt-5 rounded-[24px] border border-border/70 bg-background/85 p-4">
            <p className="text-sm font-medium text-foreground">{item.type}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{status.description}</p>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package2 className="h-4 w-4" />
                Saldo atual
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {formatInventoryQuantity(item.quantity, item.unit)}
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Reserva do cliente
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {hasReservation ? formatInventoryQuantity(item.targetQuantity, item.unit) : "Sem reserva"}
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                Prazo
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {hasReservation ? formatInventoryCalendarDate(item.deadline) : "Nao definido"}
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Ultima atualizacao
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">{formatInventoryDate(item.updatedAt)}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-muted/[0.18] p-4">
                <p className="font-medium text-foreground">Observacao rapida</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {!hasReservation
                    ? "Este item ainda nao possui reserva de cliente. Cadastre uma reserva quando houver um compromisso de entrega."
                    : reservationGap > 0
                      ? `Ainda faltam ${formatInventoryQuantity(reservationGap, item.unit)} para cobrir a reserva atual deste produto.`
                      : `A reserva ja esta coberta. Restam ${formatInventoryQuantity(availableAfterReservation, item.unit)} livres apos o compromisso atual.`}
                </p>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">Reserva de cliente</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cadastre ou ajuste a quantidade reservada e o prazo diretamente neste modal.
                    </p>
                  </div>
                  {!isEditingReservation && (
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsEditingReservation(true)}>
                      {hasReservation ? "Editar reserva" : "Cadastrar reserva"}
                    </Button>
                  )}
                </div>

                {isEditingReservation ? (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Quantidade reservada</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={reservationDraft.targetQuantity}
                        onChange={(event) =>
                          setReservationDraft((current) => ({
                            ...current,
                            targetQuantity: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Prazo da reserva</label>
                      <Input
                        type="date"
                        value={reservationDraft.deadline}
                        onChange={(event) =>
                          setReservationDraft((current) => ({
                            ...current,
                            deadline: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-xl"
                        onClick={() => {
                          setIsEditingReservation(false);
                          setReservationDraft(buildReservationDraft(item));
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 rounded-xl"
                        onClick={handleSaveReservation}
                        disabled={isSavingReservation}
                      >
                        {isSavingReservation ? "Salvando..." : "Salvar reserva"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 text-sm">
                    {hasReservation ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Quantidade reservada</span>
                          <span className="font-medium text-foreground">
                            {formatInventoryQuantity(item.targetQuantity, item.unit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Prazo da reserva</span>
                          <span className="font-medium text-foreground">{formatInventoryCalendarDate(item.deadline)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {reservationGap > 0 ? "Volume faltante" : "Volume livre apos reserva"}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatInventoryQuantity(
                              reservationGap > 0 ? reservationGap : availableAfterReservation,
                              item.unit,
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-muted-foreground">
                        Nenhuma reserva cadastrada para este item.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-border/70 bg-card p-4">
                <p className="font-medium text-foreground">Acoes do estoque</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abra o fluxo de movimentacao para registrar novas entradas ou saidas deste produto.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="h-12 justify-between rounded-2xl bg-primary/10 px-4 text-primary hover:bg-primary/15"
                    variant="ghost"
                    onClick={() => handleOpenMovement("entrada")}
                  >
                    Registrar entrada
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    className="h-12 justify-between rounded-2xl bg-destructive/10 px-4 text-destructive hover:bg-destructive/15"
                    variant="ghost"
                    onClick={() => handleOpenMovement("saida")}
                  >
                    Registrar saida
                    <ArrowDownRight className="h-4 w-4" />
                  </Button>
                </div>

                {latestMovement && (
                  <div className="mt-4 rounded-2xl border border-border/70 bg-muted/[0.18] p-3 text-sm">
                    <p className="text-muted-foreground">Ultimo movimento</p>
                    <p className="mt-2 font-medium text-foreground">
                      {inventoryMovementMap[latestMovement.type].label} em {formatInventoryDate(latestMovement.createdAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card p-4">
              <p className="font-medium text-foreground">Entradas e saidas do item</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Historico completo das movimentacoes registradas para este produto.
              </p>

              {itemMovements.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma movimentacao registrada ainda para este item.
                </div>
              ) : (
                <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                  {itemMovements.map((movement) => {
                    const movementMeta = inventoryMovementMap[movement.type];

                    return (
                      <div key={movement.id} className="rounded-2xl border border-border/70 bg-muted/[0.14] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={movementMeta.badgeVariant}
                                className={cn("rounded-full px-2.5 py-0.5 text-xs", movementMeta.className)}
                              >
                                {movementMeta.label}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">
                                {formatInventoryQuantity(movement.quantity, movement.unit)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{formatInventoryDate(movement.createdAt)}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Saldo apos registro</p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatInventoryQuantity(movement.resultingQuantity, movement.unit)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {movement.note || "Movimentacao registrada sem observacao adicional."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Excluir item
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acao remove o item do estoque e encerra os anuncios vinculados a ele.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteItem}>
                    Excluir item
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
