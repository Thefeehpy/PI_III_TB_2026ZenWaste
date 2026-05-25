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
import { FileCheck2, Package, ShoppingBag, Weight } from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { inventoryStatusMap } from "@/lib/inventory";

export default function Dashboard() {
  const { items, reservations, sellerAds } = useInventory();
  const isMobile = useIsMobile();
  const chartTheme = useChartTheme();

  const totalWeight = items.reduce((sum, item) => sum + item.quantity, 0);
  const openReservations = reservations.filter((reservation) =>
    reservation.status === "em_captacao" || reservation.status === "pronta"
  ).length;
  const activeAds = sellerAds.filter((ad) => ad.status === "ativo").length;

  const stockData = items.map((item) => ({
    name: item.name,
    saldo: item.quantity,
  }));

  const statusData = [
    {
      name: inventoryStatusMap.disponivel.label,
      value: items.filter((item) => item.quantity > 0).length,
      color: inventoryStatusMap.disponivel.color,
    },
    {
      name: inventoryStatusMap.sem_saldo.label,
      value: items.filter((item) => item.quantity <= 0).length,
      color: inventoryStatusMap.sem_saldo.color,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visao Geral</h2>
        <p className="text-muted-foreground">Acompanhe saldo, anuncios e reservas dos seus residuos</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Itens no Estoque" value={items.length} icon={Package} subtitle="tipos de residuos" />
        <MetricCard
          title="Peso Total"
          value={`${(totalWeight / 1000).toFixed(1)} ton`}
          icon={Weight}
          subtitle="saldo atual"
        />
        <MetricCard title="Anuncios Ativos" value={activeAds} icon={ShoppingBag} subtitle="ofertas publicadas" />
        <MetricCard title="Reservas Abertas" value={openReservations} icon={FileCheck2} subtitle="pedidos futuros" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Saldo Atual por Residuo</CardTitle>
          </CardHeader>
          <CardContent>
            {stockData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                Cadastre residuos no estoque para acompanhar o saldo atual.
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockData} layout="vertical">
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis type="number" stroke={chartTheme.axis} fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={chartTheme.axis}
                      fontSize={12}
                      width={isMobile ? 84 : 120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBackground,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: "8px",
                        color: chartTheme.tooltipText,
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{ color: chartTheme.tooltipText }}
                    />
                    <Bar dataKey="saldo" name="Saldo" fill={chartTheme.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status do Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex h-[248px] items-center justify-center text-center text-sm text-muted-foreground">
                O grafico de status aparecera assim que houver itens cadastrados.
              </div>
            ) : (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltipBackground,
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          borderRadius: "8px",
                          color: chartTheme.tooltipText,
                        }}
                        itemStyle={{ color: chartTheme.tooltipText }}
                        labelStyle={{ color: chartTheme.tooltipText }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  {statusData.map((status) => (
                    <div key={status.name} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-muted-foreground">
                        {status.name} ({status.value})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
