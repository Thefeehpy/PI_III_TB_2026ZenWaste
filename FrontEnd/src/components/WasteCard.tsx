import { MapPin, Building2, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WasteItem } from "@/data/mockData";

interface WasteCardProps {
  item: WasteItem;
}

export function WasteCard({ item }: WasteCardProps) {
  const whatsappMessage = encodeURIComponent(
    `Olá! Vi o anúncio "${item.name}" na ZenWaste e tenho interesse. Podemos negociar?`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow animate-fade-in group">
      <div className="aspect-video overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground leading-tight">{item.name}</h3>
          <Badge variant="secondary" className="shrink-0 text-xs bg-accent text-accent-foreground">
            {item.type}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {item.location}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {item.company}
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Quantidade</p>
            <p className="font-semibold text-foreground">
              {item.quantity.toLocaleString("pt-BR")} {item.unit}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Preço / {item.unit}</p>
            <p className="font-bold text-primary text-lg">
              R$ {item.price.toFixed(2).replace(".", ",")}
            </p>
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
