import { ArrowDownRight, ArrowUpRight, CalendarClock, MessageSquareText, Minus, Plus, Target } from "lucide-react";
import { Area, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useChartTheme } from "@/hooks/use-chart-theme";
import type { InventoryItem, InventoryMovement } from "@/data/mockData";
import {
  formatInventoryChartDate,
  formatInventoryDate,
  formatInventoryQuantity,
  getInventoryProgress,
  inventoryMovementMap,
  inventoryStatusMap,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface StockTableProps {
  items: InventoryItem[];
  movements: InventoryMovement[];
  onAdjustItem: (item: InventoryItem, type: "entrada" | "saida") => void;
}

type InventoryChartPoint = {
  fullDate: string;
  shortDate: string;
  movementLabel: string;
  note?: string;
  quantity: number;
  resultingQuantity: number;
  type: InventoryMovement["type"];
};

const chartConfig = {
  saldo: {
    label: "Saldo",
  },
  meta: {
    label: "Meta",
  },
};

function formatCompactValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function buildChartData(item: InventoryItem, movements: InventoryMovement[]) {
  const sortedMovements = [...movements].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  if (sortedMovements.length === 0) {
    return [
      {
        fullDate: formatInventoryDate(item.updatedAt),
        shortDate: formatInventoryChartDate(item.updatedAt),
        movementLabel: "Sem movimentacoes",
        quantity: 0,
        resultingQuantity: item.quantity,
        type: "entrada" as const,
      },
    ];
  }

  return sortedMovements.map((movement) => ({
    fullDate: formatInventoryDate(movement.createdAt),
    shortDate: formatInventoryChartDate(movement.createdAt),
    movementLabel: movement.type === "entrada" ? "Entrada" : "Saida",
    note: movement.note,
    quantity: movement.quantity,
    resultingQuantity: movement.resultingQuantity,
    type: movement.type,
  }));
}

function InventoryChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: InventoryChartPoint }>;
  unit: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;
  const movementMeta = inventoryMovementMap[point.type];

  return (
    <div className="max-w-[18rem] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {point.fullDate}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Badge variant={movementMeta.badgeVariant} className={movementMeta.className}>
          {point.movementLabel}
        </Badge>
        <span className="text-sm font-semibold text-foreground">
          {formatInventoryQuantity(point.resultingQuantity, unit)}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Movimentacao registrada:{" "}
        <span className="font-medium text-foreground">{formatInventoryQuantity(point.quantity, unit)}</span>
      </p>
      {point.note && (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm leading-6 text-muted-foreground">
          {point.note}
        </p>
      )}
    </div>
  );
}

