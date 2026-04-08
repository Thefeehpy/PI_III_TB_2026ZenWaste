import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { priceHistory } from "@/data/mockData";
import { getMarketInsight, getMaterialMetrics } from "@/lib/market-intelligence";

const materials = getMaterialMetrics();

export default function MarketIntelligence() {
  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Bolsa de Valores de Resíduos</h1>
        <p className="text-muted-foreground">Inteligência de mercado com tendências e preços médios atualizados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {materials.map((material) => {
          const TrendIcon = material.change > 0 ? TrendingUp : material.change < 0 ? TrendingDown : Minus;
          return (
            <Card key={material.key} className="animate-fade-in">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground">{material.name}</p>
                <p className="text-2xl font-bold text-foreground">R$ {material.current.toFixed(2).replace(".", ",")}</p>
                <div className="flex items-center gap-1">
                  <TrendIcon className={`h-4 w-4 ${material.change > 0 ? "text-primary" : material.change < 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${material.change > 0 ? "text-primary" : material.change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {material.change > 0 ? "+" : ""}{material.change}%
                  </span>
                  <Badge variant="secondary" className="text-xs ml-auto">por kg</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução de Preços (Últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                <XAxis dataKey="month" stroke="hsl(215, 15%, 50%)" fontSize={12} />
                <YAxis stroke="hsl(215, 15%, 50%)" fontSize={12} tickFormatter={(value) => `R$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, undefined]}
                />
                <Legend />
                {materials.map((material) => (
                  <Line key={material.key} type="monotone" dataKey={material.key} name={material.name} stroke={material.color} strokeWidth={2} dot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-accent/30">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Insight IA:</strong> {getMarketInsight()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
