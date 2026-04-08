export interface WasteItem {
  id: string;
  name: string;
  type: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  company: string;
  imageUrl: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  targetQuantity: number;
  deadline: string;
  status: "em_estoque" | "em_producao" | "concluido";
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  type: "entrada" | "saida";
  quantity: number;
  unit: string;
  note?: string;
  createdAt: string;
  resultingQuantity: number;
}

export const wasteTypes = [
  "Plástico Industrial",
  "Sucata Metálica",
  "Papel e Papelão",
  "Resíduos Químicos",
  "Vidro Industrial",
  "Borracha",
  "Madeira",
  "Têxtil",
  "Eletrônico (REEE)",
  "Orgânico Industrial",
];

export const locations = [
  "São Paulo - SP",
  "Campinas - SP",
  "Belo Horizonte - MG",
  "Curitiba - PR",
  "Porto Alegre - RS",
  "Rio de Janeiro - RJ",
  "Manaus - AM",
  "Joinville - SC",
];

export const marketplaceItems: WasteItem[] = [
  {
    id: "1",
    name: "Aparas de Polietileno (PEAD)",
    type: "Plástico Industrial",
    description: "Aparas limpas de polietileno de alta densidade, provenientes de processo de extrusão. Material limpo e prensado.",
    quantity: 5000,
    unit: "kg",
    price: 2.8,
    location: "São Paulo - SP",
    company: "IndPack Ltda.",
    imageUrl: "https://images.unsplash.com/photo-1572204292164-b35ba943fca7?w=400&h=300&fit=crop",
    createdAt: "2026-04-01",
  },
  {
    id: "2",
    name: "Sucata de Aço Inox 304",
    type: "Sucata Metálica",
    description: "Retalhos e aparas de aço inoxidável 304 provenientes de estamparia. Sem contaminação.",
    quantity: 2000,
    unit: "kg",
    price: 8.5,
    location: "Campinas - SP",
    company: "MetalForge S.A.",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
    createdAt: "2026-03-28",
  },
  {
    id: "3",
    name: "Papelão Ondulado (OCC)",
    type: "Papel e Papelão",
    description: "Fardos de papelão ondulado pós-consumo industrial, prensados e limpos. Ideal para reciclagem.",
    quantity: 10000,
    unit: "kg",
    price: 0.45,
    location: "Curitiba - PR",
    company: "LogBox Embalagens",
    imageUrl: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&h=300&fit=crop",
    createdAt: "2026-04-03",
  },
  {
    id: "4",
    name: "Cacos de Vidro Soda-Cal",
    type: "Vidro Industrial",
    description: "Cacos de vidro soda-cal transparente, provenientes de processo de envase. Sem rótulos.",
    quantity: 8000,
    unit: "kg",
    price: 0.3,
    location: "Rio de Janeiro - RJ",
    company: "VidroTech Ind.",
    imageUrl: "https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=400&h=300&fit=crop",
    createdAt: "2026-04-02",
  },
  {
    id: "5",
    name: "Rebarbas de Borracha SBR",
    type: "Borracha",
    description: "Aparas e rebarbas de borracha SBR de processo de vulcanização. Material limpo.",
    quantity: 3000,
    unit: "kg",
    price: 1.2,
    location: "Joinville - SC",
    company: "FlexiRubber Ltda.",
    imageUrl: "https://images.unsplash.com/photo-1504222490345-c075b6008014?w=400&h=300&fit=crop",
    createdAt: "2026-03-30",
  },
  {
    id: "6",
    name: "Placas de Circuito Impresso",
    type: "Eletrônico (REEE)",
    description: "PCBs de equipamentos eletrônicos desativados. Rico em metais preciosos.",
    quantity: 500,
    unit: "kg",
    price: 25,
    location: "Manaus - AM",
    company: "TechRecycle Ltda.",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop",
    createdAt: "2026-04-04",
  },
];

export const priceHistory = [
  { month: "Nov", plastico: 2.5, metal: 7.8, papel: 0.4, vidro: 0.28, borracha: 1.1 },
  { month: "Dez", plastico: 2.6, metal: 8, papel: 0.42, vidro: 0.29, borracha: 1.15 },
  { month: "Jan", plastico: 2.7, metal: 8.2, papel: 0.43, vidro: 0.3, borracha: 1.18 },
  { month: "Fev", plastico: 2.65, metal: 8.5, papel: 0.44, vidro: 0.3, borracha: 1.2 },
  { month: "Mar", plastico: 2.75, metal: 8.4, papel: 0.45, vidro: 0.31, borracha: 1.22 },
  { month: "Abr", plastico: 2.8, metal: 8.5, papel: 0.45, vidro: 0.3, borracha: 1.2 },
];
