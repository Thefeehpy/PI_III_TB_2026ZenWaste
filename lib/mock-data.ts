import type { MaterialPrice } from "./types"

export const materialPrices: MaterialPrice[] = [
  {
    id: "1",
    name: "Alumínio",
    category: "Metais",
    currentPrice: 8.50,
    previousPrice: 8.20,
    unit: "kg",
    change: 0.30,
    changePercent: 3.66,
    history: [
      { date: "2024-01-01", price: 7.80 },
      { date: "2024-02-01", price: 8.00 },
      { date: "2024-03-01", price: 8.10 },
      { date: "2024-04-01", price: 8.20 },
      { date: "2024-05-01", price: 8.50 },
    ],
  },
  {
    id: "2",
    name: "Cobre",
    category: "Metais",
    currentPrice: 42.00,
    previousPrice: 43.50,
    unit: "kg",
    change: -1.50,
    changePercent: -3.45,
    history: [
      { date: "2024-01-01", price: 40.00 },
      { date: "2024-02-01", price: 41.00 },
      { date: "2024-03-01", price: 42.50 },
      { date: "2024-04-01", price: 43.50 },
      { date: "2024-05-01", price: 42.00 },
    ],
  },
  {
    id: "3",
    name: "Papelão",
    category: "Papel",
    currentPrice: 0.45,
    previousPrice: 0.42,
    unit: "kg",
    change: 0.03,
    changePercent: 7.14,
    history: [
      { date: "2024-01-01", price: 0.38 },
      { date: "2024-02-01", price: 0.40 },
      { date: "2024-03-01", price: 0.41 },
      { date: "2024-04-01", price: 0.42 },
      { date: "2024-05-01", price: 0.45 },
    ],
  },
  {
    id: "4",
    name: "PET",
    category: "Plásticos",
    currentPrice: 2.80,
    previousPrice: 2.75,
    unit: "kg",
    change: 0.05,
    changePercent: 1.82,
    history: [
      { date: "2024-01-01", price: 2.60 },
      { date: "2024-02-01", price: 2.65 },
      { date: "2024-03-01", price: 2.70 },
      { date: "2024-04-01", price: 2.75 },
      { date: "2024-05-01", price: 2.80 },
    ],
  },
  {
    id: "5",
    name: "PEAD",
    category: "Plásticos",
    currentPrice: 2.20,
    previousPrice: 2.30,
    unit: "kg",
    change: -0.10,
    changePercent: -4.35,
    history: [
      { date: "2024-01-01", price: 2.40 },
      { date: "2024-02-01", price: 2.35 },
      { date: "2024-03-01", price: 2.30 },
      { date: "2024-04-01", price: 2.30 },
      { date: "2024-05-01", price: 2.20 },
    ],
  },
  {
    id: "6",
    name: "Vidro Transparente",
    category: "Vidros",
    currentPrice: 0.18,
    previousPrice: 0.17,
    unit: "kg",
    change: 0.01,
    changePercent: 5.88,
    history: [
      { date: "2024-01-01", price: 0.15 },
      { date: "2024-02-01", price: 0.16 },
      { date: "2024-03-01", price: 0.16 },
      { date: "2024-04-01", price: 0.17 },
      { date: "2024-05-01", price: 0.18 },
    ],
  },
  {
    id: "7",
    name: "Ferro",
    category: "Metais",
    currentPrice: 1.20,
    previousPrice: 1.15,
    unit: "kg",
    change: 0.05,
    changePercent: 4.35,
    history: [
      { date: "2024-01-01", price: 1.05 },
      { date: "2024-02-01", price: 1.08 },
      { date: "2024-03-01", price: 1.12 },
      { date: "2024-04-01", price: 1.15 },
      { date: "2024-05-01", price: 1.20 },
    ],
  },
  {
    id: "8",
    name: "Aço Inox",
    category: "Metais",
    currentPrice: 6.80,
    previousPrice: 6.50,
    unit: "kg",
    change: 0.30,
    changePercent: 4.62,
    history: [
      { date: "2024-01-01", price: 6.00 },
      { date: "2024-02-01", price: 6.20 },
      { date: "2024-03-01", price: 6.35 },
      { date: "2024-04-01", price: 6.50 },
      { date: "2024-05-01", price: 6.80 },
    ],
  },
  {
    id: "9",
    name: "Papel Branco",
    category: "Papel",
    currentPrice: 0.55,
    previousPrice: 0.52,
    unit: "kg",
    change: 0.03,
    changePercent: 5.77,
    history: [
      { date: "2024-01-01", price: 0.48 },
      { date: "2024-02-01", price: 0.50 },
      { date: "2024-03-01", price: 0.51 },
      { date: "2024-04-01", price: 0.52 },
      { date: "2024-05-01", price: 0.55 },
    ],
  },
  {
    id: "10",
    name: "Óleo de Cozinha",
    category: "Orgânicos",
    currentPrice: 1.80,
    previousPrice: 1.90,
    unit: "litro",
    change: -0.10,
    changePercent: -5.26,
    history: [
      { date: "2024-01-01", price: 2.00 },
      { date: "2024-02-01", price: 1.95 },
      { date: "2024-03-01", price: 1.92 },
      { date: "2024-04-01", price: 1.90 },
      { date: "2024-05-01", price: 1.80 },
    ],
  },
]

export function initializeMockData() {
  if (typeof window === "undefined") return

  if (!localStorage.getItem("residuos_materials")) {
    localStorage.setItem("residuos_materials", JSON.stringify(materialPrices))
  }

  if (!localStorage.getItem("residuos_posts")) {
    localStorage.setItem("residuos_posts", JSON.stringify([]))
  }

  if (!localStorage.getItem("residuos_stock")) {
    localStorage.setItem("residuos_stock", JSON.stringify([]))
  }

  if (!localStorage.getItem("residuos_chats")) {
    localStorage.setItem("residuos_chats", JSON.stringify([]))
  }

  if (!localStorage.getItem("residuos_messages")) {
    localStorage.setItem("residuos_messages", JSON.stringify([]))
  }
}
