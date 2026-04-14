import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { priceHistory } from "@/data/mockData";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMarketInsight, getMaterialMetrics } from "@/lib/market-intelligence";
import { api } from "@/lib/api";

const defaultMaterials = getMaterialMetrics();

export default function MarketIntelligence() {
  const isMobile = useIsMobile();
  const chartTheme = useChartTheme();
  const [marketData, setMarketData] = useState({
    priceHistory,
    materials: defaultMaterials,
    insight: getMarketInsight(),
  });

  useEffect(() => {
    let active = true;

    api
      .getMarketPrices()
      .then((response) => {
        if (active) {
          setMarketData({
            priceHistory: response.priceHistory as typeof priceHistory,
            materials: response.materials as typeof defaultMaterials,
            insight: response.insight,
          });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container space-y-6 py-6 sm:space-y-8 sm:py-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Bolsa de Valores de Residuos</h1>
        <p className="text-muted-foreground">
          Inteligencia de mercado com tendencias e precos medios atualizados
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {marketData.materials.map((material) => {
          const TrendIcon = material.change > 0 ? TrendingUp : material.change < 0 ? TrendingDown : Minus;

          return (
            <Card key={material.key} className="animate-fade-in">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm text-muted-foreground">{material.name}</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {material.current.toFixed(2).replace(".", ",")}
                </p>
                <div className="flex items-center gap-1">
                  <TrendIcon
                    className={`h-4 w-4 ${
                      material.change > 0
                        ? "text-primary"
                        : material.change < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      material.change > 0
                        ? "text-primary"
                        : material.change < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {material.change > 0 ? "+" : ""}
                    {material.change}%
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    por kg
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao de Precos (Ultimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marketData.priceHistory}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={isMobile ? 10 : 12} tickMargin={8} />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={isMobile ? 10 : 12}
                  tickFormatter={(value) => `R$${value}`}
                  width={isMobile ? 48 : 60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBackground,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    borderRadius: "8px",
                    color: chartTheme.tooltipText,
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, undefined]}
                  itemStyle={{ color: chartTheme.tooltipText }}
                  labelStyle={{ color: chartTheme.tooltipText }}
                />
                <Legend wrapperStyle={{ fontSize: isMobile ? 11 : 12, paddingTop: 12 }} />
                {marketData.materials.map((material) => (
                  <Line
                    key={material.key}
                    type="monotone"
                    dataKey={material.key}
                    name={material.name}
                    stroke={material.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-accent/30">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Insight IA:</strong> {marketData.insight}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
