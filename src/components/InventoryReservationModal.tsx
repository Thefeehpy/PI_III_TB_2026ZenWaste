import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarClock, Loader2, Target } from "lucide-react";
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
import { useEstoque } from "@/contexts/InventoryContext";
import type { ItemEstoque } from "@/types/estoque";
import { toast } from "sonner";
import { formatInventoryQuantity } from "@/lib/inventory";

interface InventoryReservationModalProps {
  item: ItemEstoque;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function InventoryReservationModal({
  item,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: InventoryReservationModalProps) {
  const [quantity, setQuantity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const latestItem = useRef(item);
  latestItem.current = item;
  const { atualizarItem } = useEstoque();
  // Atualiza o rascunho ao abrir, preservando a edição durante consultas ao estoque.
  useEffect(() => {
    const current = latestItem.current;
    if (open) {
      setQuantity(
        current.targetQuantity > 0 ? String(current.targetQuantity) : "",
      );
      setDeadline(current.targetQuantity > 0 ? current.deadline : "");
      setError("");
    }
  }, [open, item.id]);
  const numeric = Number(quantity);
  const valid =
    Number.isFinite(numeric) &&
    numeric >= 0.001 &&
    numeric <= 999999999.999 &&
    Number(numeric.toFixed(3)) === numeric;
  const changeOpen = (next: boolean) => {
    if (!lock.current) onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || !valid || !deadline) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await atualizarItem({
        itemId: item.id,
        targetQuantity: numeric,
        deadline,
      });
      if (!result.sucesso) {
        setError(result.mensagem);
        return;
      }
      toast.success("Reserva atualizada", { description: result.mensagem });
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar a reserva. Tente novamente.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        closeLabel="Fechar reserva"
        overlayClassName="z-[60] bg-black/40 backdrop-blur-[2px]"
        className="z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:rounded-[28px]"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 p-6 pb-5 text-left">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </span>
          <DialogTitle className="text-xl">
            {item.targetQuantity > 0 ? "Editar reserva" : "Criar reserva"}
          </DialogTitle>
          <DialogDescription className="break-words">
            Defina a meta de captação e o prazo para {item.name}. Esta meta não compromete o saldo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <fieldset
            disabled={saving}
            className="min-h-0 space-y-5 overflow-y-auto px-6 pb-6"
          >
            <p className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 text-xs">
              <span className="text-muted-foreground">Saldo físico</span>
              <strong className="font-semibold">
                {formatInventoryQuantity(item.quantity, item.unit)}
              </strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="reservation-quantity">
                Quantidade reservada ({item.unit})
              </Label>
              <Input
                id="reservation-quantity"
                type="number"
                inputMode="decimal"
                min="0.001"
                max="999999999.999"
                step="0.001"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError("");
                }}
                className="h-12 rounded-xl"
                placeholder="0,000"
                required
                aria-invalid={quantity !== "" && !valid}
                aria-describedby="reservation-quantity-help"
              />
              <p
                id="reservation-quantity-help"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {quantity !== "" && !valid
                  ? "Informe uma quantidade válida, com até três casas decimais."
                  : valid && numeric > item.quantity
                    ? "O volume que falta ficará indicado como reserva pendente."
                    : "Meta de captação; compromissos de venda são contabilizados separadamente."}
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="reservation-deadline"
                className="flex items-center gap-2"
              >
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                Prazo da reserva
              </Label>
              <Input
                id="reservation-deadline"
                type="date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setError("");
                }}
                className="h-12 rounded-xl"
                required
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
              disabled={saving || !valid || !deadline}
              className="h-11 flex-1 rounded-xl"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Salvando…" : "Salvar reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
