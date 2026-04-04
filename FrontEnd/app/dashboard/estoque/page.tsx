"use client"

import { useState, useEffect } from "react"
import type { StockItem } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Empty } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Plus, Package, Target, TrendingUp, Calendar, Edit2 } from "lucide-react"

const residueTypes = [
  "Alumínio",
  "Cobre",
  "Ferro",
  "Aço Inox",
  "Papelão",
  "Papel Branco",
  "PET",
  "PEAD",
  "Vidro Transparente",
  "Vidro Colorido",
  "Óleo de Cozinha",
  "Resíduo Eletrônico",
  "Madeira",
  "Borracha",
  "Têxtil",
  "Outro",
]

export default function EstoquePage() {
  const { user } = useAuth()
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: "",
    customType: "",
    quantity: "",
    unit: "kg" as "kg" | "ton" | "litros" | "unidades",
    description: "",
    targetQuantity: "",
    targetDeadline: "",
  })
  const [updateQuantity, setUpdateQuantity] = useState("")

  const loadStock = () => {
    if (!user) return
    const allStock: StockItem[] = JSON.parse(
      localStorage.getItem("residuos_stock") || "[]"
    )
    const userStock = allStock.filter((item) => item.companyId === user.id)
    setStockItems(userStock)
  }

  useEffect(() => {
    loadStock()
  }, [user])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)

    const newItem: StockItem = {
      id: crypto.randomUUID(),
      companyId: user.id,
      type: formData.type === "Outro" ? formData.customType : formData.type,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      description: formData.description,
      targetQuantity: formData.targetQuantity ? parseFloat(formData.targetQuantity) : undefined,
      targetDeadline: formData.targetDeadline || undefined,
      weeklyUpdates: [
        {
          date: new Date().toISOString(),
          quantity: parseFloat(formData.quantity),
        },
      ],
      createdAt: new Date().toISOString(),
    }

    const allStock: StockItem[] = JSON.parse(
      localStorage.getItem("residuos_stock") || "[]"
    )
    allStock.push(newItem)
    localStorage.setItem("residuos_stock", JSON.stringify(allStock))

    setIsLoading(false)
    setIsCreateOpen(false)
    setFormData({
      type: "",
      customType: "",
      quantity: "",
      unit: "kg",
      description: "",
      targetQuantity: "",
      targetDeadline: "",
    })
    loadStock()
  }

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    setIsLoading(true)

    const newQuantity = parseFloat(updateQuantity)
    const allStock: StockItem[] = JSON.parse(
      localStorage.getItem("residuos_stock") || "[]"
    )

    const updatedStock = allStock.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          quantity: newQuantity,
          weeklyUpdates: [
            ...item.weeklyUpdates,
            {
              date: new Date().toISOString(),
              quantity: newQuantity,
            },
          ],
        }
      }
      return item
    })

    localStorage.setItem("residuos_stock", JSON.stringify(updatedStock))

    setIsLoading(false)
    setIsUpdateOpen(false)
    setUpdateQuantity("")
    setSelectedItem(null)
    loadStock()
  }

  const calculateProgress = (item: StockItem) => {
    if (!item.targetQuantity) return 0
    return Math.min((item.quantity / item.targetQuantity) * 100, 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })
  }

  const totalItems = stockItems.length
  const itemsWithTarget = stockItems.filter((item) => item.targetQuantity)
  const completedTargets = itemsWithTarget.filter(
    (item) => item.quantity >= (item.targetQuantity || 0)
  ).length

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus resíduos e acompanhe metas de produção
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md shadow-violet-600/30">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo tipo de resíduo para controle
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateStock} className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Tipo de Resíduo</FieldLabel>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => handleChange("type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {residueTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {formData.type === "Outro" && (
                      <Field>
                        <FieldLabel>Especifique o tipo</FieldLabel>
                        <Input
                          placeholder="Digite o tipo de resíduo"
                          value={formData.customType}
                          onChange={(e) => handleChange("customType", e.target.value)}
                          required
                        />
                      </Field>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel>Quantidade Atual</FieldLabel>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.quantity}
                          onChange={(e) => handleChange("quantity", e.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Unidade</FieldLabel>
                        <Select
                          value={formData.unit}
                          onValueChange={(value) => handleChange("unit", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">Quilograma (kg)</SelectItem>
                            <SelectItem value="ton">Tonelada (ton)</SelectItem>
                            <SelectItem value="litros">Litros</SelectItem>
                            <SelectItem value="unidades">Unidades</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Descrição</FieldLabel>
                      <Textarea
                        placeholder="Descreva o resíduo, origem, etc."
                        value={formData.description}
                        onChange={(e) => handleChange("description", e.target.value)}
                        rows={2}
                      />
                    </Field>

                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-foreground mb-3">
                        Meta de Produção (Opcional)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field>
                          <FieldLabel>Quantidade Meta</FieldLabel>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.targetQuantity}
                            onChange={(e) => handleChange("targetQuantity", e.target.value)}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Prazo</FieldLabel>
                          <Input
                            type="date"
                            value={formData.targetDeadline}
                            onChange={(e) => handleChange("targetDeadline", e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  </FieldGroup>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                      disabled={isLoading || !formData.type || !formData.quantity}
                    >
                      {isLoading ? <Spinner className="mr-2" /> : null}
                      {isLoading ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Itens no Estoque</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                {totalItems}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Com Meta Definida</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Target className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                {itemsWithTarget.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Metas Atingidas</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                {completedTargets}/{itemsWithTarget.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Stock Items */}
        {stockItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stockItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.type}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {item.description || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedItem(item)
                        setUpdateQuantity(item.quantity.toString())
                        setIsUpdateOpen(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-bold text-foreground">
                        {item.quantity.toLocaleString("pt-BR")}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">
                        {item.unit}
                      </span>
                    </div>
                    {item.targetQuantity && (
                      <Badge
                        variant="outline"
                        className={
                          item.quantity >= item.targetQuantity
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                        }
                      >
                        {item.quantity >= item.targetQuantity ? "Meta atingida" : "Em progresso"}
                      </Badge>
                    )}
                  </div>

                  {item.targetQuantity && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Meta: {item.targetQuantity.toLocaleString("pt-BR")} {item.unit}
                        </span>
                        <span className="font-medium">
                          {calculateProgress(item).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={calculateProgress(item)} className="h-2" />
                      {item.targetDeadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Prazo: {new Date(item.targetDeadline).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mini Chart */}
                  {item.weeklyUpdates.length > 1 && (
                    <div className="h-[100px] pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={item.weeklyUpdates}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9 }}
                            tickFormatter={formatDate}
                          />
                          <YAxis tick={{ fontSize: 9 }} width={40} />
                          <Tooltip
                            formatter={(value: number) => [
                              `${value.toLocaleString("pt-BR")} ${item.unit}`,
                              "Quantidade",
                            ]}
                            labelFormatter={(label) => formatDate(label)}
                          />
                          {item.targetQuantity && (
                            <ReferenceLine
                              y={item.targetQuantity}
                              stroke="#f59e0b"
                              strokeDasharray="5 5"
                              label={{ value: "Meta", fontSize: 9, fill: "#f59e0b" }}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="quantity"
                            stroke="oklch(0.55 0.2 250)"
                            strokeWidth={2}
                            dot={{ fill: "oklch(0.55 0.2 250)", r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            icon={Package}
            title="Nenhum item no estoque"
            description="Adicione itens para começar a controlar seus resíduos"
          />
        )}
      </div>

      {/* Update Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Quantidade</DialogTitle>
            <DialogDescription>
              {selectedItem?.type} - Atualização semanal
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateStock} className="space-y-4">
            <Field>
              <FieldLabel>Nova Quantidade ({selectedItem?.unit})</FieldLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={updateQuantity}
                onChange={(e) => setUpdateQuantity(e.target.value)}
                required
              />
            </Field>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsUpdateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                disabled={isLoading || !updateQuantity}
              >
                {isLoading ? <Spinner className="mr-2" /> : null}
                {isLoading ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
