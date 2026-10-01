import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Leaf,
  Package,
  PlusCircle,
  Route,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type FreightQuote = {
  carrier: string;
  value: number;
  deliveryDays: number;
  service: string;
};

type FreightAuditStatus = "approved" | "divergent" | "pending";

type FreightAuditItem = {
  id: string;
  orderId: string;
  buyer: string;
  material: string;
  origin: string;
  destination: string;
  distanceKm: number;
  weightTon: number;
  requestedAt: string;
  approvedQuote: FreightQuote;
  quotes: FreightQuote[];
  cte?: {
    number: string;
    chargedValue: number;
    receivedAt: string;
  };
};

type NewFreightForm = {
  orderId: string;
  buyer: string;
  material: string;
  origin: string;
  destination: string;
  distanceKm: string;
  weightTon: string;
  carrier: string;
  quotedValue: string;
  deliveryDays: string;
  service: string;
  chargedValue: string;
};

const divergenceTolerance = 5;

const emptyFreightForm: NewFreightForm = {
  orderId: "",
  buyer: "",
  material: "",
  origin: "",
  destination: "",
  distanceKm: "",
  weightTon: "",
  carrier: "",
  quotedValue: "",
  deliveryDays: "2",
  service: "Carga dedicada",
  chargedValue: "",
};

const initialFreights: FreightAuditItem[] = [
  {
    id: "fr-001",
    orderId: "PED-1048",
    buyer: "EcoPack Compras",
    material: "Papel e Papelão",
    origin: "São Paulo - SP",
    destination: "Campinas - SP",
    distanceKm: 96,
    weightTon: 4.2,
    requestedAt: "2026-09-22",
    approvedQuote: {
      carrier: "Rota Verde Transportes",
      value: 212,
      deliveryDays: 1,
      service: "Carga dedicada",
    },
    quotes: [
      { carrier: "Rota Verde Transportes", value: 212, deliveryDays: 1, service: "Carga dedicada" },
      { carrier: "TransLog Sul", value: 248, deliveryDays: 2, service: "Fracionado" },
      { carrier: "FreteMais Express", value: 265, deliveryDays: 1, service: "Expresso" },
    ],
    cte: {
      number: "CTE-89312",
      chargedValue: 498,
      receivedAt: "2026-09-24",
    },
  },
  {
    id: "fr-002",
    orderId: "PED-1051",
    buyer: "Circular Foods",
    material: "Plástico Industrial",
    origin: "Sorocaba - SP",
    destination: "Curitiba - PR",
    distanceKm: 395,
    weightTon: 6.5,
    requestedAt: "2026-09-23",
    approvedQuote: {
      carrier: "TransLog Sul",
      value: 860,
      deliveryDays: 2,
      service: "Lotação",
    },
    quotes: [
      { carrier: "TransLog Sul", value: 860, deliveryDays: 2, service: "Lotação" },
      { carrier: "Rota Verde Transportes", value: 930, deliveryDays: 3, service: "Lotação" },
      { carrier: "FreteMais Express", value: 1050, deliveryDays: 2, service: "Expresso" },
    ],
    cte: {
      number: "CTE-89345",
      chargedValue: 860,
      receivedAt: "2026-09-25",
    },
  },
  {
    id: "fr-003",
    orderId: "PED-1057",
    buyer: "Nova Matéria",
    material: "Sucata Metálica",
    origin: "Campinas - SP",
    destination: "Belo Horizonte - MG",
    distanceKm: 585,
    weightTon: 8.8,
    requestedAt: "2026-09-26",
    approvedQuote: {
      carrier: "Minas Cargo",
      value: 1420,
      deliveryDays: 3,
      service: "Carga fechada",
    },
    quotes: [
      { carrier: "Minas Cargo", value: 1420, deliveryDays: 3, service: "Carga fechada" },
      { carrier: "TransLog Sul", value: 1510, deliveryDays: 4, service: "Lotação" },
      { carrier: "Rota Verde Transportes", value: 1640, deliveryDays: 3, service: "Carga dedicada" },
    ],
  },
  {
    id: "fr-004",
    orderId: "PED-1062",
    buyer: "Revalora Industrial",
    material: "Vidro Industrial",
    origin: "Rio de Janeiro - RJ",
    destination: "São Paulo - SP",
    distanceKm: 430,
    weightTon: 5.1,
    requestedAt: "2026-09-28",
    approvedQuote: {
      carrier: "FreteMais Express",
      value: 780,
      deliveryDays: 2,
      service: "Fracionado",
    },
    quotes: [
      { carrier: "FreteMais Express", value: 780, deliveryDays: 2, service: "Fracionado" },
      { carrier: "Rota Verde Transportes", value: 805, deliveryDays: 2, service: "Fracionado" },
      { carrier: "Minas Cargo", value: 910, deliveryDays: 3, service: "Carga fechada" },
    ],
    cte: {
      number: "CTE-89402",
      chargedValue: 815,
      receivedAt: "2026-09-30",
    },
  },
];

