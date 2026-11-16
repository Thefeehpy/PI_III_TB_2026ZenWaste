import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import { useOrderReceiver } from "@/hooks/use-order-receiver";
import {
  getDeliverySignaturePath,
  maskReceiverCpf,
  saveOrderReceiver,
  validateReceiver,
  type DeliveryOrderSummary,
  type OrderReceiver,
} from "@/lib/order-receiver";
import { formatCPF } from "@/utils/input-masks";

interface RegistrationProps {
  orderNumber: string;
  summary: DeliveryOrderSummary;
}

export function OrderReceiverRegistration(props: RegistrationProps) {
  const receiver = useOrderReceiver(props.orderNumber);
  return <ReceiverForm key={`${props.orderNumber}:${receiver?.name}:${receiver?.cpf}`} {...props} receiver={receiver} />;
}

function ReceiverForm({ orderNumber, summary, receiver }: RegistrationProps & { receiver: OrderReceiver | null }) {
  const id = useId();
  const [name, setName] = useState(receiver?.name ?? "");
  const [cpf, setCpf] = useState(receiver?.cpf ?? "");
  const [errors, setErrors] = useState<Partial<Record<"name" | "cpf", string>>>({});
  const [saveError, setSaveError] = useState("");
  const hasChanges = name.trim().replace(/\s+/g, " ") !== receiver?.name
    || cpf.replace(/\D/g, "") !== receiver?.cpf;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateReceiver({ name, cpf });
    setErrors(nextErrors);
    setSaveError("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      document.getElementById(`${id}-${firstError}`)?.focus();
      return;
    }
    try {
      saveOrderReceiver(orderNumber, { name, cpf, summary });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o recebedor.");
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h3 id={`${id}-title`} className="text-lg font-semibold text-foreground">Recebedor autorizado</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cadastre quem poderá receber a mercadoria do pedido {orderNumber} e assinar o canhoto digital.
          </p>
        </div>
      </div>

      {receiver && (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Recebedor cadastrado: {receiver.name} · CPF {maskReceiverCpf(receiver.cpf)}
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${id}-name`}>Nome completo do recebedor</Label>
            <Input
              id={`${id}-name`}
              value={name}
              autoComplete="name"
              maxLength={120}
              placeholder="Nome e sobrenome"
              className="h-12 rounded-xl"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
                setSaveError("");
              }}
            />
            {errors.name && <p id={`${id}-name-error`} className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-cpf`}>CPF do recebedor</Label>
            <MaskedInput
              id={`${id}-cpf`}
              value={cpf}
              formatValue={formatCPF}
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              className="h-12 rounded-xl"
              aria-invalid={Boolean(errors.cpf)}
              aria-describedby={errors.cpf ? `${id}-cpf-error` : undefined}
              onValueChange={(value) => {
                setCpf(value);
                setErrors((current) => ({ ...current, cpf: undefined }));
                setSaveError("");
              }}
            />
            {errors.cpf && <p id={`${id}-cpf-error`} className="text-sm text-destructive">{errors.cpf}</p>}
          </div>
        </div>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="submit" disabled={Boolean(receiver) && !hasChanges} className="h-11 rounded-xl">
            {receiver ? "Salvar alterações" : "Salvar recebedor"}
          </Button>
          {receiver && !hasChanges && (
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link to={getDeliverySignaturePath(orderNumber)}>
                Abrir assinatura do pedido <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
        {receiver && hasChanges && (
          <p className="text-xs text-muted-foreground">Salve as alterações para usar o novo recebedor na assinatura.</p>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          Na entrega, nome e CPF serão conferidos com este cadastro. Nesta demonstração, os dados ficam salvos
          apenas neste navegador; abra a assinatura nele para testar.
        </p>
      </form>
    </section>
  );
}
