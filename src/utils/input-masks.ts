import { formatCNPJ } from "@/utils/cnpj";

export function formatCPF(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits.length <= 11 ? formatCPF(digits) : formatCNPJ(digits);
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length < 2) return `(${digits}`;
  if (digits.length === 2) return `(${digits})`;

  const subscriber = digits.slice(2);
  const prefixLength = subscriber.length > 8 ? 5 : 4;
  const number =
    subscriber.length > prefixLength
      ? `${subscriber.slice(0, prefixLength)}-${subscriber.slice(prefixLength)}`
      : subscriber;
  return `(${digits.slice(0, 2)}) ${number}`;
}

export function formatCarrierDocument(value: string): string {
  // This shared field also accepts a transport registration.
  return /^[\d./\s-]*$/.test(value) && value.replace(/\D/g, "").length > 8
    ? formatCNPJ(value)
    : value;
}
