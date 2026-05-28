import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, Clock3, Plus, PowerOff } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateItemModal } from "@/components/CreateItemModal";
import { InventoryItemDetailsModal } from "@/components/InventoryItemDetailsModal";
import { InventoryMovementModal } from "@/components/InventoryMovementModal";
import { StockTable } from "@/components/StockTable";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useMarketplace } from "@/contexts/MarketplaceContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { formatInventoryDate, formatInventoryQuantity, inventoryMovementMap } from "@/lib/inventory";

export default function Inventory() {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovement["type"]>("entrada");
  const [showAllRecentMovements, setShowAllRecentMovements] = useState(false);
  const { user } = useAuth();
  const { items, movements, refreshInventory } = useInventory();
  const { deactivateItem, finalizeItem, refreshMarketplace, refreshSellerItems, sellerItems } = useMarketplace();
  const { toast } = useToast();

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const itemsWithBalance = items.filter((item) => item.quantity > 0).length;
  const activeListings = useMemo(() => {
    if (!user) {
      return [];
    }

    return sellerItems.filter((item) => item.status === "ativo");
  }, [sellerItems, user]);
  const pendingReservations = items.filter((item) => item.quantity < item.targetQuantity).length;
  const recentMovements = movements.slice(0, 6);
  const visibleRecentMovements = showAllRecentMovements ? recentMovements : recentMovements.slice(0, 2);
  const handleViewItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setDetailsModalOpen(true);
  };

  const handleAdjustItem = (item: InventoryItem, type: InventoryMovement["type"]) => {
    setSelectedItemId(item.id);
    setMovementType(type);
    setMovementModalOpen(true);
  };

  const handleDeactivateListing = async (listingId: string) => {
    const result = await deactivateItem(listingId);

    toast({
      title: result.success ? "Anuncio encerrado" : "Anuncio nao encerrado",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  const handleFinalizeListing = async (listingId: string, quantity: number) => {
    const result = await finalizeItem(listingId, quantity);

    if (result.success) {
      await refreshInventory();
    }

    toast({
      title: result.success ? "Anuncio finalizado" : "Anuncio nao finalizado",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden rounded-[32px] border-border/70 bg-card shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <CardContent className="relative p-6 md:p-8">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-info/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge variant="outline" className="rounded-full border-border/80 bg-muted/40 px-3 py-1">
                Estoque com historico operacional, anuncios ativos e reserva por produto
              </Badge>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">Controle de Estoque</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Acompanhe saldo, entradas, saidas, anuncios publicados e abra os detalhes de cada produto em um
                  modal mais focado e organizado.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setModalOpen(true)} className="h-12 gap-2 rounded-2xl px-5">
                <Plus className="h-4 w-4" />
                Cadastrar item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Itens cadastrados</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{items.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">cadastros ativos com leitura individual</p>
              </div>
              <div className="rounded-2xl bg-accent p-3">
                <Boxes className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com saldo disponivel</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsWithBalance}</p>
                <p className="mt-2 text-xs text-muted-foreground">prontos para operacao ou novo anuncio</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Anuncios em andamento</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{activeListings.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">publicacoes ativas desta empresa</p>
              </div>
              <div className="rounded-2xl bg-info/10 p-3">
                <Clock3 className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reservas pendentes</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{pendingReservations}</p>
                <p className="mt-2 text-xs text-muted-foreground">itens que ainda nao cobrem a reserva</p>
              </div>
              <div className="rounded-2xl bg-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_24rem]">
        <Card className="rounded-[32px] border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Itens em destaque</CardTitle>
            <CardDescription>
              Cada produto aparece em um card resumido. Abra o modal para ver os detalhes completos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <StockTable items={items} onViewItem={handleViewItem} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[32px] border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Anuncios em andamento</CardTitle>
              <CardDescription>Todos os anuncios publicados por esta empresa no marketplace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeListings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  <p>Nenhum anuncio ativo no momento.</p>
                  <Button asChild variant="outline" className="mt-4 rounded-xl">
                    <Link to="/dashboard/create-ad">Criar anuncio</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {activeListings.map((listing) => (
                    <div key={listing.id} className="rounded-2xl border border-border/70 bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{listing.name}</p>
                          <p className="text-sm text-muted-foreground">{listing.type}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          Ativo
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Quantidade anunciada</span>
                          <span className="font-medium text-foreground">
                            {formatInventoryQuantity(listing.quantity, listing.unit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Preco</span>
                          <span className="font-medium text-foreground">
                            R$ {listing.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {listing.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Publicado em</span>
                          <span className="font-medium text-foreground">{formatInventoryDate(listing.createdAt)}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" className="gap-2 rounded-xl">
                              <CheckCircle2 className="h-4 w-4" />
                              Finalizar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Finalizar este anuncio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O saldo do item sera subtraido em {formatInventoryQuantity(listing.quantity, listing.unit)}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleFinalizeListing(listing.id, listing.quantity)}>
                                Finalizar venda
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="gap-2 rounded-xl">
                              <PowerOff className="h-4 w-4" />
                              Encerrar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Encerrar este anuncio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O anuncio sai do marketplace, mas o saldo do item permanece no estoque.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeactivateListing(listing.id)}>
                                Encerrar anuncio
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}

                  <Button asChild variant="outline" className="w-full rounded-2xl">
                    <Link to="/dashboard/create-ad">Publicar novo anuncio</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Movimentacoes recentes</CardTitle>
              <CardDescription>Leitura rapida das ultimas entradas e saidas registradas no estoque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  As movimentacoes aparecerao aqui assim que voce registrar a primeira entrada ou saida.
                </div>
              ) : (
                <>
                  {visibleRecentMovements.map((movement) => {
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
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Quantidade</span>
                            <span className="font-medium text-foreground">
                              {formatInventoryQuantity(movement.quantity, movement.unit)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Saldo apos operacao</span>
                            <span className="font-medium text-foreground">
                              {formatInventoryQuantity(movement.resultingQuantity, movement.unit)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Registrado em</span>
                            <span className="font-medium text-foreground">{formatInventoryDate(movement.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {recentMovements.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-2xl shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
                      onClick={() => setShowAllRecentMovements((current) => !current)}
                    >
                      {showAllRecentMovements ? "Ver menos" : "Ver mais"}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateItemModal open={modalOpen} onOpenChange={setModalOpen} />
      <InventoryItemDetailsModal
        item={selectedItem}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onRequestMovement={handleAdjustItem}
        onItemDeleted={() => {
          setSelectedItemId(null);
          void refreshMarketplace();
          void refreshSellerItems();
        }}
      />
      <InventoryMovementModal
        item={selectedItem}
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        initialType={movementType}
      />
    </div>
  );
}
