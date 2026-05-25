import { useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, FileCheck2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StockTable } from "@/components/StockTable";
import { CreateItemModal } from "@/components/CreateItemModal";
import { InventoryMovementModal } from "@/components/InventoryMovementModal";
import { ReservationPanel } from "@/components/ReservationPanel";
import { SellerAdsPanel } from "@/components/SellerAdsPanel";
import { FinalizeAdModal } from "@/components/FinalizeAdModal";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement, ReservationStatus, SellerAd } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { formatInventoryDate, formatInventoryQuantity, inventoryMovementMap } from "@/lib/inventory";

export default function Inventory() {
  const [modalOpen, setModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedAd, setSelectedAd] = useState<SellerAd | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovement["type"]>("entrada");
  const [isFinalizingAd, setIsFinalizingAd] = useState(false);
  const { items, movements, reservations, sellerAds, updateReservationStatus, finalizeAd } = useInventory();
  const { toast } = useToast();

  const itemsWithBalance = items.filter((item) => item.quantity > 0).length;
  const itemsWithoutBalance = items.filter((item) => item.quantity <= 0).length;
  const openReservations = reservations.filter((reservation) =>
    reservation.status === "em_captacao" || reservation.status === "pronta"
  ).length;
  const recentMovements = movements.slice(0, 6);

  const handleAdjustItem = (item: InventoryItem, type: InventoryMovement["type"]) => {
    setSelectedItem(item);
    setMovementType(type);
    setMovementModalOpen(true);
  };

  const handleReservationStatus = async (reservationId: string, nextStatus: ReservationStatus) => {
    const result = await updateReservationStatus(reservationId, nextStatus);
    toast({
      title: result.success ? "Reserva atualizada" : "Nao foi possivel atualizar",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  const handleFinalizeAd = (ad: SellerAd) => {
    setSelectedAd(ad);
    setFinalizeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Controle de Estoque</h2>
          <p className="text-muted-foreground">
            Gerencie saldo, movimentacoes, vendas de anuncios e reservas futuras dos residuos.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Cadastrar Item
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Itens cadastrados</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{items.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">cadastros ativos no estoque</p>
              </div>
              <div className="rounded-2xl bg-accent p-3">
                <Boxes className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com saldo disponivel</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsWithBalance}</p>
                <p className="mt-2 text-xs text-muted-foreground">prontos para operacao ou anuncio</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reservas abertas</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{openReservations}</p>
                <p className="mt-2 text-xs text-muted-foreground">pedidos futuros em acompanhamento</p>
              </div>
              <div className="rounded-2xl bg-info/10 p-3">
                <FileCheck2 className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem saldo</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsWithoutBalance}</p>
                <p className="mt-2 text-xs text-muted-foreground">cadastros que precisam de reposicao</p>
              </div>
              <div className="rounded-2xl bg-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Itens em estoque</CardTitle>
            <CardDescription>
              Use os botoes de entrada e saida para movimentar o saldo real de cada item.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StockTable items={items} onAdjustItem={handleAdjustItem} />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Movimentacoes recentes</CardTitle>
            <CardDescription>Historico rapido das ultimas entradas e saidas registradas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMovements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                As movimentacoes aparecerao aqui assim que voce registrar a primeira entrada ou saida.
              </div>
            ) : (
              recentMovements.map((movement) => {
                const movementMeta = inventoryMovementMap[movement.type];

                return (
                  <div key={movement.id} className="rounded-2xl border border-border/70 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{movement.itemName}</p>
                        <p className="text-sm text-muted-foreground">{movement.itemType}</p>
                      </div>
                      <Badge variant={movementMeta.badgeVariant} className={movementMeta.className}>
                        {movementMeta.label}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Quantidade</span>
                        <span className="font-medium text-foreground">
                          {formatInventoryQuantity(movement.quantity, movement.unit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Saldo apos operacao</span>
                        <span className="font-medium text-foreground">
                          {formatInventoryQuantity(movement.resultingQuantity, movement.unit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Registrado em</span>
                        <span className="font-medium text-foreground">{formatInventoryDate(movement.createdAt)}</span>
                      </div>
                    </div>

                    {movement.note && (
                      <p className="mt-3 rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {movement.note}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <SellerAdsPanel ads={sellerAds} onFinalize={handleFinalizeAd} />
      <ReservationPanel reservations={reservations} onStatusChange={handleReservationStatus} />

      <CreateItemModal open={modalOpen} onOpenChange={setModalOpen} />
      <InventoryMovementModal
        item={selectedItem}
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        initialType={movementType}
      />
      <FinalizeAdModal
        ad={selectedAd}
        open={finalizeModalOpen}
        isSubmitting={isFinalizingAd}
        onOpenChange={(open) => {
          setFinalizeModalOpen(open);
          if (!open) {
            setSelectedAd(null);
          }
        }}
        onSubmit={async (input) => {
          if (!selectedAd) {
            return;
          }

          if (!Number.isFinite(input.soldQuantity) || input.soldQuantity <= 0) {
            toast({
              title: "Quantidade invalida",
              description: "Informe uma quantidade vendida maior que zero.",
              variant: "destructive",
            });
            return;
          }

          if (input.soldQuantity > selectedAd.availableQuantity) {
            toast({
              title: "Saldo insuficiente",
              description: "A quantidade vendida nao pode ultrapassar o saldo atual do produto.",
              variant: "destructive",
            });
            return;
          }

          const wantsReservation = input.reservationQuantity !== undefined;
          if (
            wantsReservation &&
            (!Number.isFinite(input.reservationQuantity) || input.reservationQuantity <= 0)
          ) {
            toast({
              title: "Reserva invalida",
              description: "Informe uma quantidade reservada maior que zero.",
              variant: "destructive",
            });
            return;
          }

          if (
            wantsReservation &&
            (!Number.isFinite(input.reservationUnitPrice) || Number(input.reservationUnitPrice) < 0)
          ) {
            toast({
              title: "Preco invalido",
              description: "Informe um preco unitario valido para a reserva.",
              variant: "destructive",
            });
            return;
          }

          if (wantsReservation && (!input.buyerName.trim() || !input.buyerPhone.trim())) {
            toast({
              title: "Comprador obrigatorio",
              description: "Informe nome e numero do comprador para criar uma reserva.",
              variant: "destructive",
            });
            return;
          }

          setIsFinalizingAd(true);
          const result = await finalizeAd({
            adId: selectedAd.id,
            ...input,
          });
          setIsFinalizingAd(false);

          toast({
            title: result.success ? "Anuncio finalizado" : "Nao foi possivel finalizar",
            description: result.message,
            variant: result.success ? "default" : "destructive",
          });

          if (result.success) {
            setFinalizeModalOpen(false);
            setSelectedAd(null);
          }
        }}
      />
    </div>
  );
}
