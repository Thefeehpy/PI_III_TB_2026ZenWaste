import type { InventoryItem, InventoryMovement, SellerWasteItem, WasteItem } from "@/data/mockData";

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

function readApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as Record<string, unknown>;
  const directMessage = record.message || record.detail || record.error;

  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  const firstFieldError = Object.values(record).find((value) => {
    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim());
  });

  if (typeof firstFieldError === "string") {
    return firstFieldError;
  }

  if (Array.isArray(firstFieldError)) {
    const firstMessage = firstFieldError.find((item) => typeof item === "string" && item.trim());
    if (typeof firstMessage === "string") {
      return firstMessage;
    }
  }

  return fallback;
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
  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new ApiError(readApiErrorMessage(data, "A requisicao nao pode ser concluida."), response.status);
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

  async createInventoryItem(input: {
    name: string;
    type: string;
    quantity: number;
    unit: string;
    targetQuantity?: number;
    deadline?: string;
  }) {
    return request<{ item: InventoryItem }>("/inventory/items/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateInventoryItem(
    itemId: string,
    input: Partial<Pick<InventoryItem, "name" | "type" | "unit" | "targetQuantity" | "deadline">>,
  ) {
    return request<{ item: InventoryItem }>(`/inventory/items/${itemId}/`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async deleteInventoryItem(itemId: string) {
    return request<{ message: string; closedAds: number }>(`/inventory/items/${itemId}/`, {
      method: "DELETE",
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

  async listSellerMarketplaceItems() {
    return request<{ items: SellerWasteItem[] }>("/marketplace/ads/mine/");
  },

  async deleteMarketplaceItem(adId: string) {
    return request<void>(`/marketplace/ads/${adId}/`, {
      method: "DELETE",
    });
  },

  async finalizeMarketplaceItem(adId: string, soldQuantity: number) {
    return request<{
      ad: SellerWasteItem;
      item: InventoryItem;
      movement: InventoryMovement;
    }>(`/marketplace/ads/${adId}/finalize/`, {
      method: "POST",
      body: JSON.stringify({ soldQuantity }),
    });
  },

  async getMarketPrices() {
    return request<{
      priceHistory: Array<Record<string, number | string>>;
      materials: Array<{ key: string; name: string; color: string; current: number; change: number }>;
      insight: string;
    }>("/market/prices/");
  },

  async getSuggestedPrice(input: string | {
    name?: string;
    type: string;
    quantity?: number;
    unit?: string;
    location?: string;
  }) {
    const payload = typeof input === "string" ? { type: input } : input;

    return request<{ suggestedPrice: number; insight: string; source: "ai" | "fallback"; aiAvailable: boolean }>(
      "/market/suggest-price/",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async getSuggestedDescription(input: {
    name: string;
    type: string;
    quantity?: number;
    unit?: string;
    location?: string;
  }) {
    return request<{ description: string; source: "ai" | "fallback"; aiAvailable: boolean }>(
      "/market/suggest-description/",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
