import { priceHistory } from "@/data/mockData";

const materialMap = {
  plastico: "Plástico Industrial",
  metal: "Sucata Metálica",
  papel: "Papel e Papelão",
  vidro: "Vidro Industrial",
  borracha: "Borracha",
} as const;

export type MaterialKey = keyof typeof materialMap;

export interface MaterialMetric {
  key: MaterialKey;
  name: string;
  color: string;
  current: number;
  change: number;
}

export const materialColors: Record<MaterialKey, string> = {
  plastico: "hsl(152, 55%, 35%)",
  metal: "hsl(213, 50%, 35%)",
  papel: "hsl(38, 92%, 50%)",
  vidro: "hsl(0, 72%, 51%)",
  borracha: "hsl(270, 50%, 50%)",
};

export function getMaterialMetrics(): MaterialMetric[] {
  const first = priceHistory[0];
  const last = priceHistory[priceHistory.length - 1];

  return (Object.keys(materialMap) as MaterialKey[]).map((key) => {
    const initialPrice = first[key];
    const currentPrice = last[key];
    const change = initialPrice === 0 ? 0 : Number((((currentPrice - initialPrice) / initialPrice) * 100).toFixed(1));

    return {
      key,
      name: materialMap[key],
      color: materialColors[key],
      current: currentPrice,
      change,
    };
  });
}

export function getSuggestedPriceByWasteType(type: string) {
  const metrics = getMaterialMetrics();
  const matched = metrics.find((metric) => metric.name === type);

  if (!matched) {
    return 1;
  }

  return matched.current;
}

export function getMarketInsight() {
  const metrics = getMaterialMetrics();
  const sortedByChange = [...metrics].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const top = sortedByChange[0];

  if (!top) {
    return "Sem dados suficientes para gerar insights de mercado.";
  }

  if (top.change > 0) {
    return `O preço de ${top.name} subiu ${top.change}% no período analisado. Há um bom momento para publicar ofertas deste material com foco em margem.`;
  }

  if (top.change < 0) {
    return `O preço de ${top.name} caiu ${Math.abs(top.change)}% no período analisado. Vale priorizar giro de estoque e negociações mais rápidas.`;
  }

  return `O preço de ${top.name} ficou estável no período analisado. A recomendação é competir por qualidade do material e confiabilidade de entrega.`;
}
