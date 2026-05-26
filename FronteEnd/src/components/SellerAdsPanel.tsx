import { CheckCircle2, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SellerAd } from "@/data/mockData";
import { formatInventoryQuantity } from "@/lib/inventory";

interface SellerAdsPanelProps {
  ads: SellerAd[];
  onFinalize: (ad: SellerAd) => void;
}

export function SellerAdsPanel({ ads, onFinalize }: SellerAdsPanelProps) {
  const activeAds = ads.filter((ad) => ad.status === "ativo");

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Anuncios em andamento</CardTitle>
        <CardDescription>
          Finalize vendas publicadas e, quando houver pedido futuro do comprador, registre uma reserva do mesmo residuo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAds.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Seus anuncios ativos aparecerao aqui para fechamento da venda.
          </div>
        ) : (
          activeAds.map((ad) => (
            <div key={ad.id} className="rounded-md border border-border/70 bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{ad.name}</p>
                  <p className="text-sm text-muted-foreground">{ad.type}</p>
                </div>
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  <PackageCheck className="mr-1 h-3.5 w-3.5" />
                  Ativo
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Anunciado</p>
                  <p className="font-medium text-foreground">{formatInventoryQuantity(ad.quantity, ad.unit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo atual</p>
                  <p className="font-medium text-foreground">
                    {formatInventoryQuantity(ad.availableQuantity, ad.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Preco</p>
                  <p className="font-medium text-foreground">
                    R$ {ad.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {ad.unit}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" className="gap-2" onClick={() => onFinalize(ad)}>
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar venda
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
