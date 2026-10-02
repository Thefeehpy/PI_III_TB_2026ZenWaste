import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Leaf,
  MessageSquarePlus,
  Package,
  Plus,
  Route,
  Search,
  Send,
  Signature,
  Sparkles,
  Truck,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad } from "@/components/SignaturePad";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FreightStatus =
  | "awaiting_quote"
  | "quoting"
  | "awaiting_document"
  | "transport"
  | "divergent"
  | "delivered";

type FreightQuote = {
  id: string;
  carrier: string;
  value: number;
  deliveryDays: number;
  note: string;
  approved?: boolean;
};

type FreightDocument = {
  fileName: string;
  cteNumber: string;
  cteValue: number;
  receivedAt: string;
};

type FreightTreatment = {
  id: string;
  at: string;
  author: string;
  note: string;
};

type FreightDelivery = {
  receiverName: string;
  confirmedAt: string;
  signatureData: string;
};

type FreightProcess = {
  id: string;
  orderNumber: string;
  client: string;
  material: string;
  origin: string;
  destination: string;
  cubicMeters: number;
  weightTon: number;
  orderDate: string;
  forecastDate: string;
  status: FreightStatus;
  quotes: FreightQuote[];
  document?: FreightDocument;
  treatments: FreightTreatment[];
  delivery?: FreightDelivery;
};

type NewOrderForm = {
  orderNumber: string;
  client: string;
  material: string;
  origin: string;
  destination: string;
  cubicMeters: string;
  weightTon: string;
  forecastDate: string;
};

type QuoteForm = {
  carrier: string;
  value: string;
  deliveryDays: string;
  note: string;
};

type DocumentForm = {
  fileName: string;
  cteNumber: string;
  cteValue: string;
};

const statusMeta: Record<
  FreightStatus,
  {
    label: string;
    shortLabel: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  awaiting_quote: {
    label: "Aguardando cotação",
    shortLabel: "Cotação",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
  },
  quoting: {
    label: "Em cotação",
    shortLabel: "Cotando",
    badgeClassName: "border-info/25 bg-info/10 text-info",
    dotClassName: "bg-info",
  },
  awaiting_document: {
    label: "Aguardando documento",
    shortLabel: "Documento",
    badgeClassName: "border-violet-500/25 bg-violet-500/10 text-violet-500",
    dotClassName: "bg-violet-500",
  },
  transport: {
    label: "Em transporte",
    shortLabel: "Transporte",
    badgeClassName: "border-primary/25 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
  },
  divergent: {
    label: "Divergência",
    shortLabel: "Divergência",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
  delivered: {
    label: "Entregue",
    shortLabel: "Entregue",
    badgeClassName: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
    dotClassName: "bg-emerald-500",
  },
};

const flowSteps = ["Pedido", "Cotação", "Aprovação", "Conferência", "Transporte", "Entrega"];

const statusStepIndex: Record<FreightStatus, number> = {
  awaiting_quote: 1,
  quoting: 1,
  awaiting_document: 3,
  divergent: 3,
  transport: 4,
  delivered: 5,
};

const filterOptions: Array<{ value: "all" | FreightStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "awaiting_quote", label: "Aguardando Cotação" },
  { value: "transport", label: "Em Andamento" },
  { value: "divergent", label: "Divergências" },
  { value: "delivered", label: "Entregues" },
];

const emptyOrderForm: NewOrderForm = {
  orderNumber: "",
  client: "",
  material: "",
  origin: "",
  destination: "",
  cubicMeters: "",
  weightTon: "",
  forecastDate: "",
};

const emptyQuoteForm: QuoteForm = {
  carrier: "",
  value: "",
  deliveryDays: "2",
  note: "",
};

