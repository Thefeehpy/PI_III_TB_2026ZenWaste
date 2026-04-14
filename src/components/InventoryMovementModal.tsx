import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, CalendarClock, MessageSquareMore, Target } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import {
  formatInventoryDate,
  formatInventoryQuantity,
  getInventoryItemStatus,
  inventoryMovementMap,
  inventoryStatusMap,
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
  const [note, setNote] = useState("");
  const { adjustItemQuantity, movements } = useInventory();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }

    setMovementType(initialType);
    setQuantity("");
    setNote("");
  }, [initialType, open, item?.id]);

  const itemMovements = useMemo(
    () => (item ? movements.filter((movement) => movement.itemId === item.id) : []),
    [item, movements],
  );
  const recentNotes = itemMovements.filter((movement) => movement.note).slice(0, 3);
  const latestMovement = itemMovements[0];

  const numericQuantity = Number(quantity);
  const hasValidQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0;
  const exceedsAvailable = !!item && movementType === "saida" && hasValidQuantity && numericQuantity > item.quantity;
  const projectedQuantity = item
    ? Math.max(0, item.quantity + (movementType === "entrada" ? numericQuantity || 0 : -(numericQuantity || 0)))
    : 0;
  const projectedStatus = item ? inventoryStatusMap[getInventoryItemStatus(projectedQuantity, item.targetQuantity)] : null;
  const actionMeta = inventoryMovementMap[movementType];

  const handleSubmit = (event: React.FormEvent) => {
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

    const result = adjustItemQuantity({
      itemId: item.id,
      quantity: numericQuantity,
      type: movementType,
      note,
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
              junto das atualizacoes no grafico.
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-border/70 bg-card p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Boxes className="h-4 w-4" />
                    Saldo atual
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatInventoryQuantity(item.quantity, item.unit)}
                  </p>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Meta do item
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatInventoryQuantity(item.targetQuantity, item.unit)}
                  </p>
                </div>

                <div
                  className={`rounded-[24px] border p-4 ${
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
                <p className="font-medium text-foreground">Resumo da operacao</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Esta atualizacao sera registrada com a data atual, entrara no historico do item e aparecera como um
                  novo ponto no grafico de evolucao.
                </p>

                {projectedStatus && (
                  <div className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status apos registro</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{projectedStatus.label}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{projectedStatus.description}</p>
                  </div>
                )}

                {latestMovement && (
                  <div className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Ultima atualizacao
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{formatInventoryDate(latestMovement.createdAt)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Saldo resultante: {formatInventoryQuantity(latestMovement.resultingQuantity, latestMovement.unit)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
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

            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-card p-4">
                <Label htmlFor="movement-note">Comentario da atualizacao</Label>
                <Textarea
                  id="movement-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    movementType === "entrada"
                      ? "Ex.: lote recebido do setor de producao, material revisado e liberado."
                      : "Ex.: baixa por venda, consumo interno, perda operacional ou descarte."
                  }
                  rows={6}
                  className="mt-3 resize-none"
                />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Esse comentario fica salvo no historico do item e ajuda a interpretar as mudancas mostradas no
                  grafico.
                </p>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/[0.18] p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-foreground">Comentarios recentes</p>
                </div>

                {recentNotes.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/80 p-4 text-sm text-muted-foreground">
                    Ainda nao ha comentarios salvos para este item.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {recentNotes.map((movement) => (
                      <div key={movement.id} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">
                            {movement.type === "entrada" ? "Entrada" : "Saida"}
                          </p>
                          <span className="text-xs text-muted-foreground">{formatInventoryDate(movement.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{movement.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

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
