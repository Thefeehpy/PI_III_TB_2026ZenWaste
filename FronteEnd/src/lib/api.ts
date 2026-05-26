import type { InventoryItem, InventoryMovement, Reservation, ReservationStatus, SellerAd, WasteItem } from "@/data/mockData";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const TOKEN_STORAGE_KEY = "zenwaste.auth-token";

export interface ApiUser {
  id: string;
  razaoSocial: string;
  cnpj: string;
  segmento: string;
  email: string;
  telefone: string;
}

export type RegisterInput = Omit<ApiUser, "id"> & {
  password: string;
};

export interface ApiActionResult {
  success: boolean;
  message?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getStoredAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getStoredAuthToken();

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError("Nao foi possivel conectar ao backend Django.", 0);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ApiError(data.message || "A requisicao nao pode ser concluida.", response.status);
  }

  return data as T;
}

export const api = {
  async register(input: RegisterInput) {
    return request<{ user: ApiUser }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async login(email: string, password: string) {
    return request<{ token: string; user: ApiUser }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async me() {
    return request<{ user: ApiUser }>("/auth/me/");
  },

  async logout() {
    return request<{ message: string }>("/auth/logout/", {
      method: "POST",
    });
  },

  async listInventoryItems() {
    return request<{ items: InventoryItem[] }>("/inventory/items/");
  },

  async createInventoryItem(input: Pick<InventoryItem, "name" | "type" | "quantity" | "unit">) {
    return request<{ item: InventoryItem }>("/inventory/items/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listInventoryMovements() {
    return request<{ movements: InventoryMovement[] }>("/inventory/movements/");
  },

  async adjustInventoryItemQuantity(input: {
    itemId: string;
    quantity: number;
    type: InventoryMovement["type"];
    note?: string;
  }) {
    return request<{ item: InventoryItem; movement: InventoryMovement }>(`/inventory/items/${input.itemId}/movements/`, {
      method: "POST",
      body: JSON.stringify({
        quantity: input.quantity,
        type: input.type,
        note: input.note,
      }),
    });
  },

  async listMarketplaceItems() {
    return request<{ items: WasteItem[] }>("/marketplace/ads/");
  },

  async createMarketplaceItem(input: {
    inventoryId?: string;
    name: string;
    type: string;
    description: string;
    quantity: number;
    unit: string;
    price: number;
    location: string;
    imageUrl?: string;
  }) {
    return request<{ item: WasteItem }>("/marketplace/ads/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listSellerAds() {
    return request<{ items: SellerAd[] }>("/marketplace/ads/mine/");
  },

  async finalizeMarketplaceAd(input: {
    adId: string;
    soldQuantity: number;
    buyerName?: string;
    buyerPhone?: string;
    reservationQuantity?: number;
    reservationUnitPrice?: number;
    reservationNote?: string;
  }) {
    return request<{
      ad: SellerAd;
      item: InventoryItem;
      movement: InventoryMovement;
      reservation?: Reservation;
    }>(`/marketplace/ads/${input.adId}/finalize/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async createReservation(input: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    buyerName: string;
    buyerPhone: string;
    note?: string;
  }) {
    return request<{ reservation: Reservation }>(`/inventory/items/${input.itemId}/reservations/`, {
      method: "POST",
      body: JSON.stringify({
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        note: input.note || "",
      }),
    });
  },

  async listReservations() {
    return request<{ items: Reservation[] }>("/inventory/reservations/");
  },

  async updateReservationStatus(input: { reservationId: string; status: ReservationStatus }) {
    return request<{ reservation: Reservation }>(`/inventory/reservations/${input.reservationId}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: input.status }),
    });
  },

  async getMarketPrices() {
    return request<{
      priceHistory: Array<Record<string, number | string>>;
      materials: Array<{ key: string; name: string; color: string; current: number; change: number }>;
      insight: string;
    }>("/market/prices/");
  },

  async getSuggestedPrice(type: string) {
    const params = new URLSearchParams({ type });
    return request<{ suggestedPrice: number; insight: string }>(`/market/suggest-price/?${params.toString()}`);
  },
};
