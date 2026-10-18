import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Clock3,
  Copy,
  Download,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CheckoutShell,
  DemoNotice,
  OrderSummary,
  PaymentEmpty,
  PaymentLoading,
  PaymentPanel,
} from "@/components/payment/CheckoutUI";
import { usePaymentOrder } from "@/hooks/use-payments";
import { formatMoney, isFinalStatus } from "@/lib/payment";
import { cn } from "@/lib/utils";

export default function CheckoutPix() {
  const { orderId } = useParams();
  const {
    data: order,
    isPending,
    error,
    service,
    scope,
    refetch,
  } = usePaymentOrder(orderId);
  const [now, setNow] = useState(Date.now());
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [checked, setChecked] = useState(false);
  const lock = useRef(false);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const copyPaste = order?.pix?.copyPaste;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setQr("");
    setQrError(false);
    if (copyPaste)
      QRCode.toDataURL(copyPaste, {
        width: 720,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#102d25", light: "#ffffff" },
      })
        .then((data) => {
          if (active) setQr(data);
        })
        .catch(() => {
          if (active) setQrError(true);
        });
    return () => {
      active = false;
    };
  }, [copyPaste]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  if (isPending) return <PaymentLoading />;
  if (error || !order)
    return (
      <PaymentEmpty
        message={error?.message ?? "Não foi possível localizar o Pix."}
      />
    );
  if (isFinalStatus(order.status) || order.status === "failed")
    return <Navigate to={`/orders/${order.id}`} replace />;
  if (!order.pix || order.method !== "pix")
    return <Navigate to={`/checkout/payment/${order.id}`} replace />;
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(order.pix.expiresAt) - now) / 1000),
  );
  const expired = remaining <= 0 || order.status === "expired";
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const act = async (action: "renew" | "confirm" | "check") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    setChecked(false);
    try {
      if (action === "check") {
        const result = await refetch();
        if (result.error) throw result.error;
        setChecked(true);
      } else {
        const updated =
          action === "renew"
            ? await service.createPix(order.id)
            : await service.simulateResult!(order.id, "paid");
        cache.setQueryData(["payment-order", scope, order.id], updated);
        void cache.invalidateQueries({ queryKey: ["payment-orders", scope] });
        if (updated.status === "paid") navigate(`/orders/${order.id}`);
        setNow(Date.now());
      }
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o pagamento. Tente novamente.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order.pix!.copyPaste);
      setCopied(true);
      toast.success("Código Pix copiado");
    } catch {
      toast.error(
        "Não foi possível copiar automaticamente. Selecione e copie o código abaixo.",
      );
    }
  };

  return (
    <CheckoutShell
      step={2}
      title={
        expired ? "Vamos gerar um novo Pix?" : "Falta só um Pix para continuar."
      }
      description={
        expired
          ? "O prazo deste código terminou. Gere outro código para retomar o pagamento do mesmo pedido."
          : "Escaneie o QR Code ou copie o código para pagar pelo aplicativo do seu banco."
      }
      backTo={`/checkout/payment/${order.id}`}
      backLabel="Escolher outro método"
    >
      <div className="mb-6">
        <DemoNotice>
          Este QR Code e o código de copiar são demonstrativos e não realizam
          pagamentos. Você pode simular a confirmação abaixo.
        </DemoNotice>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <PaymentPanel
            title="Pague com Pix"
            description={`Pedido ${order.number}`}
            icon={<QrCode className="h-5 w-5" />}
          >
            <div className="flex flex-col items-center">
              <p className="text-sm text-muted-foreground">
                Valor do pagamento
              </p>
              <p className="mb-5 mt-1 text-3xl font-extrabold tracking-tight">
                {formatMoney(order.totalCents)}
              </p>
              <div
                className={cn(
                  "relative flex h-64 w-64 max-w-full items-center justify-center rounded-2xl border-2 border-primary/20 bg-white p-2",
                  expired && "border-border",
                )}
              >
                {qr ? (
                  <img
                    src={qr}
                    alt="QR Code do Pix demonstrativo"
                    className={cn(
                      "h-full w-full rounded-xl object-contain",
                      expired && "opacity-10 blur-sm",
                    )}
                  />
                ) : qrError ? (
                  <p
                    role="alert"
                    className="p-4 text-center text-sm text-slate-700"
                  >
                    Não foi possível renderizar o QR Code. Use o código copia e
                    cola abaixo.
                  </p>
                ) : (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                )}
                {expired ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-slate-800">
                    <Clock3 className="h-8 w-8" />
                    <p className="font-bold">QR Code expirado</p>
                    <Button
                      disabled={busy}
                      onClick={() => void act("renew")}
                      className="rounded-xl"
                    >
                      <RefreshCw className={cn(busy && "animate-spin")} />
                      Gerar novo Pix
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "mb-5 mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold",
                  expired
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {expired ? (
                  "Código expirado"
                ) : (
                  <>
                    Expira em{" "}
                    <span
                      className="font-mono tabular-nums"
                      data-testid="pix-countdown"
                    >
                      {minutes}:{seconds}
                    </span>
                  </>
                )}
              </div>
              {!expired ? (
                <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                  {qr ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                    >
                      <a href={qr} download={`pix-demo-${order.number}.png`}>
                        <Download />
                        Baixar QR Code
                      </a>
                    </Button>
                  ) : null}
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Aguardando pagamento
                  </span>
                </div>
              ) : null}
            </div>
            <div className="border-t border-dashed border-border pt-5">
              <label htmlFor="pix-code" className="text-sm font-bold">
                Prefere copiar o código?
              </label>
              <p className="mb-3 mt-1 text-xs text-muted-foreground">
                Cole o código completo na opção Pix copia e cola do seu banco.
              </p>
              <textarea
                id="pix-code"
                readOnly
                value={order.pix.copyPaste}
                className="min-h-20 w-full resize-none rounded-xl border border-input bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onFocus={(e) => e.target.select()}
              />
              <Button
                disabled={expired}
                onClick={() => void copy()}
                variant="outline"
                className="mt-3 h-12 w-full rounded-xl border-primary/30 text-primary"
              >
                {copied ? <CheckCheck /> : <Copy />}
                {copied ? "Código copiado!" : "Copiar código Pix"}
              </Button>
            </div>
            {actionError ? (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive"
              >
                {actionError}
              </p>
            ) : null}
            <Button
              disabled={busy || expired}
              variant="ghost"
              className="mt-3 w-full rounded-xl text-xs"
              onClick={() => void act("check")}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", busy && "animate-spin")}
              />
              Já paguei, verificar status
            </Button>
            {checked ? (
              <p
                role="status"
                className="mt-2 text-center text-xs text-muted-foreground"
              >
                Ainda aguardando a confirmação. Esta página verifica o status
                automaticamente.
              </p>
            ) : null}
            {service.mode === "demo" && service.simulateResult ? (
              <div className="mt-5 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  Quer conhecer o restante do fluxo? Confirme um pagamento de
                  teste.
                </p>
                <Button
                  disabled={busy || expired}
                  onClick={() => void act("confirm")}
                  className="h-11 w-full rounded-xl"
                >
                  <Check />
                  Simular pagamento recebido
                </Button>
              </div>
            ) : null}
          </PaymentPanel>
          <PaymentPanel
            title="É simples pagar com Pix"
            icon={<Smartphone className="h-5 w-5" />}
          >
            <ol className="space-y-4">
              {[
                "Abra o aplicativo do seu banco e escolha Pix.",
                "Escaneie o QR Code ou escolha Pix copia e cola.",
                "Confira o valor e o destinatário antes de confirmar.",
                "Volte para cá. A confirmação aparece nesta página.",
              ].map((text, i) => (
                <li
                  key={text}
                  className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </PaymentPanel>
        </div>
        <OrderSummary
          item={order.item}
          quantity={order.quantity}
          totalCents={order.totalCents}
        >
          <Button asChild variant="ghost" className="w-full rounded-xl text-xs">
            <Link to={`/orders/${order.id}`}>Acompanhar meu pedido</Link>
          </Button>
        </OrderSummary>
      </div>
    </CheckoutShell>
  );
}
