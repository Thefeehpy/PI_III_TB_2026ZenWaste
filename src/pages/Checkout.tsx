import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Minus,
  Package,
  Plus,
  UserRound,
} from "lucide-react";
import { useAnuncios } from "@/contexts/MarketplaceContext";
import { EstadoConsulta } from "@/components/EstadoConsulta";
import { RecuperacaoSessao } from "@/components/RecuperacaoSessao";
import { ErroApi } from "@/services/cliente-http";
import { useAuth } from "@/contexts/AuthContext";
import { usePayments } from "@/hooks/use-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import {
  CheckoutShell,
  DemoNotice,
  FieldError,
  OrderSummary,
  PaymentEmpty,
  PaymentLoading,
  PaymentPanel,
} from "@/components/payment/CheckoutUI";
import {
  calculateTotal,
  formatDocument,
  formatMoney,
  formatQuantity,
  validateBuyer,
  validarCompradorEmpresarial,
  formatarTelefoneEmpresarial,
} from "@/lib/payment";
import type { BuyerDetails } from "@/types/payment";
import type { Anuncio } from "@/types/anuncio";
import { formatPhone } from "@/utils/input-masks";

export default function Checkout() {
  const { itemId } = useParams();
  const { user, isAuthenticated, isLoading, sessionError, retrySession, logout, sessionVersion } = useAuth();
  const integrado = import.meta.env.VITE_PAYMENT_MODE === "backend";
  const { anuncios, carregando, erro, atualizarAnuncios } = useAnuncios();
  const item = anuncios.find((candidate) => candidate.id === itemId);
  if (integrado && isLoading) return <PaymentLoading />;
  if (integrado && sessionError) return <RecuperacaoSessao mensagem={sessionError} tentarNovamente={() => void retrySession()} sair={logout} />;
  if (integrado && (!isAuthenticated || !user)) return <Navigate to="/login" replace state={{ from: `/checkout/${itemId}` }} />;
  if (carregando) return <PaymentLoading />;
  if (erro) return <div className="container py-8"><EstadoConsulta carregando={false} erro={erro} tentarNovamente={() => void atualizarAnuncios()} /></div>;
  if (!item || item.quantity <= 0)
    return (
      <PaymentEmpty
        title="Material indisponível"
        message="Este anúncio não está disponível para compra. Explore outros materiais no marketplace."
      />
    );
  return <CheckoutForm key={`${item.id}:${user?.id ?? "guest"}:${sessionVersion ?? 0}`} item={item} />;
}

