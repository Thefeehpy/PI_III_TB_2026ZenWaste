import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Fuel,
  Leaf,
  MapPin,
  Package,
  Route,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "@/assets/logo-zenwaste.png";

type OpportunityStatus = "open" | "sent" | "recommended";

type TransportOpportunity = {
  id: string;
  orderNumber: string;
  seller: string;
  material: string;
  origin: string;
  destination: string;
  distanceKm: number;
  weightTon: number;
  cubicMeters: number;
  suggestedValue: number;
  deadline: string;
  pickupWindow: string;
  vehicle: string;
  status: OpportunityStatus;
  environmentalScore: number;
};

const opportunities: TransportOpportunity[] = [
  {
    id: "opp-5841",
    orderNumber: "5841",
    seller: "EcoPack Compras",
    material: "Papel e papelao",
    origin: "Sao Paulo - SP",
    destination: "Campinas - SP",
    distanceKm: 98,
    weightTon: 4.2,
    cubicMeters: 18,
    suggestedValue: 680,
    deadline: "Hoje, 18:00",
    pickupWindow: "Amanha, 08:00 - 11:00",
    vehicle: "Bau medio",
    status: "recommended",
    environmentalScore: 92,
  },
  {
    id: "opp-5847",
    orderNumber: "5847",
    seller: "Circular Foods",
    material: "Vidro industrial",
    origin: "Sorocaba - SP",
    destination: "Jundiai - SP",
    distanceKm: 116,
    weightTon: 7.8,
    cubicMeters: 14,
    suggestedValue: 890,
    deadline: "Amanha, 12:00",
    pickupWindow: "08/10, 13:00 - 17:00",
    vehicle: "Truck reforcado",
    status: "open",
    environmentalScore: 86,
  },
  {
    id: "opp-5850",
    orderNumber: "5850",
    seller: "MetalPrime",
    material: "Sucata metalica",
    origin: "Contagem - MG",
    destination: "Betim - MG",
    distanceKm: 24,
    weightTon: 9.5,
    cubicMeters: 11,
    suggestedValue: 420,
    deadline: "Hoje, 15:30",
    pickupWindow: "Hoje, 16:30 - 18:00",
    vehicle: "Munck ou carreta curta",
    status: "open",
    environmentalScore: 95,
  },
];

const costProfile = [
  { material: "Papel e papelao", value: "R$ 4,80/km" },
  { material: "Plastico", value: "R$ 5,20/km" },
  { material: "Metal", value: "R$ 6,40/km" },
  { material: "Vidro", value: "R$ 7,10/km" },
];

