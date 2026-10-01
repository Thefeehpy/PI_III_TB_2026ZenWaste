import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  PackageCheck,
  PieChart,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryItem } from "@/data/mockData";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatInventoryCalendarDate, formatInventoryQuantity, getInventoryProgress } from "@/lib/inventory";
import { cn } from "@/lib/utils";

type ReservationStatus = "covered" | "pending" | "critical";

type ReservationView = Omit<InventoryItem, "status"> & {
  inventoryStatus: InventoryItem["status"];
  buyer: string;
  missingQuantity: number;
  progress: number;
  daysRemaining: number | null;
  status: ReservationStatus;
};

const buyerNames = [
  "EcoPack Compras",
  "Circular Foods",
  "Revalora Industrial",
  "Nova Matéria",
  "GreenSupply B2B",
  "Reciclo Hub",
];

const statusMeta: Record<
  ReservationStatus,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
    chartColor: string;
  }
> = {
  covered: {
    label: "Coberta",
    description: "saldo suficiente",
    badgeClassName: "border-primary/25 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
    chartColor: "hsl(var(--primary))",
  },
  pending: {
    label: "Em andamento",
    description: "faltam volumes",
    badgeClassName: "border-info/25 bg-info/10 text-info",
    dotClassName: "bg-info",
    chartColor: "hsl(var(--info))",
  },
  critical: {
    label: "Atenção",
    description: "prazo próximo",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
    chartColor: "hsl(var(--warning))",
  },
};

