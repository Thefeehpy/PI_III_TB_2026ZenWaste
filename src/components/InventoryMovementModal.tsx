import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import {
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
  const { adjustItemQuantity } = useInventory();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      return;
    }

    setMovementType(initialType);
    setQuantity("");
    setNote("");
  }, [initialType, open, item?.id]);

  const numericQuantity = Number(quantity);
  const hasValidQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0;
  const exceedsAvailable = !!item && movementType === "saida" && hasValidQuantity && numericQuantity > item.quantity;
  const projectedQuantity = item
    ? Math.max(0, item.quantity + (movementType === "entrada" ? numericQuantity || 0 : -(numericQuantity || 0)))
    : 0;
  const projectedStatus = item ? inventoryStatusMap[getInventoryItemStatus(projectedQuantity, item.targetQuantity)] : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!item) {
      return;
    }

    if (!hasValidQuantity) {
      toast({
        title: "Quantidade inválida",
        description: "Informe um valor maior que zero para movimentar este item.",
        variant: "destructive",
      });
      return;
    }

    if (exceedsAvailable) {
      toast({
        title: "Saída acima do saldo",
        description: "A quantidade de saída não pode ultrapassar o saldo disponível deste item.",
        variant: "destructive",
      });
      return;
    }

    const result = await adjustItemQuantity({
      itemId: item.id,
      quantity: numericQuantity,
      type: movementType,
      note,
    });

    if (!result.success) {
      toast({
        title: "Movimentação não concluída",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: movementType === "entrada" ? "Entrada registrada" : "Saída registrada",
      description: result.message,
    });

    onOpenChange(false);
  };

  const actionMeta = inventoryMovementMap[movementType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-muted/40 px-6 py-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-2xl">Movimentar estoque</DialogTitle>
            <DialogDescription className="max-w-xl leading-6">
              Registre entradas e saídas com segurança para manter o saldo do item sempre atualizado.
            </DialogDescription>
          </DialogHeader>

          {item && (
            <div className="mt-5 rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.type}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <Tabs value={movementType} onValueChange={(value) => setMovementType(value as InventoryMovement["type"])}>
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
              <TabsTrigger value="entrada" className="gap-2 rounded-lg py-2.5">
                <ArrowUpRight className="h-4 w-4" />
                Entrada
              </TabsTrigger>
              <TabsTrigger value="saida" className="gap-2 rounded-lg py-2.5">
                <ArrowDownRight className="h-4 w-4" />
                Saída
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {item && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Boxes className="h-4 w-4" />
                  Saldo atual
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {formatInventoryQuantity(item.quantity, item.unit)}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Meta do item
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {formatInventoryQuantity(item.targetQuantity, item.unit)}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
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
                {projectedStatus && (
                  <p className="mt-2 text-xs text-muted-foreground">{projectedStatus.description}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <Label htmlFor="movement-quantity">Quantidade</Label>
              <Input
                id="movement-quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={item ? `Ex.: ${item.unit === "kg" ? "250" : "10"}` : "0"}
                required
              />
              <p className="text-xs text-muted-foreground">
                {actionMeta.label} em {item?.unit ?? "unidade"}.
              </p>
              {exceedsAvailable && (
                <p className="text-xs font-medium text-destructive">
                  A saída informada ultrapassa o saldo disponível deste item.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement-note">Observação da movimentação</Label>
              <Textarea
                id="movement-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  movementType === "entrada"
                    ? "Ex.: lote recebido do setor de produção ou retorno de triagem."
                    : "Ex.: baixa por venda, consumo interno, perda operacional ou descarte."
                }
                rows={4}
              />
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-sm ${actionMeta.className}`}>
            {movementType === "entrada"
              ? "Use entrada para registrar novo volume recebido, retornado ou reclassificado no estoque."
              : "Use saída para registrar consumo interno, descarte, venda ou qualquer baixa operacional do item."}
          </div>

          <DialogFooter className="gap-3 border-t border-border pt-5 sm:justify-between sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2"
              disabled={!item || !hasValidQuantity || exceedsAvailable}
            >
              {movementType === "entrada" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              Registrar {movementType === "entrada" ? "entrada" : "saída"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
