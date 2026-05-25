import { CheckCircle2, PackageCheck, RefreshCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reservation, ReservationStatus } from "@/data/mockData";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";

interface ReservationPanelProps {
  reservations: Reservation[];
  onStatusChange: (reservationId: string, status: ReservationStatus) => void;
}

const reservationStatusMap: Record<
  ReservationStatus,
  { label: string; className: string; icon: typeof RefreshCcw }
> = {
  em_captacao: {
    label: "Em captacao",
    className: "bg-info/10 text-info border-info/20",
    icon: RefreshCcw,
  },
  pronta: {
    label: "Pronta",
    className: "bg-primary/10 text-primary border-primary/20",
    icon: PackageCheck,
  },
  finalizada: {
    label: "Finalizada",
    className: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
};

export function ReservationPanel({ reservations, onStatusChange }: ReservationPanelProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Reservas de clientes</CardTitle>
        <CardDescription>
          Pedidos futuros vinculados ao produto, acompanhados pelo saldo atual e pelas movimentacoes de estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reservations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            As reservas criadas na finalizacao de anuncios aparecerao aqui.
          </div>
        ) : (
          reservations.map((reservation) => {
            const status = reservationStatusMap[reservation.status];
            const StatusIcon = status.icon;
            const isFinal = reservation.status === "finalizada" || reservation.status === "cancelada";

            return (
              <div key={reservation.id} className="rounded-md border border-border/70 bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">{reservation.itemName}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.buyerName} - {reservation.buyerPhone}
                    </p>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    <StatusIcon className="mr-1 h-3.5 w-3.5" />
                    {status.label}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Reservado</p>
                    <p className="font-medium text-foreground">
                      {formatInventoryQuantity(reservation.quantity, reservation.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saldo atual</p>
                    <p className="font-medium text-foreground">
                      {formatInventoryQuantity(reservation.currentQuantity, reservation.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Faltante</p>
                    <p className="font-medium text-foreground">
                      {formatInventoryQuantity(reservation.missingQuantity, reservation.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor estimado</p>
                    <p className="font-medium text-foreground">
                      R$ {reservation.totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Reserva criada em {formatInventoryDate(reservation.reservedAt)}
                  {reservation.finalizedAt ? ` - finalizada em ${formatInventoryDate(reservation.finalizedAt)}` : ""}
                </div>

                {reservation.note && (
                  <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {reservation.note}
                  </p>
                )}

                {!isFinal && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onStatusChange(reservation.id, "cancelada")}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={reservation.missingQuantity > 0}
                      onClick={() => onStatusChange(reservation.id, "finalizada")}
                    >
                      Concluir venda
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
