import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { wasteTypes, locations } from "@/data/mockData";
import { SlidersHorizontal, X } from "lucide-react";

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
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground h-auto p-1">
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Tipo de Material</Label>
        <Select value={filters.type} onValueChange={(v) => onChange({ ...filters, type: v })}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {wasteTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Localização</Label>
        <Select value={filters.location} onValueChange={(v) => onChange({ ...filters, location: v })}>
          <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Faixa de Preço (R$/{"{"}un{"}"})</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="0" placeholder="Mín" value={filters.minPrice} onChange={(e) => onChange({ ...filters, minPrice: e.target.value })} />
          <Input type="number" min="0" placeholder="Máx" value={filters.maxPrice} onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button variant="outline" className="lg:hidden mb-4" onClick={() => setMobileOpen(!mobileOpen)}>
        <SlidersHorizontal className="h-4 w-4 mr-2" /> Filtros
      </Button>
      {mobileOpen && (
        <div className="lg:hidden p-4 mb-4 rounded-lg border border-border bg-card">{content}</div>
      )}
      <div className="hidden lg:block w-64 shrink-0 p-4 rounded-lg border border-border bg-card h-fit sticky top-4">
        {content}
      </div>
    </>
  );
}
