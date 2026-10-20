import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateItemModal } from "@/components/CreateItemModal";
import { InventoryItemDetailsModal } from "@/components/InventoryItemDetailsModal";
import { InventoryMovementsModal } from "@/components/InventoryMovementsModal";
import { StockTable } from "@/components/StockTable";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem } from "@/data/mockData";

export default function Inventory() {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const movementsButton = useRef<HTMLButtonElement>(null);
  const { items, movements } = useInventory();
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const itemsWithBalance = items.filter((item) => item.quantity > 0).length;
  const pendingReservations = items.filter(
    (item) => item.quantity < item.targetQuantity,
  ).length;
  const handleViewItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setDetailsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden rounded-[32px] border-border/70 bg-card shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <CardContent className="relative p-6 md:p-8">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-info/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge
                variant="outline"
                className="rounded-full border-border/80 bg-muted/40 px-3 py-1"
              >
                Estoque com histórico operacional e reserva por produto
              </Badge>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Controle de Estoque
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Gerencie materiais, acompanhe reservas e consulte o histórico
                  de entradas e saídas.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              className="h-12 shrink-0 gap-2 rounded-2xl px-5"
            >
              <Plus className="h-4 w-4" />
              Cadastrar item
            </Button>
          </div>
        </CardContent>
      </Card>

      <div
        data-testid="inventory-summary-cards"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Itens cadastrados
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {items.length}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  cadastros ativos com leitura individual
                </p>
              </div>
              <div className="rounded-2xl bg-accent p-3">
                <Boxes className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Com saldo disponível
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {itemsWithBalance}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  prontos para operação interna
                </p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Reservas pendentes
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {pendingReservations}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  itens que ainda não cobrem a reserva
                </p>
              </div>
              <div className="rounded-2xl bg-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <button
          ref={movementsButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={movementsModalOpen}
          aria-controls="inventory-movements-dialog"
          aria-label="Ver movimentações do estoque"
          onClick={() => setMovementsModalOpen(true)}
          className="group relative isolate overflow-hidden rounded-[28px] border border-emerald-300/20 bg-[linear-gradient(125deg,#0c3d30_0%,#167653_60%,#2b8a60_100%)] p-6 text-left text-white shadow-[0_12px_32px_rgba(16,120,80,0.16)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 -z-10 h-36 w-36 rounded-full bg-emerald-200/20 blur-2xl"
          />
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm text-white/80">Movimentações</span>
              <span className="mt-2 block text-3xl font-semibold">
                {movements.length.toLocaleString("pt-BR")}
              </span>
            </span>
            <span className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <ArrowUpDown className="h-5 w-5" />
            </span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
            Ver movimentações
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
          </span>
        </button>
      </div>

      <Card className="rounded-[32px] border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Itens em destaque</CardTitle>
          <CardDescription>
            Consulte o saldo de cada material e abra os detalhes para gerenciar
            suas reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <StockTable items={items} onViewItem={handleViewItem} />
        </CardContent>
      </Card>

      <CreateItemModal open={modalOpen} onOpenChange={setModalOpen} />
      <InventoryItemDetailsModal
        item={selectedItem}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onItemDeleted={() => setSelectedItemId(null)}
      />
      <InventoryMovementsModal
        open={movementsModalOpen}
        onOpenChange={setMovementsModalOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          movementsButton.current?.focus();
        }}
      />
    </div>
  );
}
