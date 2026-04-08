import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WasteCard } from "@/components/WasteCard";
import { FilterSidebar, emptyFilters, type Filters } from "@/components/FilterSidebar";
import { useMarketplace } from "@/contexts/MarketplaceContext";

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const { items } = useMarketplace();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.type.toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.location && filters.location !== "all" && item.location !== filters.location) return false;
      if (filters.minPrice && item.price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && item.price > parseFloat(filters.maxPrice)) return false;
      return true;
    });
  }, [filters, items, search]);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Marketplace de Resíduos</h1>
        <p className="text-muted-foreground">Encontre materiais industriais para reaproveitar na sua cadeia produtiva</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar resíduos por nome ou tipo..."
          className="pl-10 max-w-xl"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-6 items-start">
        <FilterSidebar filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters)} />
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">Nenhum resultado encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou publique um novo anúncio</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((item) => (
                <WasteCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
