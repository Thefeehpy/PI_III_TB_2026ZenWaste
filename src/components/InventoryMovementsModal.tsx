import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import type { InventoryMovement } from "@/data/mockData";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";
import {
  emptyMovementFilters,
  filterInventoryMovements,
  inventoryMovementsCsv,
  movementPeriodRange,
  movementRangeError,
  type MovementFilters,
  type MovementPeriod,
} from "@/lib/inventory-movements";
import { cn } from "@/lib/utils";

const periods: Array<{ id: MovementPeriod; label: string }> = [
  { id: "all", label: "Todo o período" },
  { id: "today", label: "Hoje" },
  { id: "week", label: "7 dias" },
  { id: "month", label: "30 dias" },
  { id: "this_month", label: "Este mês" },
];
const pageSize = 10;

export function InventoryMovementsModal({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { movements, items, isLoading } = useInventory();
  const [filters, setFilters] = useState<MovementFilters>(emptyMovementFilters);
  const [period, setPeriod] = useState<MovementPeriod | "custom">("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState<number>();
  useEffect(() => {
    if (open) {
      setFilters(emptyMovementFilters);
      setPeriod("all");
      setPage(1);
      setExpanded(false);
    }
  }, [open]);

  const update = (patch: Partial<MovementFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const reset = () => {
    setFilters(emptyMovementFilters);
    setPeriod("all");
    setPage(1);
  };
  const selectPeriod = (value: MovementPeriod) => {
    setPeriod(value);
    update(movementPeriodRange(value));
  };
  const rangeError = movementRangeError(filters.from, filters.to);
  const hasFilters = !!(
    filters.search.trim() ||
    filters.itemId !== "all" ||
    filters.type !== "all" ||
    filters.from ||
    filters.to
  );
  const filterCount =
    Number(!!filters.search.trim()) +
    Number(filters.itemId !== "all") +
    Number(filters.type !== "all") +
    Number(!!(filters.from || filters.to));
  const filtered = useMemo(
    () => filterInventoryMovements(movements, filters),
    [movements, filters],
  );
  const entries = filtered.filter(
    (movement) => movement.type === "entrada",
  ).length;
  const exits = filtered.length - entries;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const visible = useMemo(
    () => filtered.slice(offset, offset + pageSize),
    [filtered, offset],
  );

  useLayoutEffect(() => {
    if (!listElement) return;

    const rows = Array.from(
      listElement.querySelectorAll<HTMLElement>("tbody > tr, ol > li"),
    );
    const header = listElement.querySelector("thead");
    const measure = () => {
      const firstRows = rows.filter((row) => row.offsetHeight > 0).slice(0, 3);
      setListHeight(
        firstRows.length
          ? (header?.offsetHeight ?? 0) +
              firstRows.reduce((height, row) => height + row.offsetHeight, 0)
          : undefined,
      );
    };

    listElement.scrollTop = 0;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(listElement);
    if (header) observer.observe(header);
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [listElement, visible, isLoading]);

  const options = useMemo(() => {
    const names = new Map(
      movements.map((movement) => [movement.itemId, movement.itemName]),
    );
    items.forEach((item) => names.set(item.id, item.name));
    return [...names.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR"),
    );
  }, [items, movements]);

  const exportCsv = () => {
    if (!filtered.length || rangeError) return;
    const url = URL.createObjectURL(
      new Blob([inventoryMovementsCsv(filtered)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimentacoes-estoque-${movementPeriodRange("today").to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const operationFilters = (
    <div
      role="group"
      aria-label="Tipo de movimentação"
      className="inline-flex shrink-0 rounded-xl border border-border/60 bg-muted/40 p-0.5"
    >
      {(
        [
          { value: "all", label: "Todas" },
          { value: "entrada", label: "Entradas" },
          { value: "saida", label: "Saídas" },
        ] as const
      ).map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={filters.type === value}
          onClick={() => update({ type: value })}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            filters.type === value
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="inventory-movements-dialog"
        data-testid="inventory-movements-modal"
        closeLabel="Fechar movimentações"
        onCloseAutoFocus={onCloseAutoFocus}
        overlayClassName="bg-black/65 backdrop-blur-sm"
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-[28px] border-border/70 p-0 shadow-2xl sm:rounded-[28px]"
      >
        <DialogHeader className="relative shrink-0 border-b border-border/60 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.12),transparent_70%)] px-5 py-3 text-left sm:px-7">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                  Movimentações do estoque
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  O histórico completo de entradas e saídas, em um só lugar.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="hidden shrink-0 rounded-xl bg-card/80 sm:inline-flex"
              disabled={!filtered.length || !!rangeError || isLoading}
              onClick={exportCsv}
              title="Exportar todos os registros filtrados"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </DialogHeader>

        <section
          aria-label="Filtros de movimentações"
          className="grid shrink-0 grid-cols-1 items-end gap-x-3 gap-y-2 border-b border-border/60 px-5 py-3 sm:px-7 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)]"
        >
          <div className="flex items-center gap-3 md:contents">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar movimentações"
                value={filters.search}
                onChange={(event) => update({ search: event.target.value })}
                placeholder="Buscar material ou observação…"
                className="h-10 rounded-xl bg-background pl-10 pr-10"
              />
              {filters.search ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => update({ search: "" })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-2 rounded-xl md:hidden"
              aria-expanded={expanded}
              aria-controls="movement-advanced-filters"
              onClick={() => setExpanded((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {filterCount ? (
                <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                  {filterCount}
                </span>
              ) : null}
            </Button>
          </div>
          <div
            id="movement-advanced-filters"
            className={cn(
              "mt-2 max-h-[38dvh] overflow-y-auto md:contents",
              !expanded && "hidden",
            )}
          >
            <div className="mb-3 md:hidden">{operationFilters}</div>
            <div className="grid grid-cols-2 gap-3 md:contents">
              <div className="col-span-2 space-y-1.5 md:col-span-1">
                <Label
                  htmlFor="movement-material-filter"
                  className="text-xs text-muted-foreground"
                >
                  Material
                </Label>
                <Select
                  value={filters.itemId}
                  onValueChange={(value) => update({ itemId: value })}
                >
                  <SelectTrigger
                    id="movement-material-filter"
                    className="h-9 rounded-xl"
                  >
                    <SelectValue placeholder="Todos os materiais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os materiais</SelectItem>
                    {options.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="movement-from-date"
                  className="text-xs text-muted-foreground"
                >
                  Data inicial
                </Label>
                <Input
                  id="movement-from-date"
                  type="date"
                  value={filters.from}
                  onChange={(event) => {
                    setPeriod("custom");
                    update({ from: event.target.value });
                  }}
                  className="h-9 min-w-0 rounded-xl px-2 text-xs sm:px-3"
                  aria-invalid={!!rangeError}
                  aria-describedby={
                    rangeError ? "movement-date-error" : undefined
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="movement-to-date"
                  className="text-xs text-muted-foreground"
                >
                  Data final
                </Label>
                <Input
                  id="movement-to-date"
                  type="date"
                  value={filters.to}
                  onChange={(event) => {
                    setPeriod("custom");
                    update({ to: event.target.value });
                  }}
                  className="h-9 min-w-0 rounded-xl px-2 text-xs sm:px-3"
                  aria-invalid={!!rangeError}
                  aria-describedby={
                    rangeError ? "movement-date-error" : undefined
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 md:col-span-4 md:mt-0">
              <div className="mr-2 hidden md:block">{operationFilters}</div>
              <CalendarDays className="mr-1 hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              {periods.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPeriod(id)}
                  aria-pressed={period === id}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    period === id
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="ml-auto h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </div>
          {rangeError ? (
            <p
              id="movement-date-error"
              role="alert"
              className="mt-3 text-xs text-destructive"
            >
              {rangeError}
            </p>
          ) : null}
        </section>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/15 px-5 py-1.5 sm:px-7">
          <p role="status" className="text-xs text-muted-foreground">
            <strong
              className="font-semibold text-foreground"
              data-testid="movement-result-count"
            >
              {filtered.length}
            </strong>{" "}
            de {movements.length} registros
            <span className="ml-3 hidden gap-3 sm:inline-flex">
              <span className="text-primary">{entries} entradas</span>
              <span className="text-destructive">{exits} saídas</span>
            </span>
          </p>
          <select
            aria-label="Ordenar movimentações"
            value={filters.sort}
            onChange={(event) =>
              update({ sort: event.target.value as MovementFilters["sort"] })
            }
            className="max-w-[10rem] cursor-pointer rounded-lg border-0 bg-transparent py-1 text-xs font-medium text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </div>

        <div
          ref={setListElement}
          data-testid="movement-scroll-area"
          className="min-h-0 overflow-auto overscroll-contain"
          style={{ maxHeight: listHeight }}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div
              role="status"
              className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Carregando movimentações…
            </div>
          ) : !filtered.length ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
              <span className="mb-4 rounded-2xl bg-primary/10 p-4">
                <History className="h-7 w-7 text-primary" />
              </span>
              <h3 className="text-base font-semibold">
                {rangeError
                  ? "Revise o período selecionado"
                  : movements.length
                    ? "Nenhuma movimentação encontrada"
                    : "Seu histórico começa aqui"}
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {rangeError
                  ? "Ajuste as datas para consultar as movimentações."
                  : movements.length
                    ? "Tente outro material, período ou termo de busca."
                    : "As entradas e saídas aparecerão aqui assim que forem registradas."}
              </p>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 rounded-xl"
                  onClick={reset}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <table className="hidden w-full min-w-[800px] table-fixed border-collapse text-sm md:table">
                <caption className="sr-only">
                  Movimentações filtradas do estoque
                </caption>
                <colgroup>
                  <col className="w-[21%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[17%]" />
                  <col className="w-[23%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                  <tr>
                    {[
                      "Material",
                      "Operação",
                      "Quantidade",
                      "Saldo após",
                      "Data e hora",
                      "Observação",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={cn(
                          "px-4 py-2 text-left text-[11px] font-medium leading-4 text-muted-foreground",
                          (heading === "Quantidade" ||
                            heading === "Saldo após") &&
                            "text-right",
                          heading === "Material" && "pl-7",
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {visible.map((movement) => (
                    <tr
                      key={movement.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="py-1.5 pl-7 pr-3">
                        <p className="break-words text-sm font-semibold">
                          {movement.itemName}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground"
                          title={movement.itemType}
                        >
                          {movement.itemType}
                        </p>
                      </td>
                      <td className="px-3 py-1.5">
                        <MovementType type={movement.type} />
                      </td>
                      <td
                        className={cn(
                          "break-words px-4 py-1.5 text-right text-xs font-semibold tabular-nums",
                          movement.type === "entrada"
                            ? "text-primary"
                            : "text-destructive",
                        )}
                      >
                        {movement.type === "entrada" ? "+" : "−"}
                        {formatInventoryQuantity(
                          movement.quantity,
                          movement.unit,
                        )}
                      </td>
                      <td className="break-words px-4 py-1.5 text-right text-xs tabular-nums">
                        {formatInventoryQuantity(
                          movement.resultingQuantity,
                          movement.unit,
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-[11px] text-muted-foreground">
                        {formatInventoryDate(movement.createdAt)}
                      </td>
                      <td className="py-1.5 pl-4 pr-7">
                        <p
                          className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground"
                          title={movement.note}
                        >
                          {movement.note || "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ol
                className="divide-y divide-border/60 px-5 md:hidden"
                aria-label="Lista de movimentações"
              >
                {visible.map((movement) => (
                  <li key={movement.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">
                          {movement.itemName}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatInventoryDate(movement.createdAt)}
                        </p>
                      </div>
                      <MovementType type={movement.type} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <strong
                        className={cn(
                          "font-semibold",
                          movement.type === "entrada"
                            ? "text-primary"
                            : "text-destructive",
                        )}
                      >
                        {movement.type === "entrada" ? "+" : "−"}
                        {formatInventoryQuantity(
                          movement.quantity,
                          movement.unit,
                        )}
                      </strong>
                      <span className="text-muted-foreground">
                        Saldo:{" "}
                        {formatInventoryQuantity(
                          movement.resultingQuantity,
                          movement.unit,
                        )}
                      </span>
                    </div>
                    {movement.note ? (
                      <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
                        {movement.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-2 sm:px-7">
          <div className="text-[11px] text-muted-foreground">
            {filtered.length ? (
              <span>
                {offset + 1}–{Math.min(offset + pageSize, filtered.length)} de{" "}
                {filtered.length} movimentações
              </span>
            ) : (
              "Nenhum registro para exibir"
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filtered.length || !!rangeError || isLoading}
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-40 sm:hidden"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          </div>
          <nav
            aria-label="Páginas de movimentações"
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl bg-card"
              disabled={currentPage === 1 || isLoading}
              aria-label="Página anterior"
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl bg-card"
              disabled={currentPage === totalPages || isLoading}
              aria-label="Próxima página"
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function MovementType({ type }: { type: InventoryMovement["type"] }) {
  const entry = type === "entrada";
  const Icon = entry ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium",
        entry
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="h-3 w-3" />
      {entry ? "Entrada" : "Saída"}
    </span>
  );
}
