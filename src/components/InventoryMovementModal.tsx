import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, CalendarClock, Target } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import {
  formatInventoryCalendarDate,
  formatInventoryDate,
  formatInventoryQuantity,
  inventoryMovementMap,
} from "@/lib/inventory";

interface InventoryMovementModalProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: InventoryMovement["type"];
}

export function InventoryMovementModal({
  item,
  open,
  onOpenChange,
  initialType = "entrada",
}: InventoryMovementModalProps) {
  const [movementType, setMovementType] = useState<InventoryMovement["type"]>(initialType);
  const [quantity, setQuantity] = useState("");
  const { adjustItemQuantity, movements } = useInventory();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }

    setMovementType(initialType);
    setQuantity("");
  }, [initialType, open, item?.id]);

  const itemMovements = useMemo(
    () => (item ? movements.filter((movement) => movement.itemId === item.id) : []),
    [item, movements],
  );
  const latestMovement = itemMovements[0];

  const numericQuantity = Number(quantity);
  const hasValidQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0;
  const exceedsAvailable = !!item && movementType === "saida" && hasValidQuantity && numericQuantity > item.quantity;
  const projectedQuantity = item
    ? Math.max(0, item.quantity + (movementType === "entrada" ? numericQuantity || 0 : -(numericQuantity || 0)))
    : 0;
  const actionMeta = inventoryMovementMap[movementType];
  const plannedTimestamp = formatInventoryDate(new Date().toISOString());
  const plannedQuantity = item
    ? hasValidQuantity
      ? formatInventoryQuantity(numericQuantity, item.unit)
      : `Aguardando valor em ${item.unit}`
    : "Aguardando valor";
  const latestMovementLabel = latestMovement ? formatInventoryDate(latestMovement.createdAt) : "Nenhuma movimentacao ainda";
  const itemDeadlineLabel = item && item.targetQuantity > 0 ? formatInventoryCalendarDate(item.deadline) : "Sem reserva";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!item) {
      return;
    }

    if (!hasValidQuantity) {
      toast({
        title: "Quantidade invalida",
        description: "Informe um valor maior que zero para movimentar este item.",
        variant: "destructive",
      });
      return;
    }

    if (exceedsAvailable) {
      toast({
        title: "Saida acima do saldo",
        description: "A quantidade de saida nao pode ultrapassar o saldo disponivel deste item.",
        variant: "destructive",
      });
      return;
    }

    const result = await adjustItemQuantity({
      itemId: item.id,
      quantity: numericQuantity,
      type: movementType,
    });

    if (!result.success) {
      toast({
        title: "Movimentacao nao concluida",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: movementType === "entrada" ? "Entrada registrada" : "Saida registrada",
      description: result.message,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-4xl">
        <div className="border-b border-border bg-muted/30 px-6 py-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-2xl">Movimentar estoque</DialogTitle>
            <DialogDescription className="max-w-2xl leading-6">
              Registre entradas e saidas com mais contexto. O comentario fica salvo no historico do item e aparece
              junto das atualizacoes recentes da operacao.
            </DialogDescription>
          </DialogHeader>

          {item && (
            <div className="mt-5 rounded-[24px] border border-border/70 bg-background/85 p-4">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.type}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <Tabs value={movementType} onValueChange={(value) => setMovementType(value as InventoryMovement["type"])}>
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted p-1">
              <TabsTrigger value="entrada" className="gap-2 rounded-xl py-3">
                <ArrowUpRight className="h-4 w-4" />
                Entrada
              </TabsTrigger>
              <TabsTrigger value="saida" className="gap-2 rounded-xl py-3">
                <ArrowDownRight className="h-4 w-4" />
                Saida
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {item && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex flex-col rounded-[24px] border border-border/70 bg-card p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Boxes className="h-4 w-4" />
                    Saldo atual
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatInventoryQuantity(item.quantity, item.unit)}
                  </p>
                </div>

                <div className="flex flex-col rounded-[24px] border border-border/70 bg-card p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Reserva vinculada
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatInventoryQuantity(item.targetQuantity, item.unit)}
                  </p>
                </div>

                <div
                  className={`flex flex-col rounded-[24px] border p-4 ${
                    exceedsAvailable ? "border-destructive/30 bg-destructive/5" : "border-border/70 bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {movementType === "entrada" ? (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    Saldo projetado
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatInventoryQuantity(projectedQuantity, item.unit)}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/[0.18] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">Painel rapido do registro</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Horario previsto, prazo do item e ultima leitura reunidos para facilitar a movimentacao.
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${actionMeta.className}`}
                  >
                    {actionMeta.label}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Registro previsto</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{plannedTimestamp}</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Volume informado</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{plannedQuantity}</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prazo da reserva</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{itemDeadlineLabel}</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Ultima atualizacao
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{latestMovementLabel}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latestMovement
                        ? `Saldo resultante: ${formatInventoryQuantity(latestMovement.resultingQuantity, latestMovement.unit)}`
                        : "O historico aparece aqui assim que a primeira movimentacao for salva."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-card p-4">
                <Label htmlFor="movement-quantity">Quantidade a movimentar</Label>
                <div className="relative mt-3">
                  <Input
                    id="movement-quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={item ? `Ex.: ${item.unit === "kg" ? "250" : "10"}` : "0"}
                    className="h-12 pr-16 text-lg"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {item?.unit ?? "un"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {actionMeta.label} em {item?.unit ?? "unidade"} para atualizar o saldo do item.
                </p>
                {exceedsAvailable && (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    A saida informada ultrapassa o saldo disponivel deste item.
                  </p>
                )}
              </div>

              <div className={`rounded-[24px] border px-4 py-3 text-sm ${actionMeta.className}`}>
                {movementType === "entrada"
                  ? "Use entrada para registrar novo volume recebido, retornado ou reclassificado no estoque."
                  : "Use saida para registrar consumo interno, descarte, venda ou qualquer baixa operacional do item."}
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 border-t border-border pt-5 sm:justify-between sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={!item || !hasValidQuantity || exceedsAvailable}>
              {movementType === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              Registrar {movementType === "entrada" ? "entrada" : "saida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
