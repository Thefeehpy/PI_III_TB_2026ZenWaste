import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { locations, wasteTypes } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Filters {
  type: string;
  location: string;
  minPrice: string;
  maxPrice: string;
}

interface FilterSidebarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
}

export const emptyFilters: Filters = { type: "", location: "", minPrice: "", maxPrice: "" };

export function FilterSidebar({ filters, onChange, onClear }: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-auto p-1 text-muted-foreground">
          <X className="mr-1 h-3.5 w-3.5" /> Limpar
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Tipo de Material</Label>
        <Select value={filters.type} onValueChange={(value) => onChange({ ...filters, type: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {wasteTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Localizacao</Label>
        <Select value={filters.location} onValueChange={(value) => onChange({ ...filters, location: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Faixa de Preco (R$/un)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
          />
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        className="mb-4 w-full sm:w-auto lg:hidden"
        onClick={() => setMobileOpen((current) => !current)}
      >
        <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros
      </Button>

      {mobileOpen && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden">{content}</div>
      )}

      <div className="hidden h-fit w-64 shrink-0 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-20 lg:block">
        {content}
      </div>
    </>
  );
}
