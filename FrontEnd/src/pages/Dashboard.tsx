import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleDollarSign, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";

type TypeAggregate = {
  name: string;
  count: number;
  massKg: number;
};

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rankQuantity(item: { quantity: number; unit: string }) {
  const massKg = toMassKg(item.quantity, item.unit);
  return massKg > 0 ? massKg : item.quantity;
}

function getMockAiUnitPrice(type: string, name: string) {
  const normalized = `${type} ${name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("metal") || normalized.includes("aco") || normalized.includes("sucata")) {
    return 8.4;
  }

  if (normalized.includes("eletron")) {
    return 18.5;
  }

  if (normalized.includes("plast")) {
    return 2.7;
  }

  if (normalized.includes("borracha")) {
    return 1.35;
  }

  if (normalized.includes("papel") || normalized.includes("papelao")) {
    return 0.62;
  }

  if (normalized.includes("vidro")) {
    return 0.38;
  }

  return 1.15;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { items, movements } = useInventory();
  const isMobile = useIsMobile();
  const chartTheme = useChartTheme();
  const userName = user?.razaoSocial?.trim() || "usuário";

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
        massKg: 0,
      };

      current.count += 1;
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

  const topProducts = useMemo(
    () => [...items].sort((left, right) => rankQuantity(right) - rankQuantity(left)).slice(0, 5),
    [items],
  );
  const maxTopProductValue = topProducts.length > 0 ? rankQuantity(topProducts[0]) : 1;

  const aiValuedProducts = useMemo(
    () =>
      items
        .filter((item) => item.quantity > 0)
        .map((item) => {
          const referenceQuantity = rankQuantity(item);
          const unitPrice = getMockAiUnitPrice(item.type, item.name);

          return {
            ...item,
            estimatedValue: referenceQuantity * unitPrice,
            referenceQuantity,
            unitPrice,
          };
        })
        .sort((left, right) => right.estimatedValue - left.estimatedValue),
    [items],
  );

  const totalAiEstimatedValue = useMemo(
    () => aiValuedProducts.reduce((sum, item) => sum + item.estimatedValue, 0),
    [aiValuedProducts],
  );

  const recentItems = useMemo(
    () =>
      [...items]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 5),
    [items],
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--accent))_100%)] p-5 shadow-[0_16px_44px_rgba(15,23,42,0.07)] sm:p-6">
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-info/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Bem-vindo de volta</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{userName}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Aqui está um resumo atualizado do seu estoque e dos produtos que merecem atenção hoje.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-background/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
            <span className="font-medium text-foreground">{itemsWithBalance}</span> produtos com saldo disponível
          </div>
        </div>
      </section>

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

      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_16%_18%,rgba(255,255,255,0.24),transparent_30%),linear-gradient(135deg,#03251e_0%,#087d67_48%,#35d399_100%)] text-white shadow-[0_26px_70px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-12 top-8 h-44 w-44 rounded-full bg-white/18 blur-3xl" />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-cyan-100/15 blur-3xl" />

        <CardContent className="relative grid gap-6 p-6 md:p-7 xl:grid-cols-[0.85fr_1.15fr] xl:items-center">
          <div className="space-y-5">
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-xs font-medium uppercase text-white/80 backdrop-blur">
              <CircleDollarSign className="h-4 w-4 text-emerald-100" />
              Prévia IA
            </div>

            <div>
              <p className="text-sm font-medium text-emerald-50/85">Potencial aproximado em estoque</p>
              <h3 className="mt-2 text-4xl font-semibold sm:text-5xl">
                {formatCurrency(totalAiEstimatedValue)}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/76">
                Estimativa fictícia por enquanto, calculada por produto para mostrar quanto o estoque pode virar em
                receita quando for anunciado.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/16 bg-white/12 px-3 py-1.5 text-white/82 backdrop-blur">
                {aiValuedProducts.length} produtos avaliados
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1.5 text-white/82 backdrop-blur">
                <TrendingUp className="h-4 w-4" />
                Incentivo para anunciar
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/16 bg-white/12 p-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            {aiValuedProducts.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-white/20 bg-black/10 p-6 text-center text-sm text-white/72">
                Cadastre produtos com saldo para visualizar a estimativa em reais.
              </div>
            ) : (
              <div className="space-y-2">
                {aiValuedProducts.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-[22px] border border-white/12 bg-slate-950/18 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-white/62">
                        {item.type} - {formatInventoryQuantity(item.quantity, item.unit)}
                      </p>
                    </div>

                    <div className="flex items-end justify-between gap-4 sm:block sm:text-right">
                      <p className="text-xs text-white/58">{formatCurrency(item.unitPrice)} / base</p>
                      <p className="text-lg font-semibold text-white">{formatCurrency(item.estimatedValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
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

