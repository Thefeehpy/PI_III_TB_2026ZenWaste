import { Package, Weight, FileCheck2, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { useInventory } from "@/contexts/InventoryContext";
import { inventoryStatusMap } from "@/lib/inventory";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const { items } = useInventory();
  const totalWeight = items.reduce((sum, item) => sum + item.quantity, 0);
  const completionRate = items.length === 0
    ? 0
    : Math.round(
      items.reduce((sum, item) => sum + Math.min(item.quantity / item.targetQuantity, 1), 0) / items.length * 100,
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
        <h2 className="text-2xl font-bold text-foreground">Visão Geral</h2>
        <p className="text-muted-foreground">Acompanhe o progresso da sua gestão de resíduos</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Itens no Estoque" value={items.length} icon={Package} subtitle="tipos de resíduos" />
        <MetricCard title="Peso Total" value={`${(totalWeight / 1000).toFixed(1)} ton`} icon={Weight} subtitle="volume cadastrado" />
        <MetricCard title="Contratos Ativos" value={0} icon={FileCheck2} subtitle="sem integração comercial" />
        <MetricCard title="Taxa de Conclusão" value={`${completionRate}%`} icon={Target} trend="Meta: 100%" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Saldo Atual vs Meta</CardTitle>
          </CardHeader>
          <CardContent>
            {progressData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                Cadastre resíduos no estoque para acompanhar o saldo atual versus a meta.
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                    <XAxis type="number" stroke="hsl(215, 15%, 50%)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(215, 15%, 50%)" fontSize={12} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px" }} />
                    <Bar dataKey="atual" name="Atual" fill="hsl(152, 55%, 35%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="meta" name="Meta" fill="hsl(214, 20%, 90%)" radius={[0, 4, 4, 0]} />
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
                O gráfico de status aparecerá assim que houver itens cadastrados.
              </div>
            ) : (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-center gap-4">
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
