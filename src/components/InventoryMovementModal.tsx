import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { toast } from "sonner";
import { formatInventoryQuantity } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface InventoryMovementModalProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: InventoryMovement["type"];
  onCloseAutoFocus?: (event: Event) => void;
}

export function InventoryMovementModal({
  item,
  open,
  onOpenChange,
  initialType = "entrada",
  onCloseAutoFocus,
}: InventoryMovementModalProps) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const { adjustItemQuantity } = useInventory();
  useEffect(() => {
    if (open) {
      setQuantity("");
      setNote("");
      setError("");
    }
  }, [open, item?.id, initialType]);
  if (!item) return null;
  const entry = initialType === "entrada";
  const numeric = Number(quantity);
  const valid =
    Number.isFinite(numeric) &&
    numeric >= 0.001 &&
    numeric <= 9999999.999 &&
    Math.abs(numeric * 1000 - Math.round(numeric * 1000)) < 0.000001;
  const exceeds = !entry && valid && numeric > item.quantity;
  const projected = item.quantity + (valid ? (entry ? numeric : -numeric) : 0);
  const Icon = entry ? ArrowUpRight : ArrowDownRight;
  const changeOpen = (next: boolean) => {
    if (!lock.current) onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || !valid || exceeds) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await adjustItemQuantity({
        itemId: item.id,
        quantity: numeric,
        type: initialType,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      toast.success(entry ? "Entrada registrada" : "Saída registrada", {
        description: result.message,
      });
      onOpenChange(false);
    } catch {
      setError("Não foi possível registrar a movimentação. Tente novamente.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel="Fechar movimentação"
        overlayClassName="z-[60] bg-black/40 backdrop-blur-[2px]"
        className="z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:rounded-[28px]"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 p-6 pb-5 text-left">
          <span
            className={cn(
              "mb-2 flex h-11 w-11 items-center justify-center rounded-2xl",
              entry
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <DialogTitle className="text-xl">
            Registrar {entry ? "entrada" : "saída"}
          </DialogTitle>
          <DialogDescription className="break-words">
            {item.name} · {item.type}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <fieldset
            disabled={saving}
            className="min-h-0 space-y-5 overflow-y-auto px-6 pb-6"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Saldo atual</p>
                <p className="mt-1.5 break-words text-lg font-semibold">
                  {formatInventoryQuantity(item.quantity, item.unit)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">
                  Após {entry ? "entrada" : "saída"}
                </p>
                <p
                  className={cn(
                    "mt-1.5 break-words text-lg font-semibold",
                    exceeds ? "text-destructive" : "text-primary",
                  )}
                  data-testid="movement-projected-balance"
                >
                  {exceeds
                    ? "Saldo insuficiente"
                    : formatInventoryQuantity(
                        Number(projected.toFixed(3)),
                        item.unit,
                      )}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-quantity">
                Quantidade ({item.unit})
              </Label>
              <Input
                id="movement-quantity"
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.001"
                max={entry ? 9999999.999 : item.quantity}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError("");
                }}
                placeholder="0,000"
                className="h-12 rounded-xl text-lg"
                required
                aria-invalid={exceeds || (quantity !== "" && !valid)}
                aria-describedby="movement-quantity-help"
              />
              <p
                id="movement-quantity-help"
                className={cn(
                  "text-xs leading-relaxed",
                  exceeds || (quantity !== "" && !valid)
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {exceeds
                  ? "A saída não pode ultrapassar o saldo disponível."
                  : quantity !== "" && !valid
                    ? "Informe uma quantidade válida, com até três casas decimais."
                    : entry
                      ? "Informe o volume recebido para somar ao estoque."
                      : "Informe o volume que será retirado do estoque."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-note">
                Observação{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Textarea
                id="movement-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={255}
                placeholder={
                  entry
                    ? "Ex.: recebimento de um novo lote"
                    : "Ex.: material enviado para produção"
                }
                className="min-h-20 resize-none rounded-xl"
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </fieldset>
          <DialogFooter className="shrink-0 flex-row gap-2 border-t border-border/70 bg-muted/20 p-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              className="h-11 flex-1 rounded-xl"
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !valid || exceeds}
              className={cn(
                "h-11 flex-1 rounded-xl",
                !entry &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {saving ? "Registrando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
