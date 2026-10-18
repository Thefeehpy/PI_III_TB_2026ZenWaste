import type { WasteItem } from "@/data/mockData";

export type PaymentMethod = "credit" | "debit" | "pix";
export type OrderStatus =
  "awaiting_payment" | "pending" | "paid" | "failed" | "canceled" | "expired";

export interface BuyerDetails {
  name: string;
  email: string;
  document: string;
  phone: string;
}

export interface PixPayment {
  id: string;
  copyPaste: string;
  expiresAt: string;
}

export interface PaymentOrder {
  id: string;
  number: string;
  createdAt: string;
  paidAt?: string;
  item: WasteItem;
  quantity: number;
  /** Monetary amounts are always integer BRL cents. The backend must calculate them again. */
  totalCents: number;
  buyer: BuyerDetails;
  fulfillment: "pickup";
  status: OrderStatus;
  method?: PaymentMethod;
  installments: number;
  card?: { brand: string; last4: string };
  pix?: PixPayment;
}

export interface CreateOrderInput {
  listing: WasteItem;
  quantity: number;
  buyer: BuyerDetails;
  /** Reuse this key when retrying a request after an uncertain response. */
  idempotencyKey: string;
}

export interface CardPaymentInput {
  method: "credit" | "debit";
  token: string;
  brand: string;
  last4: string;
  installments: number;
  idempotencyKey: string;
}

/** Replace the demo implementation with an authenticated HTTP adapter. Never send PAN/CVV here. */
export interface PaymentService {
  mode: "demo" | "live";
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;
  getOrder(id: string): Promise<PaymentOrder>;
  listOrders(): Promise<PaymentOrder[]>;
  payWithCard(id: string, input: CardPaymentInput): Promise<PaymentOrder>;
  createPix(id: string): Promise<PaymentOrder>;
  cancelOrder(id: string): Promise<PaymentOrder>;
  simulateResult?: (
    id: string,
    result: "paid" | "failed",
  ) => Promise<PaymentOrder>;
}
