import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Signature,
  Truck,
} from "lucide-react";

import { SignaturePad } from "@/components/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const deliveryLinks = [
  {
    orderNumber: "5842",
    client: "Empresa ABC",
    material: "Plástico Industrial",
    carrier: "Rodonaves",
    destination: "Av. das Indústrias, 420 - Curitiba - PR",
    forecast: "02/10/2026 às 14:30",
    volume: "24 m³ / 6,5 ton",
    invoice: "NF-e 11892",
    token: "canhoto-5842-rota-segura",
    authorizedReceiverName: "Maria Souza",
    authorizedReceiverCpf: "123.456.789-01",
  },
  {
    orderNumber: "5846",
    client: "GreenSupply B2B",
    material: "Papel e Papelão",
    carrier: "Rota Verde Transportes",
    destination: "Rua Anhanguera, 1180 - Campinas - SP",
    forecast: "02/10/2026 às 16:00",
    volume: "18 m³ / 4,1 ton",
    invoice: "NF-e 11904",
    token: "canhoto-5846-coleta-verde",
    authorizedReceiverName: "Carlos Andrade",
    authorizedReceiverCpf: "987.654.321-00",
  },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatCpf(value: string) {
  const digits = onlyDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCpf(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) {
    return value;
  }

  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function normalizeName(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export default function ClientDeliverySignature() {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const delivery = useMemo(() => {
    const knownDelivery = deliveryLinks.find((item) => item.orderNumber === orderNumber);

    if (knownDelivery) {
      return knownDelivery;
    }

    const fallbackOrderNumber = orderNumber ?? "pedido";

    return {
      orderNumber: fallbackOrderNumber,
      client: "Cliente do pedido",
      material: "Carga vinculada ao frete",
      carrier: "Transportadora definida no processo",
      destination: "Destino informado no pedido",
      forecast: "Previsão do processo de frete",
      volume: "Volumes e peso do pedido",
      invoice: "Documento vinculado",
      token: `canhoto-${fallbackOrderNumber}-preview`,
      authorizedReceiverName: "Maria Souza",
      authorizedReceiverCpf: "123.456.789-01",
    };
  }, [orderNumber]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverCpf, setReceiverCpf] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [identityReleased, setIdentityReleased] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [receiptType, setReceiptType] = useState<"complete" | "with_reservation">("complete");
  const [reservationNote, setReservationNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const token = searchParams.get("token") || delivery.token;
  const tokenIsValid = token === delivery.token;
  const isIdentityReady = Boolean(receiverName.trim() && onlyDigits(receiverCpf).length === 11);
  const canConfirm = Boolean(identityReleased && signatureData);

  const resetIdentityRelease = () => {
    setIdentityReleased(false);
    setIdentityError("");
    setSignatureData("");
    setReceiptType("complete");
    setReservationNote("");
  };

  const handleReleaseSignature = () => {
    if (!isIdentityReady) {
      return;
    }

    if (!tokenIsValid) {
      setIdentityReleased(false);
      setIdentityError("Este QR Code não pertence ao pedido selecionado.");
      return;
    }

    const nameMatches = normalizeName(receiverName) === normalizeName(delivery.authorizedReceiverName);
    const cpfMatches = onlyDigits(receiverCpf) === onlyDigits(delivery.authorizedReceiverCpf);

    if (!nameMatches || !cpfMatches) {
      setIdentityReleased(false);
      setSignatureData("");
      setIdentityError("Nome ou CPF não conferem com o recebedor cadastrado para este pedido.");
      return;
    }

    setIdentityError("");
    setIdentityReleased(true);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Badge className="rounded-full border border-white/20 bg-white/12 text-white hover:bg-white/12">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Canhoto digital seguro
          </Badge>
          <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Confirmação de entrega</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
            Confira os dados do pedido e assine digitalmente para registrar o recebimento da mercadoria.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="rounded-[32px] border-border/70 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-2xl">Pedido #{delivery.orderNumber}</CardTitle>
              <CardDescription>
                {delivery.client} • {delivery.material}
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/10 text-primary">
              {identityReleased ? "Aguardando assinatura" : "Aguardando identificação"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <Info icon={Truck} label="Transportadora" value={delivery.carrier} />
              <Info icon={MapPin} label="Destino" value={delivery.destination} />
              <Info icon={Clock3} label="Previsão" value={delivery.forecast} />
              <Info icon={PackageCheck} label="Mercadoria" value={delivery.volume} />
              <Info icon={FileCheck2} label="Documento" value={delivery.invoice} />
              <Info icon={ShieldCheck} label="Validação do QR Code" value={tokenIsValid ? "QR Code válido" : "QR Code inválido"} />
            </div>

            {confirmed ? (
              <div className="rounded-[28px] border border-emerald-500/25 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">Entrega confirmada</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Obrigado, {receiverName}. O canhoto digital foi registrado no processo do pedido com CPF{" "}
                      {maskCpf(receiverCpf)}.
                    </p>
                    {receiptType === "with_reservation" && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Ressalva registrada: {reservationNote || "sem observação detalhada"}.
                      </p>
                    )}
                    <Badge className="mt-4 rounded-full">Assinatura registrada</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--card)))] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Identificação do recebedor</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Informe os dados de quem está recebendo a mercadoria para liberar a assinatura do canhoto.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
                    <div className="space-y-2">
                      <Label htmlFor="client-receiver-name">Nome de quem recebeu</Label>
                      <Input
                        id="client-receiver-name"
                        value={receiverName}
                        onChange={(event) => {
                          resetIdentityRelease();
                          setReceiverName(event.target.value);
                        }}
                        placeholder="Nome completo"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-receiver-cpf">CPF</Label>
                      <Input
                        id="client-receiver-cpf"
                        inputMode="numeric"
                        value={receiverCpf}
                        onChange={(event) => {
                          resetIdentityRelease();
                          setReceiverCpf(formatCpf(event.target.value));
                        }}
                        placeholder="000.000.000-00"
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>

                  {identityError && (
                    <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                      {identityError}
                    </div>
                  )}

                  <Button
                    type="button"
                    className="mt-5 h-12 w-full rounded-2xl"
                    disabled={!isIdentityReady}
                    onClick={handleReleaseSignature}
                  >
                    {identityReleased ? "Assinatura liberada" : "Liberar assinatura"}
                  </Button>
                </div>

                <div
                  className={`space-y-5 rounded-[28px] border p-5 transition-all ${
                    identityReleased
                      ? "border-border/70 bg-muted/20"
                      : "border-border/60 bg-muted/10 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Signature className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Assinatura do recebedor</p>
                      <p className="text-sm text-muted-foreground">
                        {identityReleased
                          ? "Assine no campo abaixo para finalizar o recebimento."
                          : "Preencha nome e CPF para liberar este campo."}
                      </p>
                    </div>
                  </div>

                  {identityReleased ? (
                    <>
                      <div className="space-y-3">
                        <Label>Tipo de recebimento</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant={receiptType === "complete" ? "default" : "outline"}
                            className="rounded-2xl"
                            onClick={() => setReceiptType("complete")}
                          >
                            Recebimento completo
                          </Button>
                          <Button
                            type="button"
                            variant={receiptType === "with_reservation" ? "default" : "outline"}
                            className="rounded-2xl"
                            onClick={() => setReceiptType("with_reservation")}
                          >
                            Com ressalva
                          </Button>
                        </div>
                        {receiptType === "with_reservation" && (
                          <textarea
                            value={reservationNote}
                            onChange={(event) => setReservationNote(event.target.value)}
                            placeholder="Descreva divergência, avaria, falta ou observação da entrega."
                            className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                        )}
                      </div>

                      <SignaturePad value={signatureData} onChange={setSignatureData} />

                      <Button
                        className="h-12 w-full rounded-2xl"
                        disabled={!canConfirm}
                        onClick={() => setConfirmed(true)}
                      >
                        Confirmar recebimento
                      </Button>
                    </>
                  ) : (
                    <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-border bg-background/70 text-center text-sm text-muted-foreground">
                      Assinatura bloqueada até a identificação do recebedor.
                    </div>
                  )}
                </div>
              </div>
            )}
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
  icon: typeof Truck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
