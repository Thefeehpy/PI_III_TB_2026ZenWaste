import { useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  QrCode,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPaymentForm } from "@/components/payment/CardPaymentForm";
import {
  CheckoutShell,
  DemoNotice,
  OrderSummary,
  PaymentEmpty,
  PaymentLoading,
  PaymentPanel,
} from "@/components/payment/CheckoutUI";
import { usePaymentOrder } from "@/hooks/use-payments";
import {
  cardBrand,
  formatMoney,
  isFinalStatus,
  type CardDraft,
} from "@/lib/payment";
import { cn } from "@/lib/utils";
import type { PaymentMethod, PaymentOrder } from "@/types/payment";

const methods = [
  {
    id: "credit" as const,
    label: "Crédito",
    detail: "À vista ou parcelado",
    icon: CreditCard,
  },
  {
    id: "debit" as const,
    label: "Débito",
    detail: "Pagamento à vista",
    icon: Banknote,
  },
  {
    id: "pix" as const,
    label: "Pix",
    detail: "QR Code ou copia e cola",
    icon: QrCode,
  },
];

export default function CheckoutPayment() {
  const { orderId } = useParams();
  const {
    data: order,
    isPending,
    error,
    service,
    scope,
  } = usePaymentOrder(orderId);
  const [method, setMethod] = useState<PaymentMethod>("credit");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const navigate = useNavigate();
  const cache = useQueryClient();
  const locked = useRef(false);
  const key = useRef(crypto.randomUUID());
  if (isPending) return <PaymentLoading />;
  if (error || !order)
    return (
      <PaymentEmpty
        message={error?.message ?? "Este pedido não está disponível."}
      />
    );
  if (
    isFinalStatus(order.status) ||
    (order.status === "pending" && order.method !== "pix")
  )
    return <Navigate to={`/orders/${order.id}`} replace />;

  const finish = (updated: PaymentOrder, destination: string) => {
    cache.setQueryData(["payment-order", scope, updated.id], updated);
    void cache.invalidateQueries({ queryKey: ["payment-orders", scope] });
    navigate(destination);
  };
  const payCard = async (
    card: CardDraft,
    installments: number,
    decline: boolean,
  ) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setActionError("");
    try {
      // Replace this demo token with the PSP's browser SDK/hosted-fields token. Never persist card input.
      if (service.mode !== "demo")
        throw new Error(
          "O formulário seguro do provedor de pagamentos ainda não foi conectado.",
        );
      const updated = await service.payWithCard(order.id, {
        method: method === "debit" ? "debit" : "credit",
        token: `demo_${decline ? "declined" : "approved"}_${crypto.randomUUID()}`,
        brand: cardBrand(card.number),
        last4: card.number.replace(/\D/g, "").slice(-4),
        installments,
        idempotencyKey: key.current,
      });
      finish(updated, `/orders/${order.id}`);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível processar. Tente novamente.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
    }
  };
  const payPix = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setActionError("");
    try {
      const updated = await service.createPix(order.id);
      finish(updated, `/checkout/pix/${order.id}`);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o Pix.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
    }
  };

  return (
    <CheckoutShell
      step={2}
      title="Do seu jeito. Dentro da ZenWaste."
      description="Escolha como pagar e dê o próximo passo para transformar materiais em oportunidades."
      backTo={`/orders/${order.id}`}
      backLabel="Ver meu pedido"
    >
      <div className="mb-6">
        <DemoNotice />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <PaymentPanel
            title="Como você prefere pagar?"
            description={`Pedido ${order.number} · Escolha uma das opções abaixo.`}
            icon={<CreditCard className="h-5 w-5" />}
          >
            <fieldset
              disabled={busy}
              className="mb-7 grid grid-cols-3 gap-2 sm:gap-3"
            >
              <legend className="sr-only">Método de pagamento</legend>
              {methods.map(({ id, label, detail, icon: Icon }) => (
                <label
                  key={id}
                  className={cn(
                    "relative cursor-pointer rounded-xl border p-3 transition-all sm:p-4",
                    method === id
                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={id}
                    checked={method === id}
                    onChange={() => {
                      setMethod(id);
                      setActionError("");
                      key.current = crypto.randomUUID();
                    }}
                    className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
                  <Icon
                    className={cn(
                      "mb-3 h-5 w-5",
                      method === id ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {method === id ? (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="mt-1 hidden text-[10px] leading-relaxed text-muted-foreground sm:block">
                    {detail}
                  </span>
                </label>
              ))}
            </fieldset>
            {actionError ? (
              <p
                role="alert"
                className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {actionError}
              </p>
            ) : null}
            {method === "pix" ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center rounded-2xl border border-primary/15 bg-primary/5 px-5 py-8 text-center">
                  <div className="mb-4 rounded-2xl bg-primary/10 p-4">
                    <QrCode className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">
                    Praticidade que combina com você.
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Gere o QR Code, escaneie pelo aplicativo do seu banco ou use
                    o Pix copia e cola.
                  </p>
                  <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-primary">
                    <Zap className="h-4 w-4" />
                    Código disponível por 15 minutos
                  </p>
                </div>
                <Button
                  disabled={busy}
                  onClick={payPix}
                  className="h-12 w-full rounded-xl font-bold"
                >
                  {busy
                    ? "Gerando código…"
                    : `Gerar Pix de ${formatMoney(order.totalCents)}`}
                  <ArrowRight />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  A confirmação aparece automaticamente quando o pagamento é
                  recebido.
                </p>
              </div>
            ) : (
              <CardPaymentForm
                key={method}
                method={method}
                busy={busy}
                totalCents={order.totalCents}
                demo={service.mode === "demo"}
                onPay={payCard}
              />
            )}
          </PaymentPanel>
          <div className="flex flex-wrap justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>
              Comprador:{" "}
              <strong className="font-medium text-foreground">
                {order.buyer.name}
              </strong>
            </span>
            <Link
              to={`/orders/${order.id}`}
              className="text-primary hover:underline"
            >
              Conferir dados do pedido
            </Link>
          </div>
        </div>
        <OrderSummary
          item={order.item}
          quantity={order.quantity}
          totalCents={order.totalCents}
        />
      </div>
    </CheckoutShell>
  );
}