function getBuyerName(item: InventoryItem) {
  const index = Array.from(item.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % buyerNames.length;
  return buyerNames[index];
}

function getDaysRemaining(deadline: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? new Date(`${deadline}T00:00:00`) : new Date(deadline);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function getReservationStatus(item: InventoryItem, missingQuantity: number, daysRemaining: number | null): ReservationStatus {
  if (missingQuantity <= 0) {
    return "covered";
  }

  if (daysRemaining !== null && daysRemaining <= 7) {
    return "critical";
  }

  return "pending";
}

export default function Reservations() {
  const { items } = useInventory();
  const chartTheme = useChartTheme();
  const isMobile = useIsMobile();

  const reservations = useMemo<ReservationView[]>(
    () =>
      items
        .filter((item) => item.targetQuantity > 0)
        .map((item) => {
          const { status: inventoryStatus, ...itemData } = item;
          const missingQuantity = Math.max(item.targetQuantity - item.quantity, 0);
          const progress = getInventoryProgress(item);
          const daysRemaining = getDaysRemaining(item.deadline);

          return {
            ...itemData,
            inventoryStatus,
            buyer: getBuyerName(item),
            missingQuantity,
            progress,
            daysRemaining,
            status: getReservationStatus(item, missingQuantity, daysRemaining),
          };
        })
        .sort((left, right) => {
          if (left.status !== right.status) {
            const order: Record<ReservationStatus, number> = { critical: 0, pending: 1, covered: 2 };
            return order[left.status] - order[right.status];
          }

          return right.missingQuantity - left.missingQuantity;
        }),
    [items],
  );

  const totals = useMemo(
    () =>
      reservations.reduce(
        (acc, reservation) => {
          acc.reserved += reservation.targetQuantity;
          acc.available += Math.min(reservation.quantity, reservation.targetQuantity);
          acc.missing += reservation.missingQuantity;
          acc[reservation.status] += 1;
          return acc;
        },
        { reserved: 0, available: 0, missing: 0, covered: 0, pending: 0, critical: 0 },
      ),
    [reservations],
  );

  const averageCoverage = totals.reserved > 0 ? Math.round((totals.available / totals.reserved) * 100) : 0;

  const coverageChartData = useMemo(
    () =>
      reservations.slice(0, 6).map((reservation) => ({
        name: reservation.name,
        reservado: reservation.targetQuantity,
        coberto: Math.min(reservation.quantity, reservation.targetQuantity),
        faltante: reservation.missingQuantity,
      })),
    [reservations],
  );

  const statusChartData = useMemo(
    () =>
      (Object.keys(statusMeta) as ReservationStatus[])
        .map((status) => ({
          name: statusMeta[status].label,
          value: totals[status],
          fill: statusMeta[status].chartColor,
        }))
        .filter((entry) => entry.value > 0),
    [totals],
  );

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-cyan-100/14 blur-3xl" />

        <CardContent className="relative grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_24rem] xl:items-end">
          <div className="max-w-3xl space-y-5">
            <Badge className="w-fit rounded-full border border-white/16 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
              <Sparkles className="mr-2 h-4 w-4" />
              Gestão de compromissos
            </Badge>

            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reservas</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Controle as reservas feitas por empresas compradoras, acompanhe a cobertura por produto e veja onde
                ainda falta volume para atender cada compromisso.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/12 p-5 backdrop-blur-xl">
            <p className="text-sm text-white/70">Cobertura geral das reservas</p>
            <p className="mt-3 text-5xl font-semibold">{averageCoverage}%</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full border border-white/30 bg-white/12">
              <div
                className="h-full rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.48)]"
                style={{ width: `${averageCoverage}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{reservations.length}</p>
                <p className="mt-1 text-xs text-white/62">reservas</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totals.pending}</p>
                <p className="mt-1 text-xs text-white/62">em andamento</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totals.critical}</p>
                <p className="mt-1 text-xs text-white/62">atenção</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quantidade reservada</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totals.reserved.toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">volume total comprometido</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Já coberto</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totals.available.toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">saldo disponível para reservas</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Falta atender</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totals.missing.toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">volume pendente total</p>
              </div>
              <div className="rounded-2xl bg-warning/10 p-3 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Reservas cobertas</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{totals.covered}</p>
                <p className="mt-2 text-xs text-muted-foreground">prontas para cumprimento</p>
              </div>
              <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Cobertura por produto</CardTitle>
            <CardDescription>Comparativo entre a quantidade reservada e o volume já disponível em estoque.</CardDescription>
          </CardHeader>
          <CardContent>
            {coverageChartData.length === 0 ? (
              <div className="flex h-[340px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                As reservas aparecerão aqui quando os produtos tiverem quantidade reservada.
              </div>
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coverageChartData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" horizontal={false} />
                    <XAxis type="number" stroke={chartTheme.axis} fontSize={12} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={chartTheme.axis}
                      fontSize={12}
                      width={isMobile ? 92 : 150}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBackground,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: "16px",
                        color: chartTheme.tooltipText,
                      }}
                      formatter={(value: number, name: string) => [`${value.toLocaleString("pt-BR")}`, name]}
                      labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                    />
                    <Bar dataKey="reservado" fill="rgba(148,163,184,0.28)" radius={[0, 10, 10, 0]} barSize={18} />
                    <Bar dataKey="coberto" fill={chartTheme.primary} radius={[0, 10, 10, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Status das reservas</CardTitle>
            <CardDescription>Distribuição rápida dos compromissos por nível de atendimento.</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                Nenhum status para exibir ainda.
              </div>
            ) : (
              <>
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={statusChartData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
                        {statusChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltipBackground,
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          borderRadius: "16px",
                          color: chartTheme.tooltipText,
                        }}
                        formatter={(value: number) => [`${value} reserva(s)`, "Total"]}
                        labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {(Object.keys(statusMeta) as ReservationStatus[]).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn("h-3 w-3 rounded-full", statusMeta[status].dotClassName)} />
                        <span className="text-sm font-medium text-foreground">{statusMeta[status].label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{totals[status]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Reservas por comprador</CardTitle>
            <CardDescription>Detalhamento dos compromissos, prazos e volumes pendentes por produto.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            {reservations.length} registros
          </Badge>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-muted/20 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhuma reserva cadastrada</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Quando houver quantidade reservada para produtos do estoque, os compromissos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {reservations.map((reservation) => {
                const status = statusMeta[reservation.status];

                return (
                  <article
                    key={reservation.id}
                    className="rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 md:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                            <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                            {status.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{status.description}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{reservation.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{reservation.type}</p>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Empresa compradora</p>
                        <p className="mt-1 font-semibold text-foreground">{reservation.buyer}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Quantidade reservada</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatInventoryQuantity(reservation.targetQuantity, reservation.unit)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Saldo atual</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatInventoryQuantity(reservation.quantity, reservation.unit)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Falta para atender</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatInventoryQuantity(reservation.missingQuantity, reservation.unit)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Prazo</p>
                        <p className="mt-2 font-semibold text-foreground">{formatInventoryCalendarDate(reservation.deadline)}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          <span>
                            {reservation.daysRemaining === null
                              ? "Prazo não identificado"
                              : reservation.daysRemaining < 0
                                ? `${Math.abs(reservation.daysRemaining)} dia(s) em atraso`
                                : `${reservation.daysRemaining} dia(s) restantes`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Factory className="h-4 w-4 text-primary" />
                          <span>{reservation.progress}% de cobertura</span>
                        </div>
                      </div>

                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),rgba(52,211,153,0.55))]"
                          style={{ width: `${reservation.progress}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
