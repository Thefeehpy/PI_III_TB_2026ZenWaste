"use client"

import { useState, useEffect } from "react"
import type { MaterialPrice } from "@/lib/types"
import { materialPrices } from "@/lib/mock-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Search, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react"

export default function BolsaPage() {
  const [materials, setMaterials] = useState<MaterialPrice[]>(materialPrices)
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialPrice[]>(materialPrices)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPrice | null>(null)

  useEffect(() => {
    let result = materials

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query)
      )
    }

    if (categoryFilter !== "all") {
      result = result.filter((m) => m.category === categoryFilter)
    }

    setFilteredMaterials(result)
  }, [searchQuery, categoryFilter, materials])

  const categories = Array.from(new Set(materials.map((m) => m.category)))

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price)
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-emerald-600" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-emerald-600"
    if (change < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  const topGainers = [...materials]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3)

  const topLosers = [...materials]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Bolsa de Valores</h1>
              <p className="text-sm text-muted-foreground">
                Cotações atualizadas de materiais recicláveis
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Última atualização: {new Date().toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Materiais</CardDescription>
              <CardTitle className="text-3xl">{materials.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Categorias</CardDescription>
              <CardTitle className="text-3xl">{categories.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-700">Maior Alta</CardDescription>
              <CardTitle className="text-xl text-emerald-700">
                {topGainers[0]?.name}
                <span className="ml-2 text-sm font-normal">
                  +{topGainers[0]?.changePercent.toFixed(2)}%
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-700">Maior Baixa</CardDescription>
              <CardTitle className="text-xl text-red-700">
                {topLosers[0]?.name}
                <span className="ml-2 text-sm font-normal">
                  {topLosers[0]?.changePercent.toFixed(2)}%
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Materials Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Cotações</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar material..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-[180px] pl-10"
                      />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaterials.map((material) => (
                        <TableRow
                          key={material.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedMaterial(material)}
                        >
                          <TableCell className="font-medium">
                            {material.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{material.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPrice(material.currentPrice)}/{material.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {getTrendIcon(material.change)}
                              <span className={getTrendColor(material.change)}>
                                {material.change > 0 ? "+" : ""}
                                {material.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Chart */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  {selectedMaterial ? selectedMaterial.name : "Selecione um Material"}
                </CardTitle>
                <CardDescription>
                  {selectedMaterial
                    ? `Histórico de preços (${selectedMaterial.unit})`
                    : "Clique em um material para ver o gráfico"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedMaterial ? (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold text-foreground">
                        {formatPrice(selectedMaterial.currentPrice)}
                      </span>
                      <div className={`flex items-center gap-1 ${getTrendColor(selectedMaterial.change)}`}>
                        {getTrendIcon(selectedMaterial.change)}
                        <span className="text-sm font-medium">
                          {selectedMaterial.change > 0 ? "+" : ""}
                          {formatPrice(selectedMaterial.change)}
                        </span>
                      </div>
                    </div>

                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedMaterial.history}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => {
                              const date = new Date(value)
                              return date.toLocaleDateString("pt-BR", { month: "short" })
                            }}
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => `R$${value}`}
                          />
                          <Tooltip
                            formatter={(value: number) => [formatPrice(value), "Preço"]}
                            labelFormatter={(label) =>
                              new Date(label).toLocaleDateString("pt-BR")
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#059669"
                            strokeWidth={2}
                            dot={{ fill: "#059669" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Preço Anterior</p>
                        <p className="text-sm font-medium">
                          {formatPrice(selectedMaterial.previousPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Variação %</p>
                        <p className={`text-sm font-medium ${getTrendColor(selectedMaterial.change)}`}>
                          {selectedMaterial.changePercent > 0 ? "+" : ""}
                          {selectedMaterial.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="mx-auto h-12 w-12 opacity-50" />
                      <p className="mt-2">Selecione um material na tabela</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
