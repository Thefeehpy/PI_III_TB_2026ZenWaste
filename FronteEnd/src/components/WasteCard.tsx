import { Building2, MapPin, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WasteItem } from "@/data/mockData";

interface WasteCardProps {
  item: WasteItem;
}

export function WasteCard({ item }: WasteCardProps) {
  const whatsappMessage = encodeURIComponent(
    `Ola! Vi o anuncio "${item.name}" na ZenWaste e tenho interesse. Podemos negociar?`,
  );
  const whatsappUrl = item.whatsappUrl || `https://wa.me/?text=${whatsappMessage}`;

  return (
    <Card className="group animate-fade-in overflow-hidden transition-shadow hover:shadow-lg">
      <div className="aspect-video overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="leading-tight font-semibold text-foreground">{item.name}</h3>
          <Badge variant="secondary" className="shrink-0 bg-accent text-xs text-accent-foreground">
            {item.type}
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {item.location}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {item.company}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Quantidade</p>
            <p className="font-semibold text-foreground">
              {item.quantity.toLocaleString("pt-BR")} {item.unit}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Preco / {item.unit}</p>
            <p className="text-lg font-bold text-primary">R$ {item.price.toFixed(2).replace(".", ",")}</p>
          </div>
        </div>
        <Button asChild className="w-full gap-2">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Contatar Vendedor
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
