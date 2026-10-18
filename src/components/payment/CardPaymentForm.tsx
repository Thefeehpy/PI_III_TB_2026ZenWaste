import { useState, type FormEvent } from "react";
import { CreditCard, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/payment/CheckoutUI";
import {
  cardBrand,
  formatMoney,
  validateCard,
  type CardDraft,
} from "@/lib/payment";

const emptyCard: CardDraft = { number: "", holder: "", expiry: "", cvv: "" };

export function CardPaymentForm({
  method,
  totalCents,
  busy,
  demo,
  onPay,
}: {
  method: "credit" | "debit";
  totalCents: number;
  busy: boolean;
  demo: boolean;
  onPay: (
    card: CardDraft,
    installments: number,
    decline: boolean,
  ) => Promise<void>;
}) {
  const [card, setCard] = useState<CardDraft>(emptyCard);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CardDraft, string>>
  >({});
  const [installments, setInstallments] = useState(1);
  const [visible, setVisible] = useState(false);
  const [decline, setDecline] = useState(false);
  const brand = cardBrand(card.number);
  const update = (field: keyof CardDraft, value: string) => {
    setCard((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const next = validateCard(card);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`card-${first}`)?.focus();
      return;
    }
    const submitted = { ...card };
    setCard(emptyCard);
    await onPay(submitted, method === "debit" ? 1 : installments, decline);
  };

  return (
    <form id="card-payment" onSubmit={submit} noValidate className="space-y-5">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
        <div
          className="payment-bank-card relative mx-auto mb-7 w-full max-w-sm overflow-hidden rounded-2xl p-6 text-white shadow-lg"
          aria-hidden="true"
        >
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-sm font-bold tracking-wide">
              ZenWaste<span className="ml-2 font-normal opacity-60">pay</span>
            </span>
            <span className="text-xs font-bold">
              {brand === "Cartão" ? "" : brand.toUpperCase()}
            </span>
          </div>
          <div className="relative z-10 my-6 flex items-center gap-3">
            <span className="h-7 w-9 rounded-md border border-amber-200/40 bg-gradient-to-br from-amber-100/70 to-amber-600/40" />
            <CreditCard className="h-5 w-5 text-white/40" />
          </div>
          <p className="relative z-10 font-mono text-lg tracking-[0.15em] sm:text-xl">
            •••• •••• ••••{" "}
            {card.number.replace(/\D/g, "").slice(-4).padStart(4, "•")}
          </p>
          <div className="relative z-10 mt-5 flex justify-between gap-4 text-[10px] uppercase tracking-widest">
            <span className="truncate">{card.holder || "Nome no cartão"}</span>
            <span className="shrink-0">{card.expiry || "MM/AA"}</span>
          </div>
        </div>
        {demo ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-3 text-xs">
            <span className="text-muted-foreground">
              Experimente com um cartão fictício
            </span>
            <button
              type="button"
              className="font-bold text-primary hover:underline"
              onClick={() => {
                setCard({
                  number: "4242 4242 4242 4242",
                  holder: "EMPRESA DEMONSTRACAO",
                  expiry: `12/${String(new Date().getFullYear() + 2).slice(-2)}`,
                  cvv: "123",
                });
                setErrors({});
              }}
            >
              Preencher dados de teste
            </button>
          </div>
        ) : null}
        <div>
          <Label htmlFor="card-number">Número do cartão</Label>
          <div className="relative mt-2">
            <Input
              id="card-number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000 0000"
              className="payment-input pr-12"
              value={card.number}
              aria-invalid={!!errors.number}
              aria-describedby={errors.number ? "error-number" : undefined}
              onChange={(e) =>
                update(
                  "number",
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 19)
                    .replace(/(\d{4})(?=\d)/g, "$1 "),
                )
              }
            />
            <CreditCard className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground" />
          </div>
          <FieldError id="error-number">{errors.number}</FieldError>
        </div>
        <div>
          <Label htmlFor="card-holder">Nome impresso no cartão</Label>
          <Input
            id="card-holder"
            autoComplete="off"
            placeholder="Como aparece no cartão"
            className="payment-input mt-2 uppercase"
            value={card.holder}
            maxLength={80}
            aria-invalid={!!errors.holder}
            aria-describedby={errors.holder ? "error-holder" : undefined}
            onChange={(e) => update("holder", e.target.value)}
          />
          <FieldError id="error-holder">{errors.holder}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="card-expiry">Validade</Label>
            <Input
              id="card-expiry"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/AA"
              className="payment-input mt-2"
              value={card.expiry}
              aria-invalid={!!errors.expiry}
              aria-describedby={errors.expiry ? "error-expiry" : undefined}
              onChange={(e) =>
                update(
                  "expiry",
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                    .replace(/^(\d{2})(\d)/, "$1/$2"),
                )
              }
            />
            <FieldError id="error-expiry">{errors.expiry}</FieldError>
          </div>
          <div>
            <Label htmlFor="card-cvv">Código de segurança</Label>
            <div className="relative mt-2">
              <Input
                id="card-cvv"
                type={visible ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                placeholder="CVV"
                className="payment-input pr-12"
                value={card.cvv}
                aria-invalid={!!errors.cvv}
                aria-describedby={errors.cvv ? "error-cvv" : undefined}
                onChange={(e) =>
                  update("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={
                  visible
                    ? "Ocultar código de segurança"
                    : "Mostrar código de segurança"
                }
                className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-xl text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {visible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <FieldError id="error-cvv">{errors.cvv}</FieldError>
          </div>
        </div>
        {method === "credit" ? (
          <div>
            <Label htmlFor="installments">Parcelamento</Label>
            <select
              id="installments"
              className="payment-input mt-2 w-full border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
            >
              {[1, 2, 3, 6, 12]
                .filter(
                  (count) =>
                    count === 1 || Math.floor(totalCents / count) >= 100,
                )
                .map((count) => (
                  <option key={count} value={count}>
                    {count}x de {formatMoney(Math.floor(totalCents / count))}
                    {count === 1 ? " · à vista" : " · sem juros (demonstração)"}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Total de {formatMoney(totalCents)}.
              {installments > 1 && totalCents % installments !== 0
                ? " Diferenças de centavos são ajustadas na última parcela."
                : ""}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            No débito, o valor de {formatMoney(totalCents)} é pago à vista.
          </p>
        )}
        {demo ? (
          <div>
            <Label
              htmlFor="demo-result"
              className="text-xs text-muted-foreground"
            >
              Resultado da simulação
            </Label>
            <select
              id="demo-result"
              className="payment-input mt-2 w-full border border-input bg-background px-3 text-sm"
              value={decline ? "decline" : "approve"}
              onChange={(e) => setDecline(e.target.value === "decline")}
            >
              <option value="approve">Aprovar pagamento de teste</option>
              <option value="decline">Simular pagamento recusado</option>
            </select>
          </div>
        ) : null}
      </fieldset>
      <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        Os dados completos do cartão não são salvos neste navegador.
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl text-sm font-bold"
      >
        {busy
          ? "Processando pagamento…"
          : `${demo ? "Simular pagamento de" : "Pagar"} ${formatMoney(totalCents)}`}
      </Button>
    </form>
  );
}
