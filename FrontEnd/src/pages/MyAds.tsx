import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  Megaphone,
  PackageCheck,
  PowerOff,
  Sparkles,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import { useMarketplace } from "@/contexts/MarketplaceContext";
import type { SellerWasteItem } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const statusMeta: Record<
  SellerWasteItem["status"],
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  ativo: {
    label: "Ativo",
    description: "visível no marketplace",
    badgeClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    dotClassName: "bg-emerald-400",
  },
  vendido: {
    label: "Vendido",
    description: "venda finalizada",
    badgeClassName: "border-primary/20 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
  },
  inativo: {
    label: "Encerrado",
    description: "fora do marketplace",
    badgeClassName: "border-muted-foreground/20 bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getListingValue(listing: SellerWasteItem) {
  const quantity = listing.status === "ativo" ? listing.availableQuantity || listing.quantity : listing.quantity;
  return quantity * listing.price;
}

export default function MyAds() {
  const { refreshInventory } = useInventory();
  const { deactivateItem, finalizeItem, sellerItems } = useMarketplace();
  const { toast } = useToast();

  const sortedListings = useMemo(
    () => [...sellerItems].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sellerItems],
  );

  const statusCounts = useMemo(
    () =>
      sellerItems.reduce(
        (acc, listing) => {
          acc[listing.status] += 1;
          return acc;
        },
        { ativo: 0, inativo: 0, vendido: 0 } satisfies Record<SellerWasteItem["status"], number>,
      ),
    [sellerItems],
  );

  const activePortfolioValue = useMemo(
    () =>
      sellerItems
        .filter((listing) => listing.status === "ativo")
        .reduce((sum, listing) => sum + getListingValue(listing), 0),
    [sellerItems],
  );

  const completedRevenue = useMemo(
    () =>
      sellerItems
        .filter((listing) => listing.status === "vendido")
        .reduce((sum, listing) => sum + getListingValue(listing), 0),
    [sellerItems],
  );

  const handleDeactivateListing = async (listingId: string) => {
    const result = await deactivateItem(listingId);

    toast({
      title: result.success ? "Anúncio encerrado" : "Anúncio não encerrado",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  const handleFinalizeListing = async (listing: SellerWasteItem) => {
    const soldQuantity = listing.availableQuantity || listing.quantity;
    const result = await finalizeItem(listing.id, soldQuantity);

    if (result.success) {
      await refreshInventory();
    }

    toast({
      title: result.success ? "Anúncio finalizado" : "Anúncio não finalizado",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-cyan-100/14 blur-3xl" />

        <CardContent className="relative grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_24rem] xl:items-end">
          <div className="max-w-3xl space-y-5">
            <Badge className="w-fit rounded-full border border-white/16 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
              <Sparkles className="mr-2 h-4 w-4" />
              Gestão comercial
            </Badge>

            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Meus Anúncios</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Acompanhe todos os anúncios realizados pela empresa, seus status, valores publicados e as oportunidades
                que ainda estão ativas no marketplace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-2xl bg-white text-emerald-800 hover:bg-white/90">
                <Link to="/dashboard/create-ad">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Criar novo anúncio
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/12 p-5 backdrop-blur-xl">
            <p className="text-sm text-white/70">Carteira ativa estimada</p>
            <p className="mt-3 text-3xl font-semibold">{formatCurrency(activePortfolioValue)}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{statusCounts.ativo}</p>
                <p className="mt-1 text-xs text-white/62">ativos</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{statusCounts.vendido}</p>
                <p className="mt-1 text-xs text-white/62">vendidos</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{statusCounts.inativo}</p>
                <p className="mt-1 text-xs text-white/62">encerrados</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Anúncios realizados</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{sellerItems.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">histórico completo da empresa</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Megaphone className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Ativos no marketplace</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{statusCounts.ativo}</p>
                <p className="mt-2 text-xs text-muted-foreground">disponíveis para compradores</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor ativo</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(activePortfolioValue)}</p>
                <p className="mt-2 text-xs text-muted-foreground">potencial em anúncios ativos</p>
              </div>
              <div className="rounded-2xl bg-info/10 p-3 text-info">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Receita finalizada</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(completedRevenue)}</p>
                <p className="mt-2 text-xs text-muted-foreground">estimativa dos vendidos</p>
              </div>
              <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                <BadgeDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Histórico de anúncios</CardTitle>
            <CardDescription>
              Consulte status, quantidade anunciada, saldo disponível, preço e localização de cada publicação.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            {sortedListings.length} registros
          </Badge>
        </CardHeader>
        <CardContent>
          {sortedListings.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-muted/20 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Megaphone className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhum anúncio realizado ainda</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Quando a empresa publicar produtos no marketplace, o histórico completo aparecerá aqui.
              </p>
              <Button asChild className="mt-5 rounded-2xl">
                <Link to="/dashboard/create-ad">Criar primeiro anúncio</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sortedListings.map((listing) => {
                const status = statusMeta[listing.status];
                const listingValue = getListingValue(listing);
                const activeQuantity = listing.availableQuantity || listing.quantity;

                return (
                  <article
                    key={listing.id}
                    className="overflow-hidden rounded-[28px] border border-border/70 bg-background/80 shadow-sm transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="grid gap-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
                      <div className="relative min-h-[180px] bg-muted lg:min-h-full">
                        {listing.imageUrl ? (
                          <img src={listing.imageUrl} alt={listing.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full min-h-[180px] items-center justify-center bg-primary/10 text-primary">
                            <Megaphone className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/36 via-transparent to-transparent" />
                      </div>

                      <div className="p-5 md:p-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                                <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                                {status.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{status.description}</span>
                            </div>
                            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{listing.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{listing.type}</p>
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {listing.description}
                            </p>
                          </div>

                          <div className="shrink-0 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-left xl:text-right">
                            <p className="text-xs text-muted-foreground">Valor estimado</p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(listingValue)}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-card p-3">
                            <p className="text-xs text-muted-foreground">Quantidade anunciada</p>
                            <p className="mt-2 font-semibold text-foreground">
                              {formatInventoryQuantity(listing.quantity, listing.unit)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card p-3">
                            <p className="text-xs text-muted-foreground">Disponível</p>
                            <p className="mt-2 font-semibold text-foreground">
                              {formatInventoryQuantity(activeQuantity, listing.unit)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card p-3">
                            <p className="text-xs text-muted-foreground">Preço unitário</p>
                            <p className="mt-2 font-semibold text-foreground">
                              {formatCurrency(listing.price)} / {listing.unit}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card p-3">
                            <p className="text-xs text-muted-foreground">Publicado em</p>
                            <p className="mt-2 font-semibold text-foreground">{formatInventoryDate(listing.createdAt)}</p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate">{listing.location}</span>
                          </div>

                          {listing.status === "ativo" ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="sm" className="gap-2 rounded-xl">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Finalizar venda
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Finalizar este anúncio?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O saldo do item será subtraído em {formatInventoryQuantity(activeQuantity, listing.unit)}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleFinalizeListing(listing)}>
                                      Finalizar venda
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="sm" variant="outline" className="gap-2 rounded-xl">
                                    <PowerOff className="h-4 w-4" />
                                    Encerrar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Encerrar este anúncio?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O anúncio sai do marketplace, mas o saldo do item permanece no estoque.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeactivateListing(listing.id)}>
                                      Encerrar anúncio
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-muted-foreground">
                              Sem ações pendentes
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
