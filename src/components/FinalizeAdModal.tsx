import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { SellerAd } from "@/data/mockData";
import { formatInventoryQuantity } from "@/lib/inventory";

interface FinalizeAdModalProps {
  ad: SellerAd | null;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    soldQuantity: number;
    buyerName: string;
    buyerPhone: string;
    reservationQuantity?: number;
    reservationUnitPrice?: number;
    reservationNote?: string;
  }) => Promise<void>;
}

export function FinalizeAdModal({ ad, open, isSubmitting, onOpenChange, onSubmit }: FinalizeAdModalProps) {
  const [soldQuantity, setSoldQuantity] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [createReservation, setCreateReservation] = useState(false);
  const [reservationQuantity, setReservationQuantity] = useState("");
  const [reservationUnitPrice, setReservationUnitPrice] = useState("");
  const [reservationNote, setReservationNote] = useState("");

  useEffect(() => {
    if (ad && open) {
      setSoldQuantity(String(ad.quantity));
      setBuyerName("");
      setBuyerPhone("");
      setCreateReservation(false);
      setReservationQuantity("");
      setReservationUnitPrice(String(ad.price));
      setReservationNote("");
    }
  }, [ad, open]);

  const remainingAfterSale = useMemo(() => {
    if (!ad) {
      return 0;
    }
    const sold = Number(soldQuantity);
    return Math.max(ad.availableQuantity - (Number.isFinite(sold) ? sold : 0), 0);
  }, [ad, soldQuantity]);

  if (!ad) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Finalizar venda do anuncio
          </DialogTitle>
          <DialogDescription>
            A venda encerra o anuncio, registra saida no estoque e pode gerar uma reserva futura para o comprador.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/25 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">{ad.name}</p>
              <p className="text-sm text-muted-foreground">{ad.type}</p>
            </div>
            <p className="text-right text-sm font-medium text-primary">
              {formatInventoryQuantity(ad.availableQuantity, ad.unit)} em estoque
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sold-quantity">Quantidade vendida</Label>
            <Input
              id="sold-quantity"
              type="number"
              min="0.001"
              max={ad.availableQuantity}
              step="0.001"
              value={soldQuantity}
              onChange={(event) => setSoldQuantity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-name">Comprador</Label>
            <Input id="buyer-name" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-phone">Numero</Label>
            <Input id="buyer-phone" value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} />
          </div>
        </div>

        <div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Saldo apos a venda: {formatInventoryQuantity(remainingAfterSale, ad.unit)}
        </div>

        <div className="space-y-4 rounded-md border border-border p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="create-reservation"
              checked={createReservation}
              onCheckedChange={(checked) => setCreateReservation(Boolean(checked))}
            />
            <Label htmlFor="create-reservation">Criar reserva futura para este comprador</Label>
          </div>

          {createReservation && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reservation-quantity">Quantidade reservada</Label>
                  <Input
                    id="reservation-quantity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={reservationQuantity}
                    onChange={(event) => setReservationQuantity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reservation-price">Preco unitario</Label>
                  <Input
                    id="reservation-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reservationUnitPrice}
                    onChange={(event) => setReservationUnitPrice(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation-note">Observacao</Label>
                <Textarea
                  id="reservation-note"
                  value={reservationNote}
                  onChange={(event) => setReservationNote(event.target.value)}
                  placeholder="Detalhe condicoes combinadas, recorrencia ou requisitos do material."
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() =>
              onSubmit({
                soldQuantity: Number(soldQuantity),
                buyerName,
                buyerPhone,
                reservationQuantity: createReservation ? Number(reservationQuantity) : undefined,
                reservationUnitPrice: createReservation ? Number(reservationUnitPrice) : undefined,
                reservationNote,
              })
            }
          >
            {isSubmitting ? "Finalizando..." : "Finalizar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
