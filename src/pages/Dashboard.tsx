import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Boxes, Layers3, Sparkles, Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";

type TypeAggregate = {
  name: string;
  count: number;
  availableCount: number;
  massKg: number;
};

const chartPalette = [
  "hsl(152 55% 35%)",
  "hsl(201 82% 46%)",
  "hsl(38 92% 50%)",
  "hsl(221 83% 53%)",
  "hsl(173 58% 39%)",
  "hsl(12 76% 61%)",
];

function toMassKg(quantity: number, unit: string) {
  if (unit === "kg") {
    return quantity;
  }

  if (unit === "ton") {
    return quantity * 1000;
  }

  return 0;
}

function formatMass(kg: number) {
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} ton`;
  }

  return `${kg.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kg`;
}

function rankQuantity(item: { quantity: number; unit: string }) {
  const massKg = toMassKg(item.quantity, item.unit);
  return massKg > 0 ? massKg : item.quantity;
}

export default function Dashboard() {
  const { items, movements } = useInventory();
  const isMobile = useIsMobile();
  const chartTheme = useChartTheme();

  const totalMassKg = useMemo(() => items.reduce((sum, item) => sum + toMassKg(item.quantity, item.unit), 0), [items]);
  const itemsWithBalance = useMemo(() => items.filter((item) => item.quantity > 0).length, [items]);
  const uniqueTypes = useMemo(() => new Set(items.map((item) => item.type)).size, [items]);
  const weeklyMovements = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return movements.filter((movement) => new Date(movement.createdAt).getTime() >= sevenDaysAgo).length;
  }, [movements]);

  const typeData = useMemo<TypeAggregate[]>(() => {
    const aggregates = new Map<string, TypeAggregate>();

    items.forEach((item) => {
      const current = aggregates.get(item.type) ?? {
        name: item.type,
        count: 0,
        availableCount: 0,
        massKg: 0,
      };

      current.count += 1;
      current.availableCount += item.quantity > 0 ? 1 : 0;
      current.massKg += toMassKg(item.quantity, item.unit);

      aggregates.set(item.type, current);
    });

    return [...aggregates.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.massKg - left.massKg;
    });
  }, [items]);

  const typeBarData = typeData.slice(0, 6);
  const typePieData = typeData.slice(0, 5).map((entry, index) => ({
    ...entry,
    color: chartPalette[index % chartPalette.length],
  }));

  const topProducts = useMemo(
    () => [...items].sort((left, right) => rankQuantity(right) - rankQuantity(left)).slice(0, 5),
    [items],
  );
  const maxTopProductValue = topProducts.length > 0 ? rankQuantity(topProducts[0]) : 1;

  const recentItems = useMemo(
    () =>
      [...items]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 5),
    [items],
  );

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-[34px] border-border/60 bg-[linear-gradient(135deg,#091423_0%,#10344d_38%,#12735f_100%)] text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="absolute left-0 top-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <CardContent className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div className="space-y-5">
            <Badge className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-white hover:bg-white/10">
              <Sparkles className="mr-2 h-4 w-4" />
              Painel inteligente do estoque
            </Badge>

            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Visão Geral</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Uma leitura mais estratégica dos produtos cadastrados, dos tipos de resíduos presentes no estoque e da
                atividade recente da operação.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-white/78">
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
                {itemsWithBalance} produtos com saldo disponível
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
                {uniqueTypes} tipos catalogados
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
                {weeklyMovements} movimentações nos últimos 7 dias
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[26px] border border-white/12 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Produtos cadastrados</p>
              <p className="mt-3 text-3xl font-semibold">{items.length}</p>
            </div>

            <div className="rounded-[26px] border border-white/12 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Volume em massa</p>
              <p className="mt-3 text-3xl font-semibold">{formatMass(totalMassKg)}</p>
            </div>

            <div className="rounded-[26px] border border-white/12 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Itens ativos</p>
              <p className="mt-3 text-3xl font-semibold">{itemsWithBalance}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Produtos cadastrados",
            value: items.length,
            subtitle: "cadastros totais no estoque",
            icon: Boxes,
            accent: "from-emerald-500/16 to-emerald-500/0",
            iconShell: "bg-emerald-500/12 text-emerald-600",
          },
          {
            title: "Tipos mapeados",
            value: uniqueTypes,
            subtitle: "variedade atual do catalogo",
            icon: Layers3,
            accent: "from-cyan-500/14 to-cyan-500/0",
            iconShell: "bg-cyan-500/12 text-cyan-600",
          },
          {
            title: "Volume em massa",
            value: formatMass(totalMassKg),
            subtitle: "itens em kg e ton consolidados",
            icon: Weight,
            accent: "from-amber-500/14 to-amber-500/0",
            iconShell: "bg-amber-500/14 text-amber-600",
          },
          {
            title: "Movimentações recentes",
            value: weeklyMovements,
            subtitle: "entradas e saídas em 7 dias",
            icon: Activity,
            accent: "from-violet-500/14 to-violet-500/0",
            iconShell: "bg-violet-500/14 text-violet-600",
          },
        ].map((metric) => (
          <Card
            key={metric.title}
            className={`overflow-hidden rounded-[30px] border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] shadow-[0_14px_40px_rgba(15,23,42,0.06)]`}
          >
            <CardContent className="relative p-6">
              <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${metric.accent}`} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                </div>
                <div className={`rounded-2xl p-3 ${metric.iconShell}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="rounded-[32px] border-border/70 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-xl">Produtos por tipo</CardTitle>
            <CardDescription>Veja quais tipos de resíduos concentram mais produtos cadastrados.</CardDescription>
          </CardHeader>
          <CardContent>
            {typeBarData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-center text-sm text-muted-foreground">
                Cadastre produtos no estoque para visualizar a distribuição por tipo.
              </div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeBarData} layout="vertical" margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" horizontal={false} />
                    <XAxis type="number" stroke={chartTheme.axis} fontSize={12} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={chartTheme.axis}
                      fontSize={12}
                      width={isMobile ? 90 : 136}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBackground,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: "16px",
                        color: chartTheme.tooltipText,
                      }}
                      formatter={(value: number, _name, entry) => {
                        const payload = entry.payload as TypeAggregate;
                        return [`${value} produto(s)`, payload.massKg > 0 ? `Massa: ${formatMass(payload.massKg)}` : "Sem massa consolidada"];
                      }}
                      labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                    />
                    <Bar dataKey="count" radius={[0, 10, 10, 0]} fill={chartTheme.primary} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/70 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-xl">Mix do catalogo</CardTitle>
            <CardDescription>Distribuição visual dos principais tipos presentes no estoque.</CardDescription>
          </CardHeader>
          <CardContent>
            {typePieData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-center text-sm text-muted-foreground">
                O grafico aparece assim que houver produtos cadastrados.
              </div>
            ) : (
              <>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typePieData}
                        dataKey="count"
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={86}
                        paddingAngle={4}
                      >
                        {typePieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltipBackground,
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          borderRadius: "16px",
                          color: chartTheme.tooltipText,
                        }}
                        formatter={(value: number, _name, entry) => {
                          const payload = entry.payload as TypeAggregate & { color: string };
                          return [`${value} produto(s)`, payload.massKg > 0 ? `Massa: ${formatMass(payload.massKg)}` : "Sem massa consolidada"];
                        }}
                        labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-3">
                  {typePieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-foreground">{entry.name}</span>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="rounded-[32px] border-border/70 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-xl">Produtos com maior saldo</CardTitle>
            <CardDescription>Os itens mais relevantes em volume dentro do estoque neste momento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Os produtos com maior saldo aparecerão aqui assim que houver itens cadastrados.
              </div>
            ) : (
              topProducts.map((item, index) => {
                const width = `${Math.max(12, Math.round((rankQuantity(item) / maxTopProductValue) * 100))}%`;

                return (
                  <div key={item.id} className="rounded-[26px] border border-border/70 bg-card/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.type}</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatInventoryQuantity(item.quantity, item.unit)}</p>
                        <p className="text-xs text-muted-foreground">saldo atual</p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),rgba(34,197,94,0.45))]" style={{ width }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/70 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-xl">Últimas atualizações</CardTitle>
            <CardDescription>Produtos atualizados mais recentemente para leitura rápida da operação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                As atualizações mais recentes aparecem aqui quando o estoque receber novos produtos.
              </div>
            ) : (
              recentItems.map((item) => (
                <div key={item.id} className="rounded-[26px] border border-border/70 bg-card/90 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.type}</p>
                    </div>
                    <div className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                      {formatInventoryQuantity(item.quantity, item.unit)}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">Atualizado em {formatInventoryDate(item.updatedAt)}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1">Cadastrado em {formatInventoryDate(item.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