function CheckoutForm({ item }: { item: Anuncio }) {
  const { user } = useAuth();
  const integrado = import.meta.env.VITE_PAYMENT_MODE === "backend";
  const { service } = usePayments();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [buyer, setBuyer] = useState<BuyerDetails>(() => ({
    name: user?.razaoSocial ?? "",
    email: user?.email ?? "",
    document: formatDocument(user?.cnpj ?? ""),
    phone: (integrado ? formatarTelefoneEmpresarial : formatPhone)(user?.telefone ?? ""),
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof BuyerDetails, string>>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const locked = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const requestKey = useRef(crypto.randomUUID());
  const amount = Number(quantity);
  const validQuantity =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= item.quantity &&
    Math.abs(amount * 1000 - Math.round(amount * 1000)) < 0.000001 &&
    calculateTotal(item.price, amount) > 0;
  const updateBuyer = (key: keyof BuyerDetails, value: string) => {
    if (integrado && key === "document") return;
    setBuyer((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    requestKey.current = crypto.randomUUID();
  };
  const updateQuantity = (value: string) => {
    setQuantity(value);
    requestKey.current = crypto.randomUUID();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current) return;
    const next = integrado ? validarCompradorEmpresarial(buyer, user) : validateBuyer(buyer);
    setErrors(next);
    if (!validQuantity) {
      setError(
        "Escolha uma quantidade disponível, com até três casas decimais e valor mínimo de R$ 0,01.",
      );
      document.getElementById("quantity")?.focus();
      return;
    }
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`buyer-${first}`)?.focus();
      return;
    }
    if (!accepted) {
      setError(
        "Confirme a revisão do pedido e a retirada no local para continuar.",
      );
      document.getElementById("accept-order")?.focus();
      return;
    }
    setError("");
    setBusy(true);
    locked.current = true;
    try {
      const order = await service.createOrder({
        listing: item,
        quantity: amount,
        buyer: {
          name: buyer.name.trim(),
          email: buyer.email.trim(),
          document: buyer.document.replace(/\D/g, ""),
          phone: buyer.phone.replace(/\D/g, ""),
        },
        idempotencyKey: requestKey.current,
      });
      if (montado.current) navigate(`/checkout/payment/${order.id}`);
    } catch (cause) {
      if (!montado.current) return;
      if (cause instanceof ErroApi) {
        const porCampo: Partial<Record<keyof BuyerDetails, string>> = {};
        for (const campo of ["name", "email", "document", "phone"] as const) {
          const mensagem = cause.mensagemCampo("buyer", campo);
          if (mensagem) porCampo[campo] = mensagem;
        }
        setErrors(porCampo);
        const primeiro = Object.keys(porCampo)[0];
        if (primeiro) document.getElementById(`buyer-${primeiro}`)?.focus();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível continuar. Tente novamente.",
      );
    } finally {
      if (montado.current) setBusy(false);
      locked.current = false;
    }
  };

  return (
    <CheckoutShell
      step={1}
      title="Uma boa escolha começa aqui."
      description="Revise o material, informe seus dados e continue para o pagamento."
    >
      <div className="mb-6">
        <DemoNotice>{integrado ? "Esta compra será registrada para a empresa autenticada. Use somente dados de teste no ambiente de demonstração; nenhum pagamento é realizado nesta etapa." : undefined}</DemoNotice>
      </div>
      <form
        onSubmit={submit}
        noValidate
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
      >
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          <PaymentPanel
            title="O material que você escolheu"
            description="Ajuste a quantidade de acordo com o que o seu negócio precisa."
            icon={<Package className="h-5 w-5" />}
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-36 w-full rounded-xl bg-muted object-cover sm:h-28 sm:w-28"
              />
              <div>
                <p className="text-xs font-semibold text-primary">
                  {item.type}
                </p>
                <h3 className="mb-2 mt-1 text-lg font-bold">{item.name}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Vendido por {item.company}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
              <div>
                <Label htmlFor="quantity">Quantidade ({item.unit})</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatQuantity(item.quantity)} {item.unit} disponíveis
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-xl"
                  aria-label="Diminuir quantidade"
                  disabled={amount <= 0.001}
                  onClick={() =>
                    updateQuantity(
                      String(
                        Math.max(
                          0.001,
                          Number(
                            (amount - Math.min(1, amount - 0.001)).toFixed(3),
                          ),
                        ),
                      ),
                    )
                  }
                >
                  <Minus />
                </Button>
                <Input
                  id="quantity"
                  type="number"
                  min="0.001"
                  max={item.quantity}
                  step="0.001"
                  value={quantity}
                  className="h-11 w-28 rounded-xl text-center font-semibold"
                  aria-invalid={!validQuantity}
                  aria-describedby="quantity-help"
                  onChange={(e) => updateQuantity(e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-xl"
                  aria-label="Aumentar quantidade"
                  disabled={amount >= item.quantity}
                  onClick={() =>
                    updateQuantity(
                      String(
                        Math.min(
                          item.quantity,
                          Number((amount + 1).toFixed(3)),
                        ),
                      ),
                    )
                  }
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <p
              id="quantity-help"
              className={`mt-3 text-xs ${validQuantity ? "text-muted-foreground" : "text-destructive"}`}
            >
              {validQuantity ? (
                <>
                  {formatMoney(Math.round(item.price * 100))} por {item.unit} ·
                  Compre até o limite disponível.
                </>
              ) : (
                "Informe uma quantidade maior que zero, dentro do estoque e com até três casas decimais. O valor mínimo é R$ 0,01."
              )}
            </p>
          </PaymentPanel>
          <PaymentPanel
            title={integrado ? "Compra empresarial — pessoa jurídica" : "Dados do comprador"}
            description={integrado ? "O CNPJ identifica a empresa autenticada. Nome, e-mail e telefone abaixo são os dados de contato do pedido." : "Estas informações identificam a compra e aparecem no seu pedido."}
            icon={<UserRound className="h-5 w-5" />}
          >
            {integrado && <p className="mb-5 rounded-xl bg-muted/60 p-3 text-sm">Compra realizada por <strong>{user?.razaoSocial}</strong>. Para comprar por outra empresa, entre com a conta correspondente.</p>}
            {!user ? (
              <p className="mb-5 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                Você pode experimentar sem uma conta. Já é cliente?{" "}
                <Link
                  to="/login"
                  state={{ from: `/checkout/${item.id}` }}
                  className="font-semibold text-primary hover:underline"
                >
                  Entre para usar seus dados.
                </Link>
              </p>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  {
                    key: "name",
                    label: integrado ? "Nome do contato ou razão social" : "Nome completo ou razão social",
                    placeholder: "Nome do comprador ou empresa",
                    autoComplete: "organization",
                    full: true,
                  },
                  {
                    key: "document",
                    label: integrado ? "CNPJ da empresa autenticada" : "CPF ou CNPJ",
                    placeholder: integrado ? "00.000.000/0000-00" : "000.000.000-00",
                    autoComplete: "off",
                  },
                  {
                    key: "phone",
                    label: "Telefone com DDD",
                    placeholder: "(11) 99999-9999",
                    autoComplete: "tel",
                  },
                  {
                    key: "email",
                    label: "E-mail",
                    placeholder: "financeiro@empresa.com.br",
                    autoComplete: "email",
                    full: true,
                  },
                ] as const
              ).map((field) => (
                <div
                  key={field.key}
                  className={"full" in field ? "sm:col-span-2" : ""}
                >
                  <Label htmlFor={`buyer-${field.key}`}>{field.label}</Label>
                  <MaskedInput
                    id={`buyer-${field.key}`}
                    type={
                      field.key === "email"
                        ? "email"
                        : field.key === "phone"
                          ? "tel"
                          : "text"
                    }
                    inputMode={field.key === "document" ? "numeric" : undefined}
                    autoComplete={field.autoComplete}
                    value={buyer[field.key]}
                    readOnly={integrado && field.key === "document"}
                    placeholder={field.placeholder}
                    maxLength={
                      field.key === "document"
                        ? 18
                        : field.key === "phone"
                          ? 15
                          : integrado ? (field.key === "name" ? 120 : 256) : 150
                    }
                    className="payment-input mt-2"
                    aria-invalid={!!errors[field.key]}
                    aria-describedby={
                      errors[field.key] ? `error-${field.key}` : undefined
                    }
                    formatValue={
                      field.key === "document"
                        ? formatDocument
                        : field.key === "phone"
                          ? (integrado ? formatarTelefoneEmpresarial : formatPhone)
                          : undefined
                    }
                    onValueChange={(value) => updateBuyer(field.key, value)}
                  />
                  <FieldError id={`error-${field.key}`}>
                    {errors[field.key]}
                  </FieldError>
                </div>
              ))}
            </div>
          </PaymentPanel>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <input
              id="accept-order"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="text-sm leading-relaxed">
              Revisei os dados e estou ciente de que a compra considera{" "}
              <strong>retirada em {item.location}</strong>, com frete contratado
              separadamente, se necessário.
            </span>
          </label>
        </fieldset>
        <OrderSummary item={item} quantity={validQuantity ? amount : 0}>
          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-xs leading-relaxed text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={busy || !validQuantity}
            className="h-12 w-full rounded-xl font-bold"
          >
            {busy ? "Preparando pedido…" : "Ir para pagamento"}
            <ArrowRight />
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Check className="h-3 w-3 text-primary" />
            Você revisa tudo antes de pagar
          </p>
        </OrderSummary>
      </form>
    </CheckoutShell>
  );
}
