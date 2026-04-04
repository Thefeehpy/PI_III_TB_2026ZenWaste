"use client"

import { useState, useEffect, useMemo } from "react"
import type { ResiduePost } from "@/lib/types"
import { PostCard } from "@/components/feed/post-card"
import { CreatePostForm } from "@/components/feed/create-post-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Empty } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, Package, X, Calendar, Scale, Layers } from "lucide-react"

export default function FeedPage() {
  const [posts, setPosts] = useState<ResiduePost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<ResiduePost[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [quantityMin, setQuantityMin] = useState("")
  const [quantityMax, setQuantityMax] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const loadPosts = () => {
    const storedPosts: ResiduePost[] = JSON.parse(
      localStorage.getItem("residuos_posts") || "[]"
    )
    setPosts(storedPosts)
  }

  useEffect(() => {
    loadPosts()
  }, [])

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.type)))
  }, [posts])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (statusFilter !== "all") count++
    if (typeFilter !== "all") count++
    if (quantityMin) count++
    if (quantityMax) count++
    if (dateFrom) count++
    if (dateTo) count++
    return count
  }, [statusFilter, typeFilter, quantityMin, quantityMax, dateFrom, dateTo])

  useEffect(() => {
    let result = [...posts]

    // Busca por texto
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (post) =>
          post.type.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query) ||
          post.companyName.toLowerCase().includes(query) ||
          post.location.toLowerCase().includes(query)
      )
    }

    // Filtro de status
    if (statusFilter !== "all") {
      result = result.filter((post) => post.status === statusFilter)
    }

    // Filtro de tipo/material
    if (typeFilter !== "all") {
      result = result.filter((post) => post.type === typeFilter)
    }

    // Filtro de quantidade minima
    if (quantityMin) {
      const min = parseFloat(quantityMin)
      result = result.filter((post) => post.quantity >= min)
    }

    // Filtro de quantidade maxima
    if (quantityMax) {
      const max = parseFloat(quantityMax)
      result = result.filter((post) => post.quantity <= max)
    }

    // Filtro de data inicial
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      result = result.filter((post) => new Date(post.createdAt) >= fromDate)
    }

    // Filtro de data final
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((post) => new Date(post.createdAt) <= toDate)
    }

    // Ordenacao
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "quantity-high":
          return b.quantity - a.quantity
        case "quantity-low":
          return a.quantity - b.quantity
        case "price-high":
          return (b.pricePerUnit || 0) - (a.pricePerUnit || 0)
        case "price-low":
          return (a.pricePerUnit || 0) - (b.pricePerUnit || 0)
        default:
          return 0
      }
    })

    setFilteredPosts(result)
  }, [searchQuery, statusFilter, typeFilter, quantityMin, quantityMax, dateFrom, dateTo, sortBy, posts])

  const clearAllFilters = () => {
    setStatusFilter("all")
    setTypeFilter("all")
    setQuantityMin("")
    setQuantityMax("")
    setDateFrom("")
    setDateTo("")
    setSortBy("newest")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur lg:top-0">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Feed de Residuos</h1>
              <p className="text-sm text-muted-foreground">
                Encontre e negocie residuos industriais
              </p>
            </div>
            <CreatePostForm onPostCreated={loadPosts} />
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo, empresa, localização..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              {/* Quick Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponivel">Disponivel</SelectItem>
                  <SelectItem value="negociando">Negociando</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>

              {/* Advanced Filters Sheet */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative">
                    <SlidersHorizontal className="mr-2 h-4 w-4 text-blue-500 dark:text-blue-400" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-violet-500 text-white text-xs">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                      Filtros Avancados
                    </SheetTitle>
                    <SheetDescription>
                      Refine sua busca com filtros detalhados
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="mt-6 space-y-6">
                    {/* Material/Tipo Filter */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Layers className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                        Tipo de Material
                      </Label>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o material" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os tipos</SelectItem>
                          {uniqueTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity Range */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Scale className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        Quantidade (kg)
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={quantityMin}
                            onChange={(e) => setQuantityMin(e.target.value)}
                          />
                        </div>
                        <span className="flex items-center text-muted-foreground">ate</span>
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Max"
                            value={quantityMax}
                            onChange={(e) => setQuantityMax(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                        Data de Postagem
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">De</Label>
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Ate</Label>
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sort By */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ordenar por</Label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ordenação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Mais recentes</SelectItem>
                          <SelectItem value="oldest">Mais antigos</SelectItem>
                          <SelectItem value="quantity-high">Maior quantidade</SelectItem>
                          <SelectItem value="quantity-low">Menor quantidade</SelectItem>
                          <SelectItem value="price-high">Maior preco</SelectItem>
                          <SelectItem value="price-low">Menor preco</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={clearAllFilters}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Limpar
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                        onClick={() => setIsFilterOpen(false)}
                      >
                        Aplicar Filtros
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Active Filters Tags */}
          {activeFiltersCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Status: {statusFilter}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setStatusFilter("all")}
                  />
                </Badge>
              )}
              {typeFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  Material: {typeFilter}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setTypeFilter("all")}
                  />
                </Badge>
              )}
              {quantityMin && (
                <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Min: {quantityMin}kg
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setQuantityMin("")}
                  />
                </Badge>
              )}
              {quantityMax && (
                <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Max: {quantityMax}kg
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setQuantityMax("")}
                  />
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  De: {new Date(dateFrom).toLocaleDateString("pt-BR")}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateFrom("")}
                  />
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  Ate: {new Date(dateTo).toLocaleDateString("pt-BR")}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateTo("")}
                  />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={clearAllFilters}
              >
                Limpar todos
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Results Count */}
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <p className="text-sm text-muted-foreground">
          {filteredPosts.length} {filteredPosts.length === 1 ? "resultado encontrado" : "resultados encontrados"}
        </p>
      </div>

      {/* Posts Grid */}
      <div className="mx-auto max-w-4xl px-4 py-4">
        {filteredPosts.length > 0 ? (
          <div className="grid gap-4">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Empty
            icon={Package}
            title="Nenhum residuo encontrado"
            description={
              posts.length === 0
                ? "Seja o primeiro a publicar um residuo para venda!"
                : "Tente ajustar os filtros de busca"
            }
          />
        )}
      </div>
    </div>
  )
}
