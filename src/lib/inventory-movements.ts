import type { InventoryMovement } from "@/data/mockData";
import { formatInventoryDate } from "@/lib/inventory";

export interface MovementFilters {
  search: string;
  itemId: string;
  type: "all" | InventoryMovement["type"];
  from: string;
  to: string;
  sort: "newest" | "oldest";
}

export const emptyMovementFilters: MovementFilters = {
  search: "",
  itemId: "all",
  type: "all",
  from: "",
  to: "",
  sort: "newest",
};
export type MovementPeriod = "all" | "today" | "week" | "month" | "this_month";

function localDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function movementPeriodRange(period: MovementPeriod, now = new Date()) {
  if (period === "all") return { from: "", to: "" };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(start.getDate() - 29);
  if (period === "this_month") start.setDate(1);
  return { from: localDate(start), to: localDate(now) };
}

function dateBoundary(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value
    ? date
    : null;
}

export function movementRangeError(from: string, to: string) {
  if ((from && !dateBoundary(from)) || (to && !dateBoundary(to)))
    return "Informe datas válidas para o período.";
  if (from && to && from > to)
    return "A data inicial deve ser anterior ou igual à data final.";
  return "";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function filterInventoryMovements(
  movements: InventoryMovement[],
  filters: MovementFilters,
) {
  if (movementRangeError(filters.from, filters.to)) return [];
  const start = filters.from
    ? dateBoundary(filters.from)!.getTime()
    : -Infinity;
  const endDate = filters.to ? dateBoundary(filters.to)! : null;
  // End at the next local midnight: the selected last day is included, even across DST changes.
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate ? endDate.getTime() : Infinity;
  const terms = normalize(filters.search.trim()).split(/\s+/).filter(Boolean);

  return movements
    .filter((movement) => {
      if (filters.itemId !== "all" && movement.itemId !== filters.itemId)
        return false;
      if (filters.type !== "all" && movement.type !== filters.type)
        return false;
      const timestamp = Date.parse(movement.createdAt);
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= end)
        return false;
      const searchable = normalize(
        `${movement.itemName} ${movement.itemType} ${movement.note ?? ""}`,
      );
      return terms.every((term) => searchable.includes(term));
    })
    .sort((a, b) =>
      filters.sort === "newest"
        ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
}

function csvCell(value: string | number) {
  let text = String(value);
  // Notes and material names may be supplied by users. Keep spreadsheet formulas inert.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function inventoryMovementsCsv(movements: InventoryMovement[]) {
  const number = (value: number) =>
    value.toLocaleString("pt-BR", {
      useGrouping: false,
      maximumFractionDigits: 3,
    });
  const rows: Array<Array<string | number>> = [
    [
      "Data e hora",
      "Material",
      "Categoria",
      "Operação",
      "Quantidade",
      "Unidade",
      "Saldo após operação",
      "Observação",
    ],
  ];
  movements.forEach((movement) =>
    rows.push([
      formatInventoryDate(movement.createdAt),
      movement.itemName,
      movement.itemType,
      movement.type === "entrada" ? "Entrada" : "Saída",
      number(movement.quantity),
      movement.unit,
      number(movement.resultingQuantity),
      movement.note ?? "",
    ]),
  );
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
