"use client"

import { useState, useEffect } from "react"
import type { ResiduePost } from "@/lib/types"
import { PostCard } from "@/components/feed/post-card"
import { CreatePostForm } from "@/components/feed/create-post-form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty } from "@/components/ui/empty"
import { Search, Filter, Package } from "lucide-react"

export default function FeedPage() {
  const [posts, setPosts] = useState<ResiduePost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<ResiduePost[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const loadPosts = () => {
    const storedPosts: ResiduePost[] = JSON.parse(
      localStorage.getItem("residuos_posts") || "[]"
    )
    setPosts(storedPosts)
    setFilteredPosts(storedPosts)
  }

  useEffect(() => {
    loadPosts()
  }, [])

  useEffect(() => {
    let result = posts

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

    if (statusFilter !== "all") {
      result = result.filter((post) => post.status === statusFilter)
    }

    if (typeFilter !== "all") {
      result = result.filter((post) => post.type === typeFilter)
    }

    setFilteredPosts(result)
  }, [searchQuery, statusFilter, typeFilter, posts])

  const uniqueTypes = Array.from(new Set(posts.map((post) => post.type)))

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur lg:top-0">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Feed de Resíduos</h1>
              <p className="text-sm text-muted-foreground">
                Encontre e negocie resíduos industriais
              </p>
            </div>
            <CreatePostForm onPostCreated={loadPosts} />
          </div>

          {/* Filters */}
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="negociando">Negociando</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Posts Grid */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {filteredPosts.length > 0 ? (
          <div className="grid gap-4">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Empty
            icon={Package}
            title="Nenhum resíduo encontrado"
            description={
              posts.length === 0
                ? "Seja o primeiro a publicar um resíduo para venda!"
                : "Tente ajustar os filtros de busca"
            }
          />
        )}
      </div>
    </div>
  )
}