const statusMeta: Record<OpportunityStatus, { label: string; className: string }> = {
  open: {
    label: "Aberta",
    className: "border-info/25 bg-info/10 text-info",
  },
  sent: {
    label: "Proposta enviada",
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  recommended: {
    label: "Recomendada",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CarrierDashboard() {
  const [sentOpportunityIds, setSentOpportunityIds] = useState<string[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  const dashboardMetrics = useMemo(() => {
    const totalValue = opportunities.reduce((sum, opportunity) => sum + opportunity.suggestedValue, 0);
    const totalWeight = opportunities.reduce((sum, opportunity) => sum + opportunity.weightTon, 0);

    return [
      { label: "Propostas no ar", value: opportunities.length.toString(), icon: ClipboardList },
      { label: "Valor potencial", value: formatCurrency(totalValue), icon: BadgeDollarSign },
      { label: "Toneladas disponiveis", value: `${totalWeight.toFixed(1)} ton`, icon: Package },
      { label: "Score medio", value: "91%", icon: Leaf },
    ];
  }, []);

  const sendProposal = (opportunityId: string) => {
    setSentOpportunityIds((current) =>
      current.includes(opportunityId) ? current : [...current, opportunityId],
    );
  };

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) || null;
  const selectedProposalSent = selectedOpportunity ? sentOpportunityIds.includes(selectedOpportunity.id) : false;

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_52%,#35d399_100%)] text-white">
        <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-white/14 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center">
              <img src={logo} alt="ZenWaste" className="h-auto w-36 drop-shadow-[0_14px_36px_rgba(52,211,153,0.24)]" />
            </Link>
            <ThemeToggle />
          </header>

          <div className="grid gap-8 py-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <Badge className="rounded-full border border-white/20 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
                <Truck className="mr-2 h-4 w-4" />
                Dashboard da transportadora
              </Badge>
              <h1 className="mt-5 text-3xl font-semibold sm:text-5xl">Propostas de transporte disponiveis</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Veja fretes publicados pelas empresas vendedoras, compare rotas, materiais, peso, janela de coleta e
                envie sua proposta de transporte em poucos cliques.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/20 bg-white/12 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <p className="text-sm text-white/70">Rota Verde Transportes</p>
              <p className="mt-2 text-2xl font-semibold">Fracionado e carga fechada</p>
              <p className="mt-1 text-sm text-white/70">SP, PR e MG</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <Card key={metric.label} className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <metric.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-2xl">Oportunidades em aberto</CardTitle>
              <CardDescription>Fretes publicados pela empresa vendedora para transportadoras parceiras.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {opportunities.map((opportunity) => (
                  <article
                    key={opportunity.id}
                    className="group relative overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--background)/0.96),hsl(var(--primary)/0.07))] p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]"
                  >
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_90%_20%,hsl(var(--primary)/0.22),transparent_36%)] opacity-80" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Proposta</p>
                            <p className="mt-1 text-xl font-semibold text-foreground">Pedido #{opportunity.orderNumber}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 sm:items-end">
                        <div className="rounded-[24px] border border-primary/20 bg-background/70 px-5 py-4 text-left shadow-[inset_0_1px_0_hsl(var(--primary)/0.14)] backdrop-blur sm:text-right">
                          <p className="text-xs text-muted-foreground">Valor da proposta</p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {formatCurrency(opportunity.suggestedValue)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="h-11 rounded-2xl border-primary/25 bg-background/80 px-6"
                          onClick={() => setSelectedOpportunityId(opportunity.id)}
                        >
                          Ver mais
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[30px] border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>Perfil de custo</CardTitle>
                <CardDescription>Valores usados para sugerir fretes compatíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {costProfile.map((item) => (
                  <div key={item.material} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-4">
                    <span className="text-sm text-muted-foreground">{item.material}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[30px] border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--card)))] shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Fuel className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Entregas confirmadas</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Apos uma proposta aprovada, o transporte aparece na tela operacional para coleta de canhoto digital.
                  </p>
                </div>
                <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
                  <Link to="/driver/deliveries">
                    Abrir entregas
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunityId(null)}>
        {selectedOpportunity && (
          <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto rounded-[32px] border-border/70 bg-card/95 p-0 shadow-[0_30px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="relative overflow-hidden rounded-t-[32px] bg-[linear-gradient(135deg,#071b18_0%,#0f766e_54%,#34d399_100%)] p-6 text-white">
              <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
              <div className="relative">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Pedido #{selectedOpportunity.orderNumber}</DialogTitle>
                  <DialogDescription className="text-white/76">
                    Informações completas para avaliar a proposta antes do envio.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm text-white/70">Valor sugerido</p>
                    <p className="mt-1 text-4xl font-semibold">{formatCurrency(selectedOpportunity.suggestedValue)}</p>
                  </div>
                  <Badge className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-white hover:bg-white/15">
                    {selectedProposalSent ? statusMeta.sent.label : statusMeta[selectedOpportunity.status].label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-[26px] border border-primary/20 bg-primary/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                  <Route className="h-4 w-4" />
                  Rota do transporte
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                  <Info icon={MapPin} label="Origem" value={selectedOpportunity.origin} />
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <Info icon={MapPin} label="Destino" value={selectedOpportunity.destination} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Info icon={Package} label="Material" value={selectedOpportunity.material} />
                <Info icon={Truck} label="Veiculo indicado" value={selectedOpportunity.vehicle} />
                <Info
                  icon={Package}
                  label="Carga"
                  value={`${selectedOpportunity.weightTon} ton / ${selectedOpportunity.cubicMeters} m3`}
                />
                <Info icon={Route} label="Distancia" value={`${selectedOpportunity.distanceKm} km`} />
                <Info icon={CalendarClock} label="Janela de coleta" value={selectedOpportunity.pickupWindow} />
                <Info icon={CalendarClock} label="Prazo da proposta" value={selectedOpportunity.deadline} />
              </div>

              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Compatibilidade da rota: {selectedOpportunity.environmentalScore}%
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Pedido publicado por {selectedOpportunity.seller}. Analise peso, cubagem, prazo e janela de
                      coleta antes de confirmar sua proposta.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/70 p-6">
              <Button variant="outline" className="h-11 rounded-2xl" onClick={() => setSelectedOpportunityId(null)}>
                Fechar
              </Button>
              <Button
                className="h-11 rounded-2xl"
                disabled={selectedProposalSent}
                onClick={() => sendProposal(selectedOpportunity.id)}
              >
                {selectedProposalSent ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {selectedProposalSent ? "Proposta enviada" : "Enviar proposta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
