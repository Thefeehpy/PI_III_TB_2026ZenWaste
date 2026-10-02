import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock3, FileCheck2, MapPin, PackageCheck, ShieldCheck, Signature, Truck } from "lucide-react";

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
  },
];

export default function ClientDeliverySignature() {
  const { orderNumber } = useParams();
  const delivery = useMemo(
    () => deliveryLinks.find((item) => item.orderNumber === orderNumber) ?? deliveryLinks[0],
    [orderNumber],
  );
  const [receiverName, setReceiverName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const canConfirm = Boolean(receiverName.trim());

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
              <CardDescription>{delivery.client} • {delivery.material}</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/10 text-primary">
              Aguardando assinatura
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <Info icon={Truck} label="Transportadora" value={delivery.carrier} />
              <Info icon={MapPin} label="Destino" value={delivery.destination} />
              <Info icon={Clock3} label="Previsão" value={delivery.forecast} />
              <Info icon={PackageCheck} label="Mercadoria" value={delivery.volume} />
              <Info icon={FileCheck2} label="Documento" value={delivery.invoice} />
            </div>

            {confirmed ? (
              <div className="rounded-[28px] border border-emerald-500/25 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">Entrega confirmada</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Obrigado, {receiverName}. O canhoto digital foi registrado no processo do pedido.
                    </p>
                    <Badge className="mt-4 rounded-full">Assinatura registrada</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 rounded-[28px] border border-border/70 bg-muted/20 p-5">
                <div className="flex items-center gap-3">
                  <Signature className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Assinatura do recebedor</p>
                    <p className="text-sm text-muted-foreground">A assinatura substitui o canhoto físico em papel.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-receiver-name">Nome de quem recebeu</Label>
                  <Input
                    id="client-receiver-name"
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    placeholder="Nome completo"
                    className="h-12 rounded-2xl"
                  />
                </div>

                <SignaturePad value={signatureData} onChange={setSignatureData} />

                <Button className="h-12 w-full rounded-2xl" disabled={!canConfirm} onClick={() => setConfirmed(true)}>
                  Confirmar recebimento
                </Button>
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
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
