/** Estimativa local de demonstração; não representa uma cotação contratada. */
export function sugerirVeiculoDemonstrativo(materialType: string) {
  const normalizedType = materialType.toLowerCase();

  if (normalizedType.includes("vidro")) {
    return "Truck reforçado com contenção";
  }

  if (normalizedType.includes("metal") || normalizedType.includes("sucata")) {
    return "Truck ou carreta curta";
  }

  if (normalizedType.includes("plast")) {
    return "Baú médio ou sider";
  }

  return "Baú médio";
}

export function estimarFreteDemonstrativo(materialType: string, quantity: string, unit: string) {
  const normalizedType = materialType.toLowerCase();
  const numericQuantity = Number(quantity) || 0;
  const quantityInTon = unit.toLowerCase().includes("ton") ? numericQuantity : numericQuantity / 1000;
  const materialFactor =
    normalizedType.includes("vidro") || normalizedType.includes("metal")
      ? 7.2
      : normalizedType.includes("plast")
        ? 5.4
        : 4.8;
  const estimatedDistanceKm = 80;
  const estimate = estimatedDistanceKm * materialFactor + quantityInTon * 45;

  return Math.max(220, Math.round(estimate / 10) * 10).toFixed(2);
}

