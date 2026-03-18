export interface Company {
  id: string
  name: string
  cnpj: string
  email: string
  password: string
  phone: string
  address: string
  city: string
  state: string
  sector: string
  description: string
  avatar?: string
  createdAt: string
}

export interface ResiduePost {
  id: string
  companyId: string
  companyName: string
  companyAvatar?: string
  type: string
  quantity: number
  unit: 'kg' | 'ton' | 'litros' | 'unidades'
  price: number
  description: string
  location: string
  images: string[]
  createdAt: string
  status: 'disponivel' | 'negociando' | 'vendido'
}

export interface StockItem {
  id: string
  companyId: string
  type: string
  quantity: number
  unit: 'kg' | 'ton' | 'litros' | 'unidades'
  description: string
  targetQuantity?: number
  targetDeadline?: string
  weeklyUpdates: {
    date: string
    quantity: number
  }[]
  createdAt: string
}

export interface MaterialPrice {
  id: string
  name: string
  category: string
  currentPrice: number
  previousPrice: number
  unit: string
  change: number
  changePercent: number
  history: {
    date: string
    price: number
  }[]
}

export interface ChatRoom {
  id: string
  participants: string[]
  participantNames: string[]
  lastMessage?: string
  lastMessageAt?: string
  relatedPostId?: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
}
