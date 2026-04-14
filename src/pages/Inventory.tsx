import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Clock3, Plus, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateItemModal } from "@/components/CreateItemModal";
import { InventoryMovementModal } from "@/components/InventoryMovementModal";
import { StockTable } from "@/components/StockTable";
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
  const recentMovements = movements.slice(0, 8);
  const weeklyMovements = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return movements.filter((movement) => new Date(movement.createdAt).getTime() >= sevenDaysAgo).length;
  }, [movements]);

  const handleAdjustItem = (item: InventoryItem, type: InventoryMovement["type"]) => {
    setSelectedItem(item);
    setMovementType(type);
    setMovementModalOpen(true);
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
                Estoque com historico e metas por item
              </Badge>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">Controle de Estoque</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Acompanhe saldo, meta, atualizacoes e comentarios de cada item em uma visualizacao mais clara,
                  moderna e pronta para uso em desktop ou mobile.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Movimentacoes na semana</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{weeklyMovements}</p>
              </div>

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
                <p className="mt-2 text-xs text-muted-foreground">prontos para operacao ou anuncio</p>
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
                <p className="text-sm text-muted-foreground">Abaixo da meta</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{itemsBelowTarget}</p>
                <p className="mt-2 text-xs text-muted-foreground">itens que ainda pedem reforco de saldo</p>
              </div>
              <div className="rounded-2xl bg-info/10 p-3">
                <RefreshCcw className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
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

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_22rem]">
        <Card className="rounded-[32px] border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Itens em estoque</CardTitle>
            <CardDescription>
              Cada card mostra saldo, meta, grafico das atualizacoes e comentarios recentes do item.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <StockTable items={items} movements={movements} onAdjustItem={handleAdjustItem} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[32px] border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Movimentacoes recentes</CardTitle>
              <CardDescription>Historico rapido das ultimas entradas e saidas registradas no estoque.</CardDescription>
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

          <Card className="rounded-[32px] border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Leitura operacional</CardTitle>
              <CardDescription>Resumo rapido para orientar o proximo ajuste do estoque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Ritmo da semana
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{weeklyMovements} registros</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  O historico de atualizacoes agora aparece item por item no grafico e nos comentarios.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <p className="text-sm font-medium text-foreground">Como ler a nova tela</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Use os botoes de entrada e saida em cada card para registrar a operacao, acompanhe a linha da meta
                  no grafico e consulte os comentarios recentes logo abaixo para entender o contexto das mudancas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
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
