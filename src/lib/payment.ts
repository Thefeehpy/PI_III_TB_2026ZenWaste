import { validateCNPJ } from "@/utils/cnpj";
import type { BuyerDetails, OrderStatus, PaymentMethod } from "@/types/payment";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export const formatMoney = (cents: number) => brl.format(cents / 100);
export const formatQuantity = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const formatDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
export const calculateTotal = (price: number, quantity: number) =>
  Math.round(Math.round(price * 100) * quantity);
export const methodLabels: Record<PaymentMethod, string> = {
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  pix: "Pix",
};
export const statusLabels: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando confirmação",
  paid: "Pagamento aprovado",
  failed: "Pagamento não aprovado",
  canceled: "Pedido cancelado",
  expired: "Pix expirado",
};

export function formatDocument(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits.length <= 11
    ? digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    : digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/\.(\d{3})(\d)/, ".$1.$2")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

export function validDocument(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) return validateCNPJ(digits);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  for (let length = 9; length <= 10; length++) {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[length])) return false;
  }
  return true;
}

export function validateBuyer(
  buyer: BuyerDetails,
): Partial<Record<keyof BuyerDetails, string>> {
  return {
    ...(!buyer.name.trim() || buyer.name.trim().length < 3
      ? { name: "Informe o nome completo ou a razão social." }
      : {}),
    ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())
      ? { email: "Informe um e-mail válido." }
      : {}),
    ...(!validDocument(buyer.document)
      ? { document: "Informe um CPF ou CNPJ válido." }
      : {}),
    ...(!/^\d{10,11}$/.test(buyer.phone.replace(/\D/g, ""))
      ? { phone: "Informe o telefone com DDD." }
      : {}),
  };
}

export interface CardDraft {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}
export function cardBrand(number: string) {
  const digits = number.replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  return "Cartão";
}

export function validateCard(
  card: CardDraft,
  now = new Date(),
): Partial<Record<keyof CardDraft, string>> {
  const digits = card.number.replace(/\D/g, "");
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  const [month, year] = card.expiry.split("/").map(Number);
  const expiryValid =
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    month >= 1 &&
    month <= 12 &&
    new Date(2000 + year, month, 1).getTime() > now.getTime();
  return {
    ...(digits.length < 13 ||
    digits.length > 19 ||
    /^0+$/.test(digits) ||
    sum % 10 !== 0
      ? { number: "Confira o número do cartão." }
      : {}),
    ...(card.holder.trim().length < 3
      ? { holder: "Informe o nome impresso no cartão." }
      : {}),
    ...(!expiryValid ? { expiry: "Informe uma validade futura (MM/AA)." } : {}),
    ...(!(cardBrand(digits) === "Amex" ? /^\d{4}$/ : /^\d{3}$/).test(card.cvv)
      ? { cvv: "Confira o código de segurança." }
      : {}),
  };
}

export const isFinalStatus = (status: OrderStatus) =>
  status === "paid" || status === "canceled";
