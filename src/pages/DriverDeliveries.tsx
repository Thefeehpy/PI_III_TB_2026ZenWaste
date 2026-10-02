import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  Search,
  Send,
  Signature,
  Truck,
} from "lucide-react";

import { SignaturePad } from "@/components/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DriverDelivery = {
  id: string;
  orderNumber: string;
  client: string;
  material: string;
  address: string;
  city: string;
  forecast: string;
  volume: string;
  status: "pending" | "route" | "delivered";
  receiverName?: string;
  confirmedAt?: string;
};

const initialDeliveries: DriverDelivery[] = [
  {
    id: "del-5842",
    orderNumber: "5842",
    client: "Empresa ABC",
    material: "Plástico Industrial",
    address: "Av. das Indústrias, 420",
    city: "Curitiba - PR",
    forecast: "Hoje, 14:30",
    volume: "24 m³ / 6,5 ton",
    status: "route",
  },
  {
    id: "del-5846",
    orderNumber: "5846",
    client: "GreenSupply B2B",
    material: "Papel e Papelão",
    address: "Rua Anhanguera, 1180",
    city: "Campinas - SP",
    forecast: "Hoje, 16:00",
    volume: "18 m³ / 4,1 ton",
    status: "pending",
  },
  {
    id: "del-5845",
    orderNumber: "5845",
    client: "Nova Matéria",
    material: "Borracha",
    address: "Rod. BR-116, km 92",
    city: "Porto Alegre - RS",
    forecast: "Ontem, 17:20",
    volume: "12 m³ / 3,4 ton",
    status: "delivered",
    receiverName: "Paulo Nogueira",
    confirmedAt: "30/09/2026 às 17:18",
  },
];

const deliveryStatus = {
  pending: {
    label: "Aguardando saída",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  route: {
    label: "Em rota",
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  delivered: {
    label: "Entregue",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  },
};

export default function DriverDeliveries() {
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>(initialDeliveries);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(initialDeliveries[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [signatureData, setSignatureData] = useState("");

  const selectedDelivery = deliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? deliveries[0];

  const filteredDeliveries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return deliveries.filter(
      (delivery) =>
        !normalizedSearch ||
        delivery.orderNumber.toLowerCase().includes(normalizedSearch) ||
        delivery.client.toLowerCase().includes(normalizedSearch) ||
        delivery.city.toLowerCase().includes(normalizedSearch),
    );
  }, [deliveries, searchTerm]);

  const pendingCount = deliveries.filter((delivery) => delivery.status !== "delivered").length;
  const deliveredCount = deliveries.filter((delivery) => delivery.status === "delivered").length;

  const handleConfirmDelivery = () => {
    if (!receiverName.trim() || !selectedDelivery) {
      return;
    }

    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === selectedDelivery.id
          ? {
              ...delivery,
              status: "delivered",
              receiverName: receiverName.trim(),
              confirmedAt: new Date().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : delivery,
      ),
    );
    setReceiverName("");
    setSignatureData("");
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge className="rounded-full border border-white/20 bg-white/12 text-white hover:bg-white/12">
                <Truck className="mr-2 h-4 w-4" />
                Área do entregador
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Entregas do dia</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
                Consulte pedidos em rota, confirme a entrega e colete o canhoto digital no celular.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[26px] border border-white/70 bg-white/12 p-3 backdrop-blur-xl">
              <div className="rounded-2xl border border-white/50 bg-white/10 px-5 py-3 text-center">
                <p className="text-2xl font-semibold">{pendingCount}</p>
                <p className="text-xs text-white/70">pendentes</p>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white/10 px-5 py-3 text-center">
                <p className="text-2xl font-semibold">{deliveredCount}</p>
                <p className="text-xs text-white/70">entregues</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:px-8">
        <Card className="rounded-[30px] border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Roteiro</CardTitle>
            <CardDescription>Selecione uma entrega para abrir o canhoto.</CardDescription>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar pedido ou cliente"
                className="h-11 rounded-2xl pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredDeliveries.map((delivery) => (
              <button
                key={delivery.id}
                type="button"
                className={cn(
                  "w-full rounded-[24px] border p-4 text-left transition-all hover:-translate-y-0.5",
                  selectedDelivery.id === delivery.id ? "border-primary/35 bg-primary/10" : "border-border/70 bg-background",
                )}
                onClick={() => setSelectedDeliveryId(delivery.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Pedido #{delivery.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{delivery.client}</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full", deliveryStatus[delivery.status].className)}>
                    {deliveryStatus[delivery.status].label}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{delivery.city}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[30px] border-border/70 shadow-sm">
          <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-2xl">Pedido #{selectedDelivery.orderNumber}</CardTitle>
              <CardDescription>{selectedDelivery.client} • {selectedDelivery.material}</CardDescription>
            </div>
            <Badge variant="outline" className={cn("w-fit rounded-full", deliveryStatus[selectedDelivery.status].className)}>
              {deliveryStatus[selectedDelivery.status].label}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Info icon={MapPin} label="Destino" value={`${selectedDelivery.address}, ${selectedDelivery.city}`} />
              <Info icon={Clock3} label="Previsão" value={selectedDelivery.forecast} />
              <Info icon={PackageCheck} label="Mercadoria" value={selectedDelivery.volume} />
            </div>

            {selectedDelivery.status === "delivered" ? (
              <div className="rounded-[26px] border border-emerald-500/25 bg-emerald-500/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-foreground">Entrega confirmada</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Recebido por {selectedDelivery.receiverName} em {selectedDelivery.confirmedAt}.
                    </p>
                    <Badge className="mt-4 rounded-full">Canhoto digital disponível</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 rounded-[28px] border border-border/70 bg-muted/20 p-5">
                <div className="flex items-center gap-3">
                  <Signature className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Canhoto digital</p>
                    <p className="text-sm text-muted-foreground">Peça para o cliente conferir os dados e assinar abaixo.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiver-name">Nome de quem recebeu</Label>
                  <Input
                    id="receiver-name"
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    placeholder="Nome completo"
                    className="h-12 rounded-2xl"
                  />
                </div>

                <SignaturePad value={signatureData} onChange={setSignatureData} />

                <Button className="h-12 w-full rounded-2xl" disabled={!receiverName.trim()} onClick={handleConfirmDelivery}>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar entrega
                </Button>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Button variant="outline" className="h-12 rounded-2xl">
                <Navigation className="mr-2 h-4 w-4" />
                Abrir rota
              </Button>
              <Button variant="outline" className="h-12 rounded-2xl">
                <Route className="mr-2 h-4 w-4" />
                Registrar ocorrência
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
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
