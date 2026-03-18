"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import type { ChatRoom, ChatMessage, ResiduePost } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { Send, MessageSquare, Package, ArrowLeft } from "lucide-react"

export default function ChatPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const roomIdParam = searchParams.get("room")
  
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [relatedPost, setRelatedPost] = useState<ResiduePost | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadChatRooms = () => {
    if (!user) return
    const allRooms: ChatRoom[] = JSON.parse(
      localStorage.getItem("residuos_chats") || "[]"
    )
    const userRooms = allRooms.filter((room) =>
      room.participants.includes(user.id)
    )
    setChatRooms(userRooms)

    // Auto-select room from URL param
    if (roomIdParam) {
      const room = userRooms.find((r) => r.id === roomIdParam)
      if (room) {
        setSelectedRoom(room)
        setShowMobileChat(true)
      }
    }
  }

  const loadMessages = () => {
    if (!selectedRoom) return
    const allMessages: ChatMessage[] = JSON.parse(
      localStorage.getItem("residuos_messages") || "[]"
    )
    const roomMessages = allMessages.filter(
      (msg) => msg.roomId === selectedRoom.id
    )
    setMessages(roomMessages)

    // Load related post
    if (selectedRoom.relatedPostId) {
      const posts: ResiduePost[] = JSON.parse(
        localStorage.getItem("residuos_posts") || "[]"
      )
      const post = posts.find((p) => p.id === selectedRoom.relatedPostId)
      setRelatedPost(post || null)
    } else {
      setRelatedPost(null)
    }
  }

  useEffect(() => {
    loadChatRooms()
  }, [user])

  useEffect(() => {
    loadMessages()
  }, [selectedRoom])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedRoom || !newMessage.trim()) return

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: selectedRoom.id,
      senderId: user.id,
      senderName: user.name,
      content: newMessage.trim(),
      createdAt: new Date().toISOString(),
    }

    const allMessages: ChatMessage[] = JSON.parse(
      localStorage.getItem("residuos_messages") || "[]"
    )
    allMessages.push(message)
    localStorage.setItem("residuos_messages", JSON.stringify(allMessages))

    // Update room's last message
    const allRooms: ChatRoom[] = JSON.parse(
      localStorage.getItem("residuos_chats") || "[]"
    )
    const updatedRooms = allRooms.map((room) => {
      if (room.id === selectedRoom.id) {
        return {
          ...room,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
        }
      }
      return room
    })
    localStorage.setItem("residuos_chats", JSON.stringify(updatedRooms))

    setNewMessage("")
    loadMessages()
    loadChatRooms()
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getOtherParticipantName = (room: ChatRoom) => {
    if (!user) return ""
    const index = room.participants.indexOf(user.id)
    return room.participantNames[index === 0 ? 1 : 0]
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Hoje"
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem"
    }
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })
  }

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room)
    setShowMobileChat(true)
  }

  const handleBackToList = () => {
    setShowMobileChat(false)
    setSelectedRoom(null)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen bg-background">
      {/* Chat List */}
      <div
        className={cn(
          "w-full border-r border-border lg:w-80",
          showMobileChat && "hidden lg:block"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-4">
            <h1 className="text-xl font-bold text-foreground">Mensagens</h1>
            <p className="text-sm text-muted-foreground">
              {chatRooms.length} conversa{chatRooms.length !== 1 ? "s" : ""}
            </p>
          </div>

          <ScrollArea className="flex-1">
            {chatRooms.length > 0 ? (
              <div className="divide-y divide-border">
                {chatRooms.map((room) => {
                  const otherName = getOtherParticipantName(room)
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleSelectRoom(room)}
                      className={cn(
                        "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50",
                        selectedRoom?.id === room.id && "bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-emerald-600 text-white text-sm">
                          {getInitials(otherName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="truncate font-medium text-foreground">
                            {otherName}
                          </p>
                          {room.lastMessageAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(room.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {room.lastMessage || "Nova conversa"}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-4">
                <Empty
                  icon={MessageSquare}
                  title="Nenhuma conversa"
                  description="Inicie uma negociação pelo feed"
                />
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !showMobileChat && "hidden lg:flex"
        )}
      >
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border p-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-emerald-600 text-white text-sm">
                  {getInitials(getOtherParticipantName(selectedRoom))}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {getOtherParticipantName(selectedRoom)}
                </p>
                {relatedPost && (
                  <p className="text-sm text-muted-foreground">
                    Negociando: {relatedPost.type}
                  </p>
                )}
              </div>
            </div>

            {/* Related Post Info */}
            {relatedPost && (
              <div className="border-b border-border bg-muted/30 p-3">
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Package className="h-8 w-8 text-emerald-600" />
                    <div className="flex-1">
                      <p className="font-medium text-emerald-900">
                        {relatedPost.type}
                      </p>
                      <p className="text-sm text-emerald-700">
                        {relatedPost.quantity} {relatedPost.unit} -{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(relatedPost.price)}
                        /{relatedPost.unit}
                      </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white">
                      {relatedPost.status === "disponivel"
                        ? "Disponível"
                        : relatedPost.status === "negociando"
                        ? "Negociando"
                        : "Vendido"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length > 0 ? (
                  messages.map((message) => {
                    const isOwn = message.senderId === user?.id
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2",
                            isOwn
                              ? "bg-emerald-600 text-white"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-right text-xs",
                              isOwn ? "text-emerald-100" : "text-muted-foreground"
                            )}
                          >
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex h-full items-center justify-center py-20">
                    <div className="text-center text-muted-foreground">
                      <MessageSquare className="mx-auto h-12 w-12 opacity-50" />
                      <p className="mt-2">Inicie a conversa</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t border-border p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-4 text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm">
                Ou inicie uma negociação pelo feed de resíduos
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
