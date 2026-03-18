"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ResiduePost } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Package, MessageSquare, Calendar } from "lucide-react"
import type { ChatRoom } from "@/lib/types"

interface PostCardProps {
  post: ResiduePost
}

export function PostCard({ post }: PostCardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [imageError, setImageError] = useState(false)

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
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "negociando":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "vendido":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "disponivel":
        return "Disponível"
      case "negociando":
        return "Em Negociação"
      case "vendido":
        return "Vendido"
      default:
        return status
    }
  }

  const handleContact = () => {
    if (!user) return

    // Check if chat room already exists
    const existingRooms: ChatRoom[] = JSON.parse(
      localStorage.getItem("residuos_chats") || "[]"
    )

    let room = existingRooms.find(
      (r) =>
        r.participants.includes(user.id) &&
        r.participants.includes(post.companyId) &&
        r.relatedPostId === post.id
    )

    if (!room) {
      // Create new chat room
      room = {
        id: crypto.randomUUID(),
        participants: [user.id, post.companyId],
        participantNames: [user.name, post.companyName],
        relatedPostId: post.id,
        createdAt: new Date().toISOString(),
      }
      existingRooms.push(room)
      localStorage.setItem("residuos_chats", JSON.stringify(existingRooms))
    }

    router.push(`/dashboard/chat?room=${room.id}`)
  }

  const isOwnPost = user?.id === post.companyId

  return (
    <Card className="overflow-hidden border border-border hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-emerald-600 text-white text-sm">
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
              className="h-48 w-full object-cover"
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
            <p className="text-xs text-muted-foreground">Preço por {post.unit}</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatPrice(post.price)}
            </p>
          </div>
          {!isOwnPost && post.status === "disponivel" && (
            <Button
              onClick={handleContact}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Negociar
            </Button>
          )}
          {isOwnPost && (
            <Badge variant="secondary">Sua publicação</Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
