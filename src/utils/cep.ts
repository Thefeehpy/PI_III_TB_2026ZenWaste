export function normalizarCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatarCep(value: string) {
  const digits = normalizarCep(value);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