const initialFreights: FreightProcess[] = [
  {
    id: "fp-5841",
    orderNumber: "5841",
    client: "EcoPack Compras",
    material: "Papel e Papelão",
    origin: "São Paulo - SP",
    destination: "Campinas - SP",
    cubicMeters: 18,
    weightTon: 4.2,
    orderDate: "2026-09-26",
    forecastDate: "2026-10-03",
    status: "awaiting_quote",
    quotes: [],
    treatments: [
      {
        id: "tr-5841-1",
        at: "2026-09-26T09:12:00",
        author: "Maria",
        note: "Pedido recebido. Aguardando retorno das transportadoras para cotação.",
      },
    ],
  },
  {
    id: "fp-5842",
    orderNumber: "5842",
    client: "Empresa ABC",
    material: "Plástico Industrial",
    origin: "Sorocaba - SP",
    destination: "Curitiba - PR",
    cubicMeters: 24,
    weightTon: 6.5,
    orderDate: "2026-09-27",
    forecastDate: "2026-10-04",
    status: "transport",
    quotes: [
      { id: "q-5842-1", carrier: "Transportadora A", value: 480, deliveryDays: 3, note: "Frete fracionado" },
      { id: "q-5842-2", carrier: "Rodonaves", value: 420, deliveryDays: 2, note: "Melhor custo-benefício", approved: true },
      { id: "q-5842-3", carrier: "Transportadora X", value: 510, deliveryDays: 2, note: "Entrega expressa" },
    ],
    document: {
      fileName: "cte-5842-rodonaves.pdf",
      cteNumber: "CTE-90318",
      cteValue: 420,
      receivedAt: "2026-09-28T16:20:00",
    },
    treatments: [
      { id: "tr-5842-1", at: "2026-09-27T11:04:00", author: "Maria", note: "Rodonaves aprovada pelo menor valor." },
      { id: "tr-5842-2", at: "2026-09-28T16:26:00", author: "Financeiro", note: "CT-e conferido sem divergência." },
    ],
  },
  {
    id: "fp-5843",
    orderNumber: "5843",
    client: "Empresa XYZ",
    material: "Sucata Metálica",
    origin: "Campinas - SP",
    destination: "Belo Horizonte - MG",
    cubicMeters: 32,
    weightTon: 8.8,
    orderDate: "2026-09-28",
    forecastDate: "2026-10-05",
    status: "divergent",
    quotes: [
      { id: "q-5843-1", carrier: "Minas Cargo", value: 410, deliveryDays: 3, note: "Carga fechada" },
      { id: "q-5843-2", carrier: "TransLog", value: 380, deliveryDays: 3, note: "Condição negociada", approved: true },
      { id: "q-5843-3", carrier: "Rota Verde", value: 465, deliveryDays: 4, note: "Frete comum" },
    ],
    document: {
      fileName: "cte-5843-translog.pdf",
      cteNumber: "CTE-90344",
      cteValue: 520,
      receivedAt: "2026-10-02T09:42:00",
    },
    treatments: [
      { id: "tr-5843-1", at: "2026-10-02T09:42:00", author: "Maria", note: "Maria registrou uma divergência de R$ 140,00 no CT-e." },
      { id: "tr-5843-2", at: "2026-10-02T10:15:00", author: "Renan", note: "Contato realizado com a transportadora para conferência do valor." },
    ],
  },
  {
    id: "fp-5844",
    orderNumber: "5844",
    client: "Circular Foods",
    material: "Vidro Industrial",
    origin: "Rio de Janeiro - RJ",
    destination: "São Paulo - SP",
    cubicMeters: 15,
    weightTon: 5.1,
    orderDate: "2026-09-29",
    forecastDate: "2026-10-06",
    status: "awaiting_document",
    quotes: [
      { id: "q-5844-1", carrier: "FreteMais Express", value: 780, deliveryDays: 2, note: "Fracionado", approved: true },
      { id: "q-5844-2", carrier: "Rota Verde", value: 805, deliveryDays: 2, note: "Fracionado" },
    ],
    treatments: [
      { id: "tr-5844-1", at: "2026-09-29T14:10:00", author: "Maria", note: "FreteMais aprovada. Aguardando CT-e da transportadora." },
    ],
  },
  {
    id: "fp-5845",
    orderNumber: "5845",
    client: "Nova Matéria",
    material: "Borracha",
    origin: "Joinville - SC",
    destination: "Porto Alegre - RS",
    cubicMeters: 12,
    weightTon: 3.4,
    orderDate: "2026-09-22",
    forecastDate: "2026-09-30",
    status: "delivered",
    quotes: [
      { id: "q-5845-1", carrier: "Sul Cargo", value: 560, deliveryDays: 2, note: "Carga dedicada", approved: true },
      { id: "q-5845-2", carrier: "TransLog Sul", value: 610, deliveryDays: 2, note: "Coleta no dia seguinte" },
    ],
    document: {
      fileName: "cte-5845-sul-cargo.pdf",
      cteNumber: "CTE-90210",
      cteValue: 560,
      receivedAt: "2026-09-23T08:50:00",
    },
    treatments: [
      { id: "tr-5845-1", at: "2026-09-23T08:55:00", author: "Financeiro", note: "Valores conferidos e liberados para pagamento." },
      { id: "tr-5845-2", at: "2026-09-30T17:18:00", author: "Motorista", note: "Entrega confirmada com canhoto digital." },
    ],
    delivery: {
      receiverName: "Paulo Nogueira",
      confirmedAt: "2026-09-30T17:18:00",
      signatureData: "",
    },
  },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getApprovedQuote(process: FreightProcess) {
  return process.quotes.find((quote) => quote.approved);
}

function getDifference(process: FreightProcess) {
  const approvedQuote = getApprovedQuote(process);

  if (!approvedQuote || !process.document) {
    return null;
  }

  return process.document.cteValue - approvedQuote.value;
}

function getStatusAfterDocument(process: FreightProcess) {
  const difference = getDifference(process);

  if (difference === null) {
    return process.status;
  }

  return Math.abs(difference) > 5 ? "divergent" : "transport";
}

export default function FreightAudit() {
  const [processes, setProcesses] = useState<FreightProcess[]>(initialFreights);
  const [activeFilter, setActiveFilter] = useState<"all" | FreightStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(initialFreights[0]?.id ?? null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<NewOrderForm>(emptyOrderForm);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuoteForm);
  const [documentForm, setDocumentForm] = useState<DocumentForm>({ fileName: "", cteNumber: "", cteValue: "" });
  const [treatmentNote, setTreatmentNote] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [signatureData, setSignatureData] = useState("");

  const selectedProcess = processes.find((process) => process.id === selectedProcessId) ?? processes[0];

  const counters = useMemo(
    () =>
      processes.reduce(
        (acc, process) => {
          if (process.status === "awaiting_quote") {
            acc.awaitingQuote += 1;
          }

          if (process.status === "quoting" || process.status === "awaiting_document" || process.status === "transport") {
            acc.inProgress += 1;
          }

          if (process.status === "divergent") {
            acc.divergent += 1;
          }

          if (process.status === "delivered") {
            acc.delivered += 1;
          }

          return acc;
        },
        { awaitingQuote: 0, inProgress: 0, divergent: 0, delivered: 0 },
      ),
    [processes],
  );

  const filteredProcesses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return processes.filter((process) => {
      const matchesFilter =
        activeFilter === "all" ||
        process.status === activeFilter ||
        (activeFilter === "transport" &&
          (process.status === "quoting" || process.status === "awaiting_document" || process.status === "transport"));

      const approvedQuote = getApprovedQuote(process);
      const matchesSearch =
        !normalizedSearch ||
        process.orderNumber.toLowerCase().includes(normalizedSearch) ||
        process.client.toLowerCase().includes(normalizedSearch) ||
        approvedQuote?.carrier.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, processes, searchTerm]);

  const openDetails = (processId: string) => {
    setSelectedProcessId(processId);
    setDetailsOpen(true);
  };

  const updateProcess = (processId: string, updater: (process: FreightProcess) => FreightProcess) => {
    setProcesses((current) => current.map((process) => (process.id === processId ? updater(process) : process)));
  };

  const handleCreateOrder = () => {
    if (!newOrderForm.orderNumber.trim() || !newOrderForm.client.trim()) {
      return;
    }

    const newProcess: FreightProcess = {
      id: `fp-${Date.now()}`,
      orderNumber: newOrderForm.orderNumber.trim(),
      client: newOrderForm.client.trim(),
      material: newOrderForm.material.trim() || "Material não informado",
      origin: newOrderForm.origin.trim() || "Origem não informada",
      destination: newOrderForm.destination.trim() || "Destino não informado",
      cubicMeters: Number(newOrderForm.cubicMeters) || 0,
      weightTon: Number(newOrderForm.weightTon) || 0,
      orderDate: new Date().toISOString().slice(0, 10),
      forecastDate: newOrderForm.forecastDate || new Date().toISOString().slice(0, 10),
      status: "awaiting_quote",
      quotes: [],
      treatments: [
        {
          id: `tr-${Date.now()}`,
          at: new Date().toISOString(),
          author: "Sistema",
          note: "Pedido de frete criado e aguardando cotações.",
        },
      ],
    };

    setProcesses((current) => [newProcess, ...current]);
    setSelectedProcessId(newProcess.id);
    setNewOrderForm(emptyOrderForm);
    setNewOrderOpen(false);
    setDetailsOpen(true);
  };

  const handleAddQuote = () => {
    if (!selectedProcess || !quoteForm.carrier.trim() || Number(quoteForm.value) <= 0) {
      return;
    }

    updateProcess(selectedProcess.id, (process) => ({
      ...process,
      status: process.status === "awaiting_quote" ? "quoting" : process.status,
      quotes: [
        ...process.quotes,
        {
          id: `q-${Date.now()}`,
          carrier: quoteForm.carrier.trim(),
          value: Number(quoteForm.value),
          deliveryDays: Number(quoteForm.deliveryDays) || 1,
          note: quoteForm.note.trim() || "Cotação registrada manualmente.",
        },
      ],
    }));
    setQuoteForm(emptyQuoteForm);
    setQuoteOpen(false);
  };

  const approveQuote = (quoteId: string) => {
    if (!selectedProcess) {
      return;
    }

    updateProcess(selectedProcess.id, (process) => ({
      ...process,
      status: "awaiting_document",
      quotes: process.quotes.map((quote) => ({ ...quote, approved: quote.id === quoteId })),
      treatments: [
        ...process.treatments,
        {
          id: `tr-${Date.now()}`,
          at: new Date().toISOString(),
          author: "Faturamento",
          note: "Cotação aprovada e enviada para acompanhamento documental.",
        },
      ],
    }));
  };

  const handleDocumentSimulation = () => {
    if (!selectedProcess || Number(documentForm.cteValue) <= 0) {
      return;
    }

    updateProcess(selectedProcess.id, (process) => {
      const nextProcess: FreightProcess = {
        ...process,
        document: {
          fileName: documentForm.fileName.trim() || `cte-pedido-${process.orderNumber}.pdf`,
          cteNumber: documentForm.cteNumber.trim() || `CTE-${Math.floor(90000 + Math.random() * 900)}`,
          cteValue: Number(documentForm.cteValue),
          receivedAt: new Date().toISOString(),
        },
      };

      const nextStatus = getStatusAfterDocument(nextProcess);

      return {
        ...nextProcess,
        status: nextStatus,
        treatments: [
          ...process.treatments,
          {
            id: `tr-${Date.now()}`,
            at: new Date().toISOString(),
            author: "Financeiro",
            note:
              nextStatus === "divergent"
                ? "Divergência identificada entre cotação aprovada e CT-e recebido."
                : "Documento recebido e valores conferidos.",
          },
        ],
      };
    });
  };

  const handleAddTreatment = () => {
    if (!selectedProcess || !treatmentNote.trim()) {
      return;
    }

    updateProcess(selectedProcess.id, (process) => ({
      ...process,
      treatments: [
        ...process.treatments,
        {
          id: `tr-${Date.now()}`,
          at: new Date().toISOString(),
          author: "Usuário",
          note: treatmentNote.trim(),
        },
      ],
    }));
    setTreatmentNote("");
    setTreatmentOpen(false);
  };

  const handleConfirmDelivery = () => {
    if (!selectedProcess || !receiverName.trim()) {
      return;
    }

    updateProcess(selectedProcess.id, (process) => ({
      ...process,
      status: "delivered",
      delivery: {
        receiverName: receiverName.trim(),
        confirmedAt: new Date().toISOString(),
        signatureData,
      },
      treatments: [
        ...process.treatments,
        {
          id: `tr-${Date.now()}`,
          at: new Date().toISOString(),
          author: "Entregador",
          note: `Entrega confirmada por ${receiverName.trim()} com canhoto digital.`,
        },
      ],
    }));
    setReceiverName("");
    setSignatureData("");
    setDeliveryOpen(false);
  };

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-emerald-200/20 blur-3xl" />

        <CardContent className="relative grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="max-w-3xl space-y-5">
            <Badge className="w-fit rounded-full border border-white/16 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
              <Sparkles className="mr-2 h-4 w-4" />
              Processo logístico centralizado
            </Badge>
            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">Gestão de Fretes</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Acompanhe todo o processo logístico dos pedidos, da cotação à confirmação da entrega.
              </p>
            </div>
          </div>

          <Button className="h-12 rounded-2xl bg-white px-5 text-emerald-800 hover:bg-white/90" onClick={() => setNewOrderOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar pedido
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Aguardando cotação", value: counters.awaitingQuote, icon: FileText, color: "bg-warning/10 text-warning" },
          { label: "Em andamento", value: counters.inProgress, icon: Truck, color: "bg-primary/10 text-primary" },
          { label: "Com divergência", value: counters.divergent, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
          { label: "Entregues no mês", value: counters.delivered, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600" },
        ].map((metric) => (
          <Card key={metric.label} className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{metric.value}</p>
              </div>
              <div className={cn("rounded-2xl p-3", metric.color)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-2xl">Processos de frete por pedido</CardTitle>
              <CardDescription>
                Todas as informações de cotação, documento, transporte e canhoto ficam vinculadas ao mesmo pedido.
              </CardDescription>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar pedido, cliente ou transportadora"
                className="h-11 rounded-2xl pl-9"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={activeFilter === option.value ? "default" : "outline"}
                className="shrink-0 rounded-2xl"
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Transportadora</span>
            <span>Valor aprovado</span>
            <span>CT-e</span>
            <span>Etapa</span>
            <span>Status</span>
            <span>Ação</span>
          </div>

          <div className="space-y-3">
            {filteredProcesses.map((process) => {
              const approvedQuote = getApprovedQuote(process);
              const difference = getDifference(process);
              const status = statusMeta[process.status];
              const hasDivergence = difference !== null && Math.abs(difference) > 5;

              return (
                <article
                  key={process.id}
                  className="rounded-[26px] border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] md:p-5"
                >
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">Pedido #{process.orderNumber}</p>
                        <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                          <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{process.client}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{process.material}</p>
                    </div>

                    <div className="rounded-[22px] bg-muted/20 px-4 py-3">
                      <div className="grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border/60">
                        <div className="min-w-0 sm:pr-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Truck className="h-3.5 w-3.5 text-primary" />
                            <span>Transportadora</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {approvedQuote?.carrier ?? "Não definida"}
                          </p>
                        </div>

                        <div className="min-w-0 sm:px-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                            <span>Financeiro</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {approvedQuote ? formatCurrency(approvedQuote.value) : "Aguardando"}
                            </p>
                            <p className={cn("text-xs", hasDivergence ? "text-destructive" : "text-muted-foreground")}>
                              CT-e: {process.document ? formatCurrency(process.document.cteValue) : "não recebido"}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-0 sm:pl-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Route className="h-3.5 w-3.5 text-primary" />
                            <span>Etapa atual</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-foreground">{flowSteps[statusStepIndex[process.status]]}</p>
                            {hasDivergence && <p className="text-xs text-destructive">Dif.: {formatCurrency(difference)}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <Button type="button" variant="outline" className="w-full rounded-2xl xl:w-auto" onClick={() => openDetails(process.id)}>
                        Ver detalhes
                      </Button>
                    </div>
                  </div>

                  <div className="hidden">
                  <div>
                    <p className="font-semibold text-foreground">Pedido #{process.orderNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{process.material}</p>
                  </div>
                  <p className="text-sm text-foreground">{process.client}</p>
                  <p className="text-sm text-muted-foreground">{approvedQuote?.carrier ?? "Não definida"}</p>
                  <p className="text-sm font-medium text-foreground">{approvedQuote ? formatCurrency(approvedQuote.value) : "Aguardando"}</p>
                  <p className="text-sm font-medium text-foreground">{process.document ? formatCurrency(process.document.cteValue) : "Não recebido"}</p>
                  <p className="text-sm text-muted-foreground">{flowSteps[statusStepIndex[process.status]]}</p>
                  <div>
                    <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                      <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                      {status.label}
                    </Badge>
                    {difference !== null && Math.abs(difference) > 5 && (
                      <p className="mt-1 text-xs text-destructive">Diferença: {formatCurrency(difference)}</p>
                    )}
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => openDetails(process.id)}>
                    Ver detalhes
                  </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedProcess && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto rounded-[32px] p-0">
            <div className="border-b border-border/70 p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">Pedido #{selectedProcess.orderNumber}</DialogTitle>
                <DialogDescription>
                  {selectedProcess.client} • {selectedProcess.destination} • {selectedProcess.cubicMeters} m³ • {formatDate(selectedProcess.orderDate)}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 grid gap-3 md:grid-cols-6">
                {flowSteps.map((step, index) => {
                  const currentStep = statusStepIndex[selectedProcess.status];
                  const isDone = index < currentStep || selectedProcess.status === "delivered";
                  const isCurrent = index === currentStep && selectedProcess.status !== "delivered";

                  return (
                    <div key={step} className="flex items-center gap-3 md:block">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold",
                          isDone && "border-primary bg-primary text-primary-foreground",
                          isCurrent && "border-primary bg-primary/10 text-primary",
                          !isDone && !isCurrent && "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <p className={cn("mt-0 text-sm md:mt-2", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              <Tabs defaultValue="summary" className="space-y-6">
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl p-1">
                  <TabsTrigger value="summary" className="rounded-xl">Resumo</TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-xl">Cotações</TabsTrigger>
                  <TabsTrigger value="documents" className="rounded-xl">Documentos</TabsTrigger>
                  <TabsTrigger value="treatments" className="rounded-xl">Tratativas</TabsTrigger>
                  <TabsTrigger value="delivery" className="rounded-xl">Entrega</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-5">
                  <SummaryTab process={selectedProcess} />
                </TabsContent>

                <TabsContent value="quotes" className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Cotações realizadas</h3>
                      <p className="text-sm text-muted-foreground">Selecione uma cotação para aprovar dentro deste pedido.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => setQuoteOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar cotação
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {selectedProcess.quotes.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                        Nenhuma cotação registrada ainda.
                      </div>
                    ) : (
                      selectedProcess.quotes.map((quote) => (
                        <div
                          key={quote.id}
                          className={cn(
                            "rounded-[24px] border p-4",
                            quote.approved ? "border-primary/35 bg-primary/10" : "border-border/70 bg-background/80",
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{quote.carrier}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{quote.note}</p>
                              <p className="mt-2 text-xs text-muted-foreground">Prazo estimado: {quote.deliveryDays} dia(s)</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xl font-semibold text-foreground">{formatCurrency(quote.value)}</p>
                              {quote.approved ? (
                                <Badge className="mt-2 rounded-full">Aprovada</Badge>
                              ) : (
                                <Button variant="outline" className="mt-2 rounded-2xl" onClick={() => approveQuote(quote.id)}>
                                  Aprovar cotação
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-5">
                  <DocumentTab
                    process={selectedProcess}
                    documentForm={documentForm}
                    setDocumentForm={setDocumentForm}
                    onSimulateDocument={handleDocumentSimulation}
                  />
                </TabsContent>

                <TabsContent value="treatments" className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Tratativas</h3>
                      <p className="text-sm text-muted-foreground">Histórico de ocorrências e comunicações sobre o pedido.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => setTreatmentOpen(true)}>
                      <MessageSquarePlus className="mr-2 h-4 w-4" />
                      Nova tratativa
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedProcess.treatments.map((treatment) => (
                      <div key={treatment.id} className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <p className="text-sm font-semibold text-foreground">{formatDateTime(treatment.at)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{treatment.author}</p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{treatment.note}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="delivery" className="space-y-5">
                  <DeliveryTab process={selectedProcess} onOpenDelivery={() => setDeliveryOpen(true)} />
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Adicionar pedido</DialogTitle>
            <DialogDescription>Crie um processo de frete mockado para demonstrar o fluxo completo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número do pedido" value={newOrderForm.orderNumber} onChange={(value) => setNewOrderForm((current) => ({ ...current, orderNumber: value }))} />
            <Field label="Cliente" value={newOrderForm.client} onChange={(value) => setNewOrderForm((current) => ({ ...current, client: value }))} />
            <Field label="Mercadoria" value={newOrderForm.material} onChange={(value) => setNewOrderForm((current) => ({ ...current, material: value }))} />
            <Field label="Origem" value={newOrderForm.origin} onChange={(value) => setNewOrderForm((current) => ({ ...current, origin: value }))} />
            <Field label="Destino" value={newOrderForm.destination} onChange={(value) => setNewOrderForm((current) => ({ ...current, destination: value }))} />
            <Field label="Cubagem (m³)" value={newOrderForm.cubicMeters} onChange={(value) => setNewOrderForm((current) => ({ ...current, cubicMeters: value }))} type="number" />
            <Field label="Peso (ton)" value={newOrderForm.weightTon} onChange={(value) => setNewOrderForm((current) => ({ ...current, weightTon: value }))} type="number" />
            <Field label="Previsão" value={newOrderForm.forecastDate} onChange={(value) => setNewOrderForm((current) => ({ ...current, forecastDate: value }))} type="date" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setNewOrderOpen(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={handleCreateOrder}>Adicionar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Adicionar cotação</DialogTitle>
            <DialogDescription>Simule uma cotação recebida para o pedido selecionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Transportadora" value={quoteForm.carrier} onChange={(value) => setQuoteForm((current) => ({ ...current, carrier: value }))} />
            <Field label="Valor" value={quoteForm.value} onChange={(value) => setQuoteForm((current) => ({ ...current, value }))} type="number" />
            <Field label="Prazo estimado (dias)" value={quoteForm.deliveryDays} onChange={(value) => setQuoteForm((current) => ({ ...current, deliveryDays: value }))} type="number" />
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={quoteForm.note} onChange={(event) => setQuoteForm((current) => ({ ...current, note: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setQuoteOpen(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={handleAddQuote}>Salvar cotação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={treatmentOpen} onOpenChange={setTreatmentOpen}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Nova tratativa</DialogTitle>
            <DialogDescription>Registre uma observação temporária no histórico do pedido.</DialogDescription>
          </DialogHeader>
          <Textarea value={treatmentNote} onChange={(event) => setTreatmentNote(event.target.value)} placeholder="Descreva a tratativa..." />
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setTreatmentOpen(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={handleAddTreatment}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <DialogDescription>Simule o canhoto digital assinado pelo recebedor.</DialogDescription>
          </DialogHeader>
          {selectedProcess && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-[24px] border border-border/70 bg-muted/20 p-4 sm:grid-cols-3">
                <Info label="Pedido" value={`#${selectedProcess.orderNumber}`} />
                <Info label="Cliente" value={selectedProcess.client} />
                <Info label="Mercadoria" value={selectedProcess.material} />
              </div>
              <Field label="Nome de quem recebeu" value={receiverName} onChange={setReceiverName} />
              <div className="space-y-2">
                <Label>Assinatura do recebedor</Label>
                <SignaturePad value={signatureData} onChange={setSignatureData} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={handleConfirmDelivery}>Confirmar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummaryTab({ process }: { process: FreightProcess }) {
  const approvedQuote = getApprovedQuote(process);
  const difference = getDifference(process);
  const status = statusMeta[process.status];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Cliente" value={process.client} />
        <InfoCard label="Origem" value={process.origin} />
        <InfoCard label="Destino" value={process.destination} />
        <InfoCard label="Cubagem" value={`${process.cubicMeters} m³`} />
        <InfoCard label="Transportadora" value={approvedQuote?.carrier ?? "Não definida"} />
        <InfoCard label="Valor aprovado" value={approvedQuote ? formatCurrency(approvedQuote.value) : "Aguardando"} />
        <InfoCard label="Valor cobrado" value={process.document ? formatCurrency(process.document.cteValue) : "Não recebido"} />
        <InfoCard label="Situação atual" value={status.label} />
      </div>
      <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Resumo da jornada</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              O pedido #{process.orderNumber} está em {status.label.toLowerCase()}.
              {difference !== null
                ? ` A diferença atual entre cotação aprovada e CT-e é de ${formatCurrency(difference)}.`
                : " O CT-e ainda não foi conferido para este pedido."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DocumentTab({
  process,
  documentForm,
  setDocumentForm,
  onSimulateDocument,
}: {
  process: FreightProcess;
  documentForm: DocumentForm;
  setDocumentForm: (value: DocumentForm) => void;
  onSimulateDocument: () => void;
}) {
  const approvedQuote = getApprovedQuote(process);
  const difference = getDifference(process);
  const hasDivergence = difference !== null && Math.abs(difference) > 5;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-8 text-center">
          <UploadCloud className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-4 font-semibold text-foreground">Arraste o documento aqui ou selecione um arquivo</p>
          <p className="mt-2 text-sm text-muted-foreground">Upload visual simulado, sem envio para backend.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Arquivo" value={documentForm.fileName} onChange={(value) => setDocumentForm({ ...documentForm, fileName: value })} />
          <Field label="Número CT-e" value={documentForm.cteNumber} onChange={(value) => setDocumentForm({ ...documentForm, cteNumber: value })} />
          <Field label="Valor CT-e" type="number" value={documentForm.cteValue} onChange={(value) => setDocumentForm({ ...documentForm, cteValue: value })} />
        </div>
        <Button className="rounded-2xl" onClick={onSimulateDocument}>
          <FileCheck2 className="mr-2 h-4 w-4" />
          Simular documento recebido
        </Button>
      </div>

      <div className="rounded-[24px] border border-border/70 bg-background/80 p-5">
        <h3 className="font-semibold text-foreground">CT-e / NF-e da transportadora</h3>
        <div className="mt-4 space-y-3 text-sm">
          <Info label="Valor da cotação aprovada" value={approvedQuote ? formatCurrency(approvedQuote.value) : "Sem cotação aprovada"} />
          <Info label="Valor do CT-e" value={process.document ? formatCurrency(process.document.cteValue) : "Documento não recebido"} />
          {process.document && <Info label="Documento" value={`${process.document.cteNumber} • ${process.document.fileName}`} />}
        </div>
        {difference !== null && (
          <div className={cn("mt-5 rounded-2xl border p-4", hasDivergence ? "border-destructive/25 bg-destructive/10" : "border-primary/25 bg-primary/10")}>
            <p className={cn("font-semibold", hasDivergence ? "text-destructive" : "text-primary")}>
              {hasDivergence ? "Divergência encontrada" : "Valores conferidos"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Diferença: {formatCurrency(difference)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryTab({ process, onOpenDelivery }: { process: FreightProcess; onOpenDelivery: () => void }) {
  if (process.delivery) {
    return (
      <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Signature className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Entrega confirmada</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Recebido por {process.delivery.receiverName} em {formatDateTime(process.delivery.confirmedAt)}.
            </p>
            <Badge className="mt-4 rounded-full">Canhoto digital armazenado</Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-border/70 bg-background/80 p-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Info label="Status" value="Entrega em andamento" />
        <Info label="Previsão" value={formatDate(process.forecastDate)} />
        <Info label="Destino" value={process.destination} />
        <Info label="Transportadora" value={getApprovedQuote(process)?.carrier ?? "Não definida"} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Button className="rounded-2xl" onClick={onOpenDelivery}>
          <Send className="mr-2 h-4 w-4" />
          Registrar aqui
        </Button>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to="/driver/deliveries">Tela do entregador</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to={`/delivery-signature/${process.orderNumber}`}>Link do cliente</Link>
        </Button>
      </div>
    </div>
  );
}
