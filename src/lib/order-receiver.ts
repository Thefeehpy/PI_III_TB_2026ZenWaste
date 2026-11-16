import { validDocument } from "@/lib/payment";

export interface DeliveryOrderSummary {
  client: string;
  material: string;
  destination: string;
  volume: string;
}

export interface OrderReceiver {
  name: string;
  cpf: string;
  summary?: DeliveryOrderSummary;
}

export const RECEIVER_STORAGE_PREFIX = "zenwaste.order-receiver.v1.";
export const RECEIVER_CHANGE_EVENT = "zenwaste:order-receiver-changed";

export function normalizeReceiverName(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase();
}

export function validateReceiver(receiver: Pick<OrderReceiver, "name" | "cpf">) {
  const errors: Partial<Record<"name" | "cpf", string>> = {};
  if (receiver.name.trim().split(/\s+/).length < 2) {
    errors.name = "Informe o nome completo do recebedor.";
  }
  const digits = receiver.cpf.replace(/\D/g, "");
  if (digits.length !== 11 || !validDocument(digits)) {
    errors.cpf = "Informe um CPF válido.";
  }
  return errors;
}

export function readReceiverSnapshot(orderNumber: string) {
  try {
    return localStorage.getItem(`${RECEIVER_STORAGE_PREFIX}${encodeURIComponent(orderNumber)}`);
  } catch {
    return null;
  }
}

export function parseReceiverSnapshot(raw: string | null): OrderReceiver | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const receiver = value as Record<string, unknown>;
    if (typeof receiver.name !== "string" || typeof receiver.cpf !== "string") return null;
    if (Object.keys(validateReceiver({ name: receiver.name, cpf: receiver.cpf })).length) return null;
    const summary = receiver.summary as DeliveryOrderSummary | undefined;
    const hasSummary = summary && [summary.client, summary.material, summary.destination, summary.volume]
      .every((field) => typeof field === "string");
    return {
      name: receiver.name,
      cpf: receiver.cpf.replace(/\D/g, ""),
      ...(hasSummary ? { summary } : {}),
    };
  } catch {
    return null;
  }
}

export function getOrderReceiver(orderNumber: string) {
  return parseReceiverSnapshot(readReceiverSnapshot(orderNumber));
}

/** Frontend demonstration: shared only by tabs on this browser and origin. */
export function saveOrderReceiver(orderNumber: string, receiver: OrderReceiver) {
  const normalized: OrderReceiver = {
    ...receiver,
    name: receiver.name.trim().replace(/\s+/g, " "),
    cpf: receiver.cpf.replace(/\D/g, ""),
  };
  if (!orderNumber || Object.keys(validateReceiver(normalized)).length) {
    throw new Error("Confira o nome completo e o CPF do recebedor.");
  }
  try {
    localStorage.setItem(
      `${RECEIVER_STORAGE_PREFIX}${encodeURIComponent(orderNumber)}`,
      JSON.stringify(normalized),
    );
  } catch {
    throw new Error("Não foi possível salvar o recebedor. Verifique se o navegador permite salvar dados e tente novamente.");
  }
  window.dispatchEvent(new Event(RECEIVER_CHANGE_EVENT));
}

export function receiverMatches(receiver: OrderReceiver, name: string, cpf: string) {
  return normalizeReceiverName(name) === normalizeReceiverName(receiver.name)
    && cpf.replace(/\D/g, "") === receiver.cpf.replace(/\D/g, "");
}

export function maskReceiverCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

export function getDeliveryToken(orderNumber: string) {
  if (orderNumber === "5842") return "canhoto-5842-rota-segura";
  if (orderNumber === "5846") return "canhoto-5846-coleta-verde";
  return `canhoto-${orderNumber}-preview`;
}

export function getDeliverySignaturePath(orderNumber: string) {
  return `/delivery-signature/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(getDeliveryToken(orderNumber))}`;
}
