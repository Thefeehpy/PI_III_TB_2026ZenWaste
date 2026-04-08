import { useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StockTable } from "@/components/StockTable";
import { CreateItemModal } from "@/components/CreateItemModal";
import { InventoryMovementModal } from "@/components/InventoryMovementModal";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import { formatInventoryDate, formatInventoryQuantity, inventoryMovementMap } from "@/lib/inventory";

export default function Inventory() {
  const [modalOpen, setModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovement["type"]>("entrada");
  const { items, movements } = useInventory();

  const itemsWithBalance = items.filter((item) => item.quantity > 0).length;
  const itemsBelowTarget = items.filter((item) => item.quantity > 0 && item.quantity < item.targetQuantity).length;
  const itemsWithoutBalance = items.filter((item) => item.quantity <= 0).length;
  const recentMovements = movements.slice(0, 6);

  const handleAdjustItem = (item: InventoryItem, type: InventoryMovement["type"]) => {
    setSelectedItem(item);
    setMovementType(type);
    setMovementModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Controle de Estoque</h2>
          <p className="text-muted-foreground">
            Gerencie entradas, saídas e metas dos resíduos com uma operação mais clara e rastreável.
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
                <p className="text-sm text-muted-foreground">Com saldo disponível</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsWithBalance}</p>
                <p className="mt-2 text-xs text-muted-foreground">prontos para operação ou anúncio</p>
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
                <p className="text-sm text-muted-foreground">Abaixo da meta</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsBelowTarget}</p>
                <p className="mt-2 text-xs text-muted-foreground">itens que ainda pedem reforço de saldo</p>
              </div>
              <div className="rounded-2xl bg-info/10 p-3">
                <RefreshCcw className="h-5 w-5 text-info" />
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
                <p className="mt-2 text-xs text-muted-foreground">cadastros que precisam de reposição</p>
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
              Use os botões de entrada e saída para movimentar rapidamente o saldo de cada item.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StockTable items={items} onAdjustItem={handleAdjustItem} />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Movimentações recentes</CardTitle>
            <CardDescription>
              Histórico rápido das últimas entradas e saídas registradas no estoque.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMovements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                As movimentações aparecerão aqui assim que você registrar a primeira entrada ou saída.
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
                        <span className="text-muted-foreground">Saldo após operação</span>
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

      <CreateItemModal open={modalOpen} onOpenChange={setModalOpen} />
      <InventoryMovementModal
        item={selectedItem}
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        initialType={movementType}
      />
    </div>
  );
}
