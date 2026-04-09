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
import { FileCheck2, Package, Target, Weight } from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { inventoryStatusMap } from "@/lib/inventory";

export default function Dashboard() {
  const { items } = useInventory();
  const isMobile = useIsMobile();
  const chartTheme = useChartTheme();

  const totalWeight = items.reduce((sum, item) => sum + item.quantity, 0);
  const completionRate =
    items.length === 0
      ? 0
      : Math.round(
          (items.reduce((sum, item) => sum + Math.min(item.quantity / item.targetQuantity, 1), 0) /
            items.length) *
            100,
        );

  const progressData = items.map((item) => ({
    name: item.name,
    atual: item.quantity,
    meta: item.targetQuantity,
  }));

  const statusData = [
    {
      name: inventoryStatusMap.em_producao.label,
      value: items.filter((item) => item.status === "em_producao").length,
      color: inventoryStatusMap.em_producao.color,
    },
    {
      name: inventoryStatusMap.em_estoque.label,
      value: items.filter((item) => item.status === "em_estoque").length,
      color: inventoryStatusMap.em_estoque.color,
    },
    {
      name: inventoryStatusMap.concluido.label,
      value: items.filter((item) => item.status === "concluido").length,
      color: inventoryStatusMap.concluido.color,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visao Geral</h2>
        <p className="text-muted-foreground">Acompanhe o progresso da sua gestao de residuos</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Itens no Estoque" value={items.length} icon={Package} subtitle="tipos de residuos" />
        <MetricCard
          title="Peso Total"
          value={`${(totalWeight / 1000).toFixed(1)} ton`}
          icon={Weight}
          subtitle="volume cadastrado"
        />
        <MetricCard
          title="Contratos Ativos"
          value={0}
          icon={FileCheck2}
          subtitle="sem integracao comercial"
        />
        <MetricCard title="Taxa de Conclusao" value={`${completionRate}%`} icon={Target} trend="Meta: 100%" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Saldo Atual vs Meta</CardTitle>
          </CardHeader>
          <CardContent>
            {progressData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                Cadastre residuos no estoque para acompanhar o saldo atual versus a meta.
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData} layout="vertical">
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
                    <Bar dataKey="atual" name="Atual" fill={chartTheme.primary} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="meta" name="Meta" fill={chartTheme.secondary} radius={[0, 4, 4, 0]} />
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
