import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FlaskConical,
  Leaf,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  calculateTotal,
  formatMoney,
  formatQuantity,
  statusLabels,
} from "@/lib/payment";
import { cn } from "@/lib/utils";
import type { WasteItem } from "@/data/mockData";
import type { OrderStatus } from "@/types/payment";

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Ambiente de demonstração.</strong>{" "}
        {children ??
          "Nenhuma cobrança será realizada. Use apenas dados de teste para experimentar a compra."}
      </p>
    </div>
  );
}

export function CheckoutShell({
  step,
  title,
  description,
  backTo = "/marketplace",
  backLabel = "Voltar ao marketplace",
  children,
}: {
  step: number;
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [title]);
  return (
    <div className="payment-page min-h-[calc(100vh-4rem)] pb-12">
      <div className="container max-w-6xl px-4 pt-6 sm:px-8 sm:pt-8">
        <Link
          to={backTo}
          className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <ShoppingBag className="h-4 w-4" />
              Checkout ZenWaste
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary lg:flex">
            <ShieldCheck className="h-4 w-4" />
            Tudo em um só lugar
          </div>
        </div>
        <ol
          aria-label="Etapas da compra"
          className="mb-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card/80 p-2 sm:p-3"
        >
          {["Sua compra", "Pagamento", "Confirmação"].map((label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-1 py-3 text-xs font-semibold sm:gap-3 sm:text-sm",
                step === index + 1
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] sm:h-7 sm:w-7",
                  step >= index + 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {step > index + 1 ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        {children}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            Uma nova vida para os materiais. Novas possibilidades para o seu
            negócio.
          </span>
          <span>ZenWaste · Economia circular</span>
        </footer>
      </div>
    </div>
  );
}

export function PaymentPanel({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7",
        className,
      )}
    >
      <div className="mb-6 flex items-start gap-3">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function OrderSummary({
  item,
  quantity,
  totalCents = calculateTotal(item.price, quantity),
  children,
}: {
  item: WasteItem;
  quantity: number;
  totalCents?: number;
  children?: ReactNode;
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-bold">Resumo da compra</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada material conta. Cada escolha também.
          </p>
        </div>
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-4">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-20 w-20 shrink-0 rounded-xl bg-muted object-cover"
            />
            <div className="min-w-0">
              <Badge
                variant="secondary"
                className="mb-2 bg-accent text-[10px] text-accent-foreground"
              >
                {item.type}
              </Badge>
              <p className="text-sm font-bold leading-snug">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.company}
              </p>
            </div>
          </div>
          <dl className="space-y-3 border-y border-dashed border-border py-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Quantidade</dt>
              <dd className="font-semibold">
                {formatQuantity(quantity)} {item.unit}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Valor por {item.unit}</dt>
              <dd>{formatMoney(Math.round(item.price * 100))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatMoney(totalCents)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Entrega</dt>
              <dd className="text-right">Retirada no local</dd>
            </div>
          </dl>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Total a pagar</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Frete não incluso
              </p>
            </div>
            <p
              className="text-2xl font-extrabold tracking-tight text-primary"
              data-testid="order-total"
            >
              {formatMoney(totalCents)}
            </p>
          </div>
          {children}
          <div className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Retirada em{" "}
              <strong className="font-medium text-foreground">
                {item.location}
              </strong>
              . A logística será combinada com o vendedor após a compra.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <Leaf className="h-8 w-8 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-bold text-primary">
            Bom para o seu negócio. Melhor para o planeta.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Você está colocando materiais de volta na cadeia produtiva.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-3 py-1 text-[11px]",
        status === "paid"
          ? "border-primary/25 bg-primary/10 text-primary"
          : status === "failed" || status === "canceled"
            ? "border-destructive/20 bg-destructive/5 text-destructive"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </Badge>
  );
}

export function PaymentLoading() {
  return (
    <div
      className="container flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Preparando sua compra…</p>
    </div>
  );
}

export function PaymentEmpty({
  title = "Pedido não encontrado",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="container flex min-h-[60vh] max-w-xl flex-col items-center justify-center py-12 text-center">
      <div className="mb-5 rounded-2xl bg-primary/10 p-5">
        <Package className="h-9 w-9 text-primary" />
      </div>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Button asChild>
        <Link to="/marketplace">
          Explorar marketplace
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id: string;
  children?: string;
}) {
  return children ? (
    <p id={id} className="mt-1.5 text-xs text-destructive">
      {children}
    </p>
  ) : null;
}