const statusMeta: Record<
  FreightAuditStatus,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
    chartColor: string;
  }
> = {
  approved: {
    label: "Conferido",
    description: "valor dentro da tolerância",
    badgeClassName: "border-primary/25 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
    chartColor: "hsl(var(--primary))",
  },
  divergent: {
    label: "Divergente",
    description: "bloquear pagamento",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
    chartColor: "hsl(var(--warning))",
  },
  pending: {
    label: "Aguardando CT-e",
    description: "cobrança não recebida",
    badgeClassName: "border-info/25 bg-info/10 text-info",
    dotClassName: "bg-info",
    chartColor: "hsl(var(--info))",
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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getChargedValue(item: FreightAuditItem) {
  return item.cte?.chargedValue ?? null;
}

function getDifference(item: FreightAuditItem) {
  const chargedValue = getChargedValue(item);
  return chargedValue === null ? 0 : chargedValue - item.approvedQuote.value;
}

function getFreightStatus(item: FreightAuditItem): FreightAuditStatus {
  const chargedValue = getChargedValue(item);

  if (chargedValue === null) {
    return "pending";
  }

  return Math.abs(chargedValue - item.approvedQuote.value) > divergenceTolerance ? "divergent" : "approved";
}

function estimateCo2Kg(item: FreightAuditItem) {
  return Math.round(item.distanceKm * item.weightTon * 0.085);
}

function buildQuoteOptions(carrier: string, quotedValue: number, deliveryDays: number, service: string): FreightQuote[] {
  return [
    { carrier, value: quotedValue, deliveryDays, service },
    {
      carrier: "Rota Verde Transportes",
      value: Math.round(quotedValue * 1.08),
      deliveryDays: deliveryDays + 1,
      service: "Fracionado",
    },
    {
      carrier: "FreteMais Express",
      value: Math.round(quotedValue * 1.18),
      deliveryDays: Math.max(1, deliveryDays - 1),
      service: "Expresso",
    },
  ];
}

export default function FreightAudit() {
  const [freights, setFreights] = useState<FreightAuditItem[]>(initialFreights);
  const [selectedFreightId, setSelectedFreightId] = useState(initialFreights[0]?.id ?? "");
  const selectedFreight = freights.find((item) => item.id === selectedFreightId) ?? freights[0];
  const [cteDraft, setCteDraft] = useState(String(selectedFreight?.cte?.chargedValue ?? selectedFreight?.approvedQuote.value ?? 0));
  const [newFreightForm, setNewFreightForm] = useState<NewFreightForm>(emptyFreightForm);
  const chartTheme = useChartTheme();
  const isMobile = useIsMobile();

  const auditedFreights = useMemo(
    () =>
      freights.map((item) => ({
        ...item,
        status: getFreightStatus(item),
        difference: getDifference(item),
        chargedValue: getChargedValue(item),
        co2Kg: estimateCo2Kg(item),
      })),
    [freights],
  );

  const totals = useMemo(
    () =>
      auditedFreights.reduce(
        (acc, freight) => {
          acc.quoted += freight.approvedQuote.value;
          acc.distance += freight.distanceKm;
          acc.co2 += freight.co2Kg;
          acc[freight.status] += 1;

          if (freight.chargedValue !== null) {
            acc.charged += freight.chargedValue;
          }

          if (freight.difference > divergenceTolerance) {
            acc.risk += freight.difference;
          }

          return acc;
        },
        { quoted: 0, charged: 0, risk: 0, distance: 0, co2: 0, approved: 0, divergent: 0, pending: 0 },
      ),
    [auditedFreights],
  );

  const statusChartData = useMemo(
    () =>
      (Object.keys(statusMeta) as FreightAuditStatus[])
        .map((status) => ({
          name: statusMeta[status].label,
          value: totals[status],
          fill: statusMeta[status].chartColor,
        }))
        .filter((entry) => entry.value > 0),
    [totals],
  );

  const comparisonChartData = useMemo(
    () =>
      auditedFreights.map((freight) => ({
        name: freight.orderId,
        cotado: freight.approvedQuote.value,
        cobrado: freight.chargedValue ?? 0,
        diferenca: Math.max(freight.difference, 0),
      })),
    [auditedFreights],
  );

  const selectedAudit = auditedFreights.find((item) => item.id === selectedFreight?.id);
  const selectedStatus = selectedAudit ? statusMeta[selectedAudit.status] : statusMeta.pending;
  const canAddFreight = Boolean(
    newFreightForm.orderId.trim() &&
      newFreightForm.buyer.trim() &&
      newFreightForm.material.trim() &&
      newFreightForm.carrier.trim() &&
      Number(newFreightForm.quotedValue) > 0,
  );

  const handleSelectFreight = (id: string) => {
    const nextFreight = freights.find((item) => item.id === id);
    setSelectedFreightId(id);
    setCteDraft(String(nextFreight?.cte?.chargedValue ?? nextFreight?.approvedQuote.value ?? 0));
  };

  const handleAuditCte = () => {
    const numericValue = Number(cteDraft);

    if (!selectedFreight || !Number.isFinite(numericValue) || numericValue < 0) {
      return;
    }

    setFreights((current) =>
      current.map((item) =>
        item.id === selectedFreight.id
          ? {
              ...item,
              cte: {
                number: item.cte?.number ?? `CTE-${Math.floor(89000 + Math.random() * 900)}`,
                chargedValue: numericValue,
                receivedAt: new Date().toISOString().slice(0, 10),
              },
            }
          : item,
      ),
    );
  };

  const handleFreightFormChange = (field: keyof NewFreightForm, value: string) => {
    setNewFreightForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddFreight = () => {
    const quotedValue = Number(newFreightForm.quotedValue);
    const chargedValue = Number(newFreightForm.chargedValue);
    const distanceKm = Math.max(0, Number(newFreightForm.distanceKm) || 0);
    const weightTon = Math.max(0, Number(newFreightForm.weightTon) || 0);
    const deliveryDays = Math.max(1, Number(newFreightForm.deliveryDays) || 1);

    if (!canAddFreight || !Number.isFinite(quotedValue)) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const approvedQuote: FreightQuote = {
      carrier: newFreightForm.carrier.trim(),
      value: quotedValue,
      deliveryDays,
      service: newFreightForm.service.trim() || "Carga dedicada",
    };
    const newFreight: FreightAuditItem = {
      id: `fr-${Date.now()}`,
      orderId: newFreightForm.orderId.trim(),
      buyer: newFreightForm.buyer.trim(),
      material: newFreightForm.material.trim(),
      origin: newFreightForm.origin.trim() || "Origem não informada",
      destination: newFreightForm.destination.trim() || "Destino não informado",
      distanceKm,
      weightTon,
      requestedAt: today,
      approvedQuote,
      quotes: buildQuoteOptions(approvedQuote.carrier, approvedQuote.value, approvedQuote.deliveryDays, approvedQuote.service),
      cte:
        newFreightForm.chargedValue.trim() && Number.isFinite(chargedValue)
          ? {
              number: `CTE-${Math.floor(90000 + Math.random() * 900)}`,
              chargedValue,
              receivedAt: today,
            }
          : undefined,
    };

    setFreights((current) => [newFreight, ...current]);
    setSelectedFreightId(newFreight.id);
    setCteDraft(String(newFreight.cte?.chargedValue ?? newFreight.approvedQuote.value));
    setNewFreightForm(emptyFreightForm);
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
              Auditoria logística e financeira
            </Badge>

            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">Gestão de Fretes</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Compare o valor cotado e aprovado pelo faturamento com o valor cobrado no CT-e antes do financeiro
                liberar o pagamento da transportadora.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-white/82">
              <span className="rounded-full border border-white/16 bg-white/12 px-3 py-1.5 backdrop-blur">Cotação</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1.5 backdrop-blur">
                <ArrowRight className="h-4 w-4" />
                Transportadora
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1.5 backdrop-blur">
                <ArrowRight className="h-4 w-4" />
                CT-e
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-1.5 backdrop-blur">
                <ArrowRight className="h-4 w-4" />
                Conferência
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/12 p-5 backdrop-blur-xl">
            <p className="text-sm text-white/70">Risco financeiro bloqueado</p>
            <p className="mt-3 text-4xl font-semibold">{formatCurrency(totals.risk)}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totals.divergent}</p>
                <p className="mt-1 text-xs text-white/62">divergências</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totals.approved}</p>
                <p className="mt-1 text-xs text-white/62">conferidos</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totals.pending}</p>
                <p className="mt-1 text-xs text-white/62">pendentes</p>
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
                <p className="text-sm text-muted-foreground">Fretes auditados</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{auditedFreights.length}</p>
                <p className="mt-2 text-xs text-muted-foreground">pedidos com cotação registrada</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <FileSearch className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor cotado</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totals.quoted)}</p>
                <p className="mt-2 text-xs text-muted-foreground">base aprovada pelo faturamento</p>
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
                <p className="text-sm text-muted-foreground">Valor cobrado</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totals.charged)}</p>
                <p className="mt-2 text-xs text-muted-foreground">CT-es recebidos até agora</p>
              </div>
              <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                <BadgeCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">CO2 estimado</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{totals.co2.toLocaleString("pt-BR")} kg</p>
                <p className="mt-2 text-xs text-muted-foreground">indicador logístico ambiental</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                <Leaf className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Adicionar pedido de frete</CardTitle>
            <CardDescription>
              Registre a cotação aprovada pelo faturamento e, se já existir, o valor cobrado no CT-e.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            Novo pedido
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="new-order-id">Pedido</Label>
              <Input
                id="new-order-id"
                value={newFreightForm.orderId}
                onChange={(event) => handleFreightFormChange("orderId", event.target.value)}
                placeholder="PED-1068"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-buyer">Empresa compradora</Label>
              <Input
                id="new-buyer"
                value={newFreightForm.buyer}
                onChange={(event) => handleFreightFormChange("buyer", event.target.value)}
                placeholder="Nome da empresa"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-material">Produto/material</Label>
              <Input
                id="new-material"
                value={newFreightForm.material}
                onChange={(event) => handleFreightFormChange("material", event.target.value)}
                placeholder="Papel e Papelão"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-carrier">Transportadora escolhida</Label>
              <Input
                id="new-carrier"
                value={newFreightForm.carrier}
                onChange={(event) => handleFreightFormChange("carrier", event.target.value)}
                placeholder="Rota Verde Transportes"
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="new-origin">Origem</Label>
              <Input
                id="new-origin"
                value={newFreightForm.origin}
                onChange={(event) => handleFreightFormChange("origin", event.target.value)}
                placeholder="São Paulo - SP"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-destination">Destino</Label>
              <Input
                id="new-destination"
                value={newFreightForm.destination}
                onChange={(event) => handleFreightFormChange("destination", event.target.value)}
                placeholder="Campinas - SP"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-distance">Distância estimada (km)</Label>
              <Input
                id="new-distance"
                type="number"
                min="0"
                value={newFreightForm.distanceKm}
                onChange={(event) => handleFreightFormChange("distanceKm", event.target.value)}
                placeholder="96"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-weight">Peso estimado (ton)</Label>
              <Input
                id="new-weight"
                type="number"
                min="0"
                step="0.1"
                value={newFreightForm.weightTon}
                onChange={(event) => handleFreightFormChange("weightTon", event.target.value)}
                placeholder="4.2"
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-quoted-value">Valor cotado aprovado</Label>
              <Input
                id="new-quoted-value"
                type="number"
                min="0"
                step="0.01"
                value={newFreightForm.quotedValue}
                onChange={(event) => handleFreightFormChange("quotedValue", event.target.value)}
                placeholder="212.00"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-charged-value">Valor cobrado no CT-e</Label>
              <Input
                id="new-charged-value"
                type="number"
                min="0"
                step="0.01"
                value={newFreightForm.chargedValue}
                onChange={(event) => handleFreightFormChange("chargedValue", event.target.value)}
                placeholder="Opcional"
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-delivery-days">Prazo (dias)</Label>
              <Input
                id="new-delivery-days"
                type="number"
                min="1"
                value={newFreightForm.deliveryDays}
                onChange={(event) => handleFreightFormChange("deliveryDays", event.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-service">Serviço</Label>
              <Input
                id="new-service"
                value={newFreightForm.service}
                onChange={(event) => handleFreightFormChange("service", event.target.value)}
                placeholder="Carga dedicada"
                className="h-12 rounded-2xl"
              />
            </div>

            <Button type="button" onClick={handleAddFreight} disabled={!canAddFreight} className="h-12 rounded-2xl px-5">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Conferir cobrança CT-e</CardTitle>
            <CardDescription>
              Selecione o pedido, informe o valor cobrado e veja a divergência antes do pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedFreight && selectedAudit ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pedido</Label>
                    <Select value={selectedFreight.id} onValueChange={handleSelectFreight}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="Selecione o pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        {freights.map((freight) => (
                          <SelectItem key={freight.id} value={freight.id}>
                            {freight.orderId} - {freight.buyer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cte-value">Valor cobrado no CT-e</Label>
                    <Input
                      id="cte-value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cteDraft}
                      onChange={(event) => setCteDraft(event.target.value)}
                      className="h-12 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("rounded-full px-3 py-1", selectedStatus.badgeClassName)}>
                          <span className={cn("mr-2 h-2 w-2 rounded-full", selectedStatus.dotClassName)} />
                          {selectedStatus.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{selectedStatus.description}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-foreground">{selectedFreight.orderId}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedFreight.buyer} • {selectedFreight.material}
                      </p>
                    </div>

                    <Button onClick={handleAuditCte} className="h-11 rounded-2xl">
                      Conferir CT-e
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card p-3">
                      <p className="text-xs text-muted-foreground">Valor aprovado</p>
                      <p className="mt-2 font-semibold text-foreground">{formatCurrency(selectedFreight.approvedQuote.value)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card p-3">
                      <p className="text-xs text-muted-foreground">Valor cobrado</p>
                      <p className="mt-2 font-semibold text-foreground">
                        {selectedAudit.chargedValue === null ? "Aguardando" : formatCurrency(selectedAudit.chargedValue)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card p-3">
                      <p className="text-xs text-muted-foreground">Diferença</p>
                      <p className={cn("mt-2 font-semibold", selectedAudit.difference > divergenceTolerance ? "text-warning" : "text-foreground")}>
                        {formatCurrency(selectedAudit.difference)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground">Cotações recebidas</h3>
                    <Badge variant="outline" className="rounded-full">
                      Transportadora escolhida
                    </Badge>
                  </div>

                  <div className="grid gap-3">
                    {selectedFreight.quotes.map((quote) => {
                      const isSelected = quote.carrier === selectedFreight.approvedQuote.carrier;

                      return (
                        <div
                          key={quote.carrier}
                          className={cn(
                            "rounded-2xl border p-4",
                            isSelected ? "border-primary/35 bg-primary/10" : "border-border/70 bg-background/70",
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{quote.carrier}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {quote.service} • {quote.deliveryDays} dia(s)
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-semibold text-foreground">{formatCurrency(quote.value)}</p>
                              {isSelected && <p className="text-xs font-medium text-primary">cotação aprovada</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[28px] border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                Nenhum frete disponível para auditoria.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Cotado x Cobrado</CardTitle>
            <CardDescription>Comparação visual entre o valor aprovado e o valor recebido no CT-e.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 8, right: 10, left: isMobile ? 0 : 10, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={12} />
                  <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={(value: number) => `R$ ${value}`} />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBackground,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      borderRadius: "16px",
                      color: chartTheme.tooltipText,
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                  />
                  <Bar dataKey="cotado" fill={chartTheme.primary} radius={[10, 10, 0, 0]} barSize={isMobile ? 16 : 24} />
                  <Bar dataKey="cobrado" fill="hsl(var(--warning))" radius={[10, 10, 0, 0]} barSize={isMobile ? 16 : 24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-2xl">Pedidos e auditorias</CardTitle>
              <CardDescription>Histórico dos fretes cotados, documentos recebidos e bloqueios financeiros.</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              {auditedFreights.length} registros
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {auditedFreights.map((freight) => {
                const status = statusMeta[freight.status];

                return (
                  <article
                    key={freight.id}
                    className="rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 md:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                            <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                            {status.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{status.description}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-foreground">{freight.orderId}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {freight.buyer} • {freight.material}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Transportadora aprovada</p>
                        <p className="mt-1 font-semibold text-foreground">{freight.approvedQuote.carrier}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Cotado</p>
                        <p className="mt-2 font-semibold text-foreground">{formatCurrency(freight.approvedQuote.value)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Cobrado</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {freight.chargedValue === null ? "Aguardando" : formatCurrency(freight.chargedValue)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Diferença</p>
                        <p className={cn("mt-2 font-semibold", freight.difference > divergenceTolerance ? "text-warning" : "text-foreground")}>
                          {formatCurrency(freight.difference)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">CT-e</p>
                        <p className="mt-2 font-semibold text-foreground">{freight.cte?.number ?? "Não recebido"}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 border-t border-border/70 pt-5 md:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Route className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          {freight.origin} → {freight.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-4 w-4 shrink-0 text-primary" />
                        <span>{freight.distanceKm.toLocaleString("pt-BR")} km percorridos</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Leaf className="h-4 w-4 shrink-0 text-primary" />
                        <span>{freight.co2Kg.toLocaleString("pt-BR")} kg CO2 estimado</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Status financeiro</CardTitle>
            <CardDescription>Distribuição dos fretes por situação de conferência.</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                Nenhum status disponível.
              </div>
            ) : (
              <>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={4}>
                        {statusChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltipBackground,
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          borderRadius: "16px",
                          color: chartTheme.tooltipText,
                        }}
                        formatter={(value: number) => [`${value} frete(s)`, "Total"]}
                        labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {(Object.keys(statusMeta) as FreightAuditStatus[]).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn("h-3 w-3 rounded-full", statusMeta[status].dotClassName)} />
                        <span className="text-sm font-medium text-foreground">{statusMeta[status].label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{totals[status]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 rounded-[24px] border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Package className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Fluxo recomendado</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Fretes divergentes devem ficar bloqueados para pagamento até faturamento e financeiro validarem a
                    cobrança com a transportadora.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
