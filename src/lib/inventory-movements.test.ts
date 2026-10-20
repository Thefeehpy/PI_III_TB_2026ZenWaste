import { describe, expect, it } from "vitest";
import type { InventoryMovement } from "@/data/mockData";
import {
  emptyMovementFilters,
  filterInventoryMovements,
  inventoryMovementsCsv,
  movementPeriodRange,
  movementRangeError,
} from "@/lib/inventory-movements";

const movement = (
  id: string,
  date: Date,
  patch: Partial<InventoryMovement> = {},
): InventoryMovement => ({
  id,
  itemId: "paper",
  itemName: "Papelão",
  itemType: "Papel e Papelão",
  type: "entrada",
  quantity: 20,
  unit: "kg",
  note: "Lote recebido",
  createdAt: date.toISOString(),
  resultingQuantity: 100,
  ...patch,
});

describe("inventory movement exploration", () => {
  it("includes both local boundary days and excludes the next midnight", () => {
    const records = [
      movement("before", new Date(2026, 9, 18, 23, 59, 59)),
      movement("start", new Date(2026, 9, 19, 0)),
      movement("end", new Date(2026, 9, 19, 23, 59, 59)),
      movement("after", new Date(2026, 9, 20, 0)),
    ];
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        from: "2026-10-19",
        to: "2026-10-19",
      }).map((record) => record.id),
    ).toEqual(["end", "start"]);
  });

  it("supports open ranges and rejects reversed or impossible dates", () => {
    const records = [
      movement("before", new Date(2026, 9, 18)),
      movement("after", new Date(2026, 9, 20)),
    ];
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        from: "2026-10-19",
      }).map((record) => record.id),
    ).toEqual(["after"]);
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        to: "2026-10-19",
      }).map((record) => record.id),
    ).toEqual(["before"]);
    expect(movementRangeError("2026-10-20", "2026-10-19")).toBeTruthy();
    expect(movementRangeError("2026-02-30", "")).toBeTruthy();
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        from: "2026-10-20",
        to: "2026-10-19",
      }),
    ).toEqual([]);
  });

  it("combines accent-insensitive search, operation and material without mutating the history", () => {
    const records = [
      movement("a", new Date(2026, 9, 18)),
      movement("b", new Date(2026, 9, 19), {
        type: "saida",
        note: "Separação do lote",
      }),
      movement("c", new Date(2026, 9, 20), {
        itemId: "glass",
        itemName: "Vidro",
      }),
    ];
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        search: "papelao separacao",
        itemId: "paper",
        type: "saida",
      }).map((record) => record.id),
    ).toEqual(["b"]);
    expect(
      filterInventoryMovements(records, {
        ...emptyMovementFilters,
        sort: "oldest",
      }).map((record) => record.id),
    ).toEqual(["a", "b", "c"]);
    expect(records.map((record) => record.id)).toEqual(["a", "b", "c"]);
  });

  it("calculates inclusive quick periods across month and year boundaries", () => {
    const now = new Date(2026, 0, 3, 23);
    expect(movementPeriodRange("week", now)).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
    expect(movementPeriodRange("month", now)).toEqual({
      from: "2025-12-05",
      to: "2026-01-03",
    });
    expect(movementPeriodRange("this_month", now)).toEqual({
      from: "2026-01-01",
      to: "2026-01-03",
    });
    expect(movementPeriodRange("all", now)).toEqual({ from: "", to: "" });
  });

  it("exports every supplied row with UTF-8, quoted notes, individual units and inert formulas", () => {
    const csv = inventoryMovementsCsv([
      movement("a", new Date(2026, 9, 19), {
        note: '=SUM(1;2) "teste"',
        quantity: 0.125,
      }),
      movement("b", new Date(2026, 9, 19), {
        itemName: "Vidro",
        unit: "ton",
        quantity: 2,
      }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=SUM(1;2) ""teste"""');
    expect(csv).toContain('"0,125";"kg"');
    expect(csv).toContain('"2";"ton"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});