export function StockTable({ items, movements, onAdjustItem }: StockTableProps) {
  const chartTheme = useChartTheme();

  if (items.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground">Nenhum item cadastrado no estoque</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre o primeiro item para comecar a registrar entradas, saidas e acompanhar metas com historico.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {items.map((item) => {
        const itemMovements = movements.filter((movement) => movement.itemId === item.id);
        const chartData = buildChartData(item, itemMovements);
        const latestMovements = itemMovements.slice(0, 3);
        const progress = getInventoryProgress(item);
        const status = inventoryStatusMap[item.status];
        const remaining = Math.max(item.targetQuantity - item.quantity, 0);
        const overTarget = Math.max(item.quantity - item.targetQuantity, 0);
        const latestMovementWithNote = itemMovements.find((movement) => movement.note);

        return (
          <Card
            key={item.id}
            className="overflow-hidden rounded-[30px] border-border/70 bg-card/95 shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          >
            <CardContent className="space-y-6 p-5 xl:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight text-foreground">{item.name}</h3>
                    <Badge variant="outline" className="rounded-full border-border/80 bg-muted/40 text-xs">
                      {item.type}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted/60 px-2.5 py-1">
                      Prazo {new Date(item.deadline).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="rounded-full bg-muted/60 px-2.5 py-1">
                      Atualizado em {formatInventoryDate(item.updatedAt)}
                    </span>
                    {itemMovements.length > 0 && (
                      <span className="rounded-full bg-muted/60 px-2.5 py-1">
                        {itemMovements.length} atualizacoes registradas
                      </span>
                    )}
                  </div>
                </div>

                <Badge variant={status.badgeVariant} className={cn("w-fit rounded-full px-3 py-1", status.className)}>
                  {status.label}
                </Badge>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)]">
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Saldo atual</p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        {formatInventoryQuantity(item.quantity, item.unit)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Meta</p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        {formatInventoryQuantity(item.targetQuantity, item.unit)}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        overTarget > 0 ? "border-primary/20 bg-primary/5" : "border-info/20 bg-info/5",
                      )}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {overTarget > 0 ? "Acima da meta" : "Falta para meta"}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        {formatInventoryQuantity(overTarget > 0 ? overTarget : remaining, item.unit)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atualizacoes</p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">{itemMovements.length}</p>
                      <p className="mt-1 text-sm text-muted-foreground">registros neste item</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border/70 bg-muted/[0.18] p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
                      <div>
                        <p className="font-medium text-foreground">Ritmo de abastecimento</p>
                        <p className="mt-1 text-sm text-muted-foreground">{status.description}</p>
                      </div>
                      <div className="text-sm lg:text-right">
                        <p className="font-semibold text-foreground">{progress}% da meta</p>
                        <p className="text-muted-foreground">
                          {remaining > 0
                            ? `faltam ${formatInventoryQuantity(remaining, item.unit)}`
                            : `acima da meta em ${formatInventoryQuantity(overTarget, item.unit)}`}
                        </p>
                      </div>
                    </div>

                    <Progress value={progress} className="mt-4 h-2.5" />
                  </div>

                  <div className="rounded-[26px] border border-border/70 bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">Evolucao do item</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Cada ponto marca uma atualizacao real com data e saldo resultante.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-4 w-4" />
                        Meta: {formatInventoryQuantity(item.targetQuantity, item.unit)}
                      </div>
                    </div>

                    <ChartContainer config={chartConfig} className="mt-4 h-64 w-full aspect-auto">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                        <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="4 4" />
                        <XAxis
                          dataKey="shortDate"
                          stroke={chartTheme.axis}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={24}
                        />
                        <YAxis
                          stroke={chartTheme.axis}
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tickFormatter={(value: number) => formatCompactValue(value)}
                        />
                        <ChartTooltip
                          cursor={{ stroke: chartTheme.grid, strokeDasharray: "3 3" }}
                          content={<InventoryChartTooltip unit={item.unit} />}
                        />
                        <ReferenceLine
                          y={item.targetQuantity}
                          stroke={chartTheme.secondary}
                          strokeDasharray="6 6"
                          ifOverflow="extendDomain"
                        />
                        <Area
                          type="stepAfter"
                          dataKey="resultingQuantity"
                          stroke="none"
                          fill={chartTheme.primary}
                          fillOpacity={0.1}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="resultingQuantity"
                          stroke={chartTheme.primary}
                          strokeWidth={2.5}
                          dot={{
                            r: 3.5,
                            strokeWidth: 0,
                            fill: chartTheme.primary,
                          }}
                          activeDot={{
                            r: 5,
                            strokeWidth: 0,
                            fill: chartTheme.primary,
                          }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                </div>

                <div className="grid gap-5 content-start">
                  <div className="rounded-[24px] border border-border/70 bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <Button
                        className="h-12 justify-between rounded-2xl bg-primary/10 px-4 text-primary hover:bg-primary/15"
                        variant="ghost"
                        onClick={() => onAdjustItem(item, "entrada")}
                      >
                        Registrar entrada
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        className="h-12 justify-between rounded-2xl bg-destructive/10 px-4 text-destructive hover:bg-destructive/15"
                        variant="ghost"
                        onClick={() => onAdjustItem(item, "saida")}
                      >
                        Registrar saida
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-border/70 bg-muted/[0.18] p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4" />
                        Ultimo movimento
                      </div>
                      {itemMovements.length > 0 ? (
                        <>
                          <div className="mt-3 flex items-center gap-2">
                            {itemMovements[0].type === "entrada" ? (
                              <ArrowUpRight className="h-4 w-4 text-primary" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-destructive" />
                            )}
                            <p className="text-sm font-medium text-foreground">
                              {inventoryMovementMap[itemMovements[0].type].label}
                            </p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {formatInventoryDate(itemMovements[0].createdAt)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">Aguardando a primeira atualizacao.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border/70 bg-muted/[0.14] p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">Ultimas atualizacoes</p>
                    </div>

                    {latestMovements.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/80 p-4 text-sm text-muted-foreground">
                        Nenhuma movimentacao registrada ainda para este item.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {latestMovements.map((movement) => {
                          const movementMeta = inventoryMovementMap[movement.type];

                          return (
                            <div key={movement.id} className="rounded-2xl border border-border/70 bg-background/90 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant={movementMeta.badgeVariant}
                                      className={cn("rounded-full px-2.5 py-0.5 text-xs", movementMeta.className)}
                                    >
                                      {movementMeta.label}
                                    </Badge>
                                    <span className="text-sm font-medium text-foreground">
                                      {formatInventoryQuantity(movement.quantity, movement.unit)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {formatInventoryDate(movement.createdAt)}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Saldo apos registro</p>
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatInventoryQuantity(movement.resultingQuantity, movement.unit)}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {movement.note || "Atualizacao registrada sem comentario adicional."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {latestMovementWithNote && (
                      <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-primary/75">Comentario em destaque</p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{latestMovementWithNote.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
