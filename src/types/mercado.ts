export interface IndicadorMaterial {
  key: string;
  name: string;
  color: string;
  current: number;
  change: number;
}

export interface PrecosMercado {
  priceHistory: Array<Record<string, number | string>>;
  materials: IndicadorMaterial[];
  insight: string;
}

export interface ContextoSugestaoAnuncio {
  name?: string;
  type: string;
  quantity?: number;
  unit?: string;
  location?: string;
}

interface OrigemSugestao {
  source: "ai" | "fallback";
  aiAvailable: boolean;
  message?: string;
}

export interface SugestaoPreco extends OrigemSugestao {
  suggestedPrice: number;
  insight: string;
}

export interface SugestaoDescricao extends OrigemSugestao {
  description: string;
}
