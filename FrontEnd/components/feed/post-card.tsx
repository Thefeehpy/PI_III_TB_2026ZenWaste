"use client"

import { useState } from "react"
import type { ResiduePost } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Package, Phone, Calendar } from "lucide-react"

interface PostCardProps {
  post: ResiduePost
}

export function PostCard({ post }: PostCardProps) {
  const { user } = useAuth()
  const [imageError, setImageError] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponivel":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700"
      case "negociando":
        return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-700"
      case "vendido":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "disponivel":
        return "Disponivel"
      case "negociando":
        return "Em Negociacao"
      case "vendido":
        return "Vendido"
      default:
        return status
    }
  }

  const isOwnPost = user?.id === post.companyId

  return (
    <Card className="overflow-hidden border border-border hover:shadow-lg transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-sm font-semibold">
                {getInitials(post.companyName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{post.companyName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(post.createdAt)}
              </div>
            </div>
          </div>
          <Badge className={getStatusColor(post.status)} variant="outline">
            {getStatusLabel(post.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Image */}
        {post.images.length > 0 && !imageError && (
          <div className="mb-4 overflow-hidden rounded-lg bg-muted">
            <img
              src={post.images[0]}
              alt={post.type}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{post.type}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {post.quantity} {post.unit}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">{post.location}</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border pt-3">
        <div className="flex w-full items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Preco por {post.unit}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatPrice(post.price)}
            </p>
          </div>
          {!isOwnPost && post.status === "disponivel" && (
            <div className="flex items-center gap-2">
              {showContact ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-medium">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">Entre em contato com a empresa</span>
                </div>
              ) : (
                <Button
                  onClick={() => setShowContact(true)}
                  className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md shadow-violet-600/30"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Contato
                </Button>
              )}
            </div>
          )}
          {isOwnPost && (
            <Badge variant="secondary" className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
              Sua publicacao
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
