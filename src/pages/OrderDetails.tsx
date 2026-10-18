import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Clock3,
  Download,
  MapPin,
  Package,
  ReceiptText,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckoutShell,
  DemoNotice,
  OrderSummary,
  PaymentEmpty,
  PaymentLoading,
  PaymentPanel,
  StatusBadge,
} from "@/components/payment/CheckoutUI";
import { usePaymentOrder } from "@/hooks/use-payments";
import {
  formatDate,
  formatDocument,
  formatMoney,
  formatQuantity,
  methodLabels,
} from "@/lib/payment";
import { cn } from "@/lib/utils";

export default function OrderDetails() {
  const { orderId } = useParams();
  const {
    data: order,
    isPending,
    error,
    service,
    scope,
  } = usePaymentOrder(orderId);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const lock = useRef(false);
  if (isPending) return <PaymentLoading />;
  if (error || !order)
    return (
      <PaymentEmpty
        message={error?.message ?? "Não foi possível localizar este pedido."}
      />
    );
  const paid = order.status === "paid";
  const canceled = order.status === "canceled";
  const failed = order.status === "failed";
  const expired = order.status === "expired";
  const pendingCard = order.status === "pending" && order.method !== "pix";
  const Icon = paid ? CircleCheck : failed || canceled ? XCircle : Clock3;
  const cancel = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const updated = await service.cancelOrder(order.id);
      cache.setQueryData(["payment-order", scope, order.id], updated);
      void cache.invalidateQueries({ queryKey: ["payment-orders", scope] });
      toast.success("Pedido cancelado");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cancelar o pedido.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const download = () => {
    const text = [
      "ZENWASTE · RESUMO DEMONSTRATIVO DA COMPRA",
      "Não é um comprovante bancário ou documento fiscal.",
      "",
      `Pedido: ${order.number}`,
      `Data: ${formatDate(order.createdAt)}`,
      `Situação: ${paid ? "Pagamento aprovado (simulado)" : order.status}`,
      `Comprador: ${order.buyer.name}`,
      `Material: ${order.item.name}`,
      `Vendedor: ${order.item.company}`,
      `Quantidade: ${formatQuantity(order.quantity)} ${order.item.unit}`,
      `Total: ${formatMoney(order.totalCents)}`,
      `Pagamento: ${order.method ? methodLabels[order.method] : "Ainda não escolhido"}`,
      `Parcelas: ${order.installments}`,
      `Retirada: ${order.item.location}`,
      "Frete não incluso.",
      "",
      "Ambiente de demonstração. Nenhuma cobrança realizada.",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resumo-${order.number}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <CheckoutShell
      step={paid || canceled ? 3 : 2}
      title={
        paid
          ? "Compra confirmada. Novo ciclo iniciado."
          : canceled
            ? "Pedido cancelado."
            : failed
              ? "Vamos tentar de novo?"
              : expired
                ? "Seu Pix expirou."
                : "Seu pedido está quase lá."
      }
      description={
        paid
          ? "Tudo certo com o pagamento de teste. Confira os detalhes e os próximos passos da sua compra."
          : canceled
            ? "Este pedido foi encerrado. Você pode encontrar outras oportunidades no marketplace."
            : failed
              ? "O pagamento de teste não foi aprovado. Revise os dados ou escolha outra forma de pagamento."
              : expired
                ? "Você pode gerar outro código Pix ou escolher uma nova forma de pagamento."
                : "O pedido foi criado. Conclua o pagamento para seguir com a compra."
      }
      backTo="/orders"
      backLabel="Minhas compras"
    >
      <div className="mb-6">
        <DemoNotice>
          Este pedido é uma simulação. Não há cobrança, reserva de estoque ou
          solicitação de retirada real.
        </DemoNotice>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section
            className={cn(
              "relative overflow-hidden rounded-2xl border p-6 sm:p-8",
              paid
                ? "border-primary/25 bg-primary/5"
                : failed || canceled
                  ? "border-destructive/20 bg-destructive/5"
                  : "border-border bg-card",
            )}
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                  paid
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <StatusBadge status={order.status} />
                <h2 className="mb-1 mt-3 text-xl font-extrabold">
                  Pedido {order.number}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Criado em {formatDate(order.createdAt)}
                </p>
                {paid && order.paidAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirmado em {formatDate(order.paidAt)}
                  </p>
                ) : null}
              </div>
            </div>
            {!paid && !canceled && !pendingCard ? (
              <Button asChild className="mt-6 h-12 w-full rounded-xl font-bold">
                <Link
                  to={
                    order.method === "pix" && !failed
                      ? `/checkout/pix/${order.id}`
                      : `/checkout/payment/${order.id}`
                  }
                >
                  {expired ? <RefreshCw /> : <ArrowRight />}
                  {expired
                    ? "Gerar novo Pix"
                    : failed
                      ? "Tentar novamente"
                      : "Continuar pagamento"}
                </Link>
              </Button>
            ) : null}
            {pendingCard ? (
              <p
                role="status"
                className="mt-6 text-sm leading-relaxed text-muted-foreground"
              >
                Seu pagamento está sendo confirmado. Esta página consulta o
                status automaticamente; aguarde antes de tentar outra cobrança.
              </p>
            ) : null}
            {paid ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={download}
                  variant="outline"
                  className="h-11 rounded-xl bg-card"
                >
                  <Download />
                  Baixar resumo da compra
                </Button>
                <Button asChild className="h-11 rounded-xl">
                  <Link to="/marketplace">
                    Continuar explorando
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : null}
          </section>
          <PaymentPanel
            title="Detalhes do pagamento"
            icon={<ReceiptText className="h-5 w-5" />}
          >
            <dl className="space-y-4 text-sm">
              {[
                [
                  "Método",
                  order.method
                    ? methodLabels[order.method]
                    : "Ainda não escolhido",
                ],
                ...(order.card
                  ? [
                      [
                        "Cartão",
                        `${order.card.brand} · final ${order.card.last4}`,
                      ],
                    ]
                  : []),
                [
                  "Condição",
                  order.installments > 1
                    ? `${order.installments} parcelas · total ${formatMoney(order.totalCents)}`
                    : "À vista",
                ],
                ["Total do pedido", formatMoney(order.totalCents)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </PaymentPanel>
          <PaymentPanel
            title="Dados do comprador"
            icon={<Package className="h-5 w-5" />}
          >
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              {[
                ["Nome / razão social", order.buyer.name],
                ["CPF / CNPJ", formatDocument(order.buyer.document)],
                ["E-mail", order.buyer.email],
                ["Telefone", order.buyer.phone],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="mb-1 text-xs text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </PaymentPanel>
          {paid ? (
            <PaymentPanel
              title="O que acontece agora?"
              description="A compra é só o começo de um novo ciclo."
              icon={<MapPin className="h-5 w-5" />}
            >
              <ol className="space-y-5">
                {[
                  {
                    title: "Pagamento confirmado",
                    text: "A simulação do seu pagamento foi concluída.",
                    done: true,
                  },
                  {
                    title: "Combine a retirada",
                    text: `Na operação real, ${order.item.company} combinará os detalhes da retirada em ${order.item.location}.`,
                    done: false,
                  },
                  {
                    title: "Material em um novo ciclo",
                    text: "Receba o material e coloque o reaproveitamento em prática.",
                    done: false,
                  },
                ].map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        step.done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {step.done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </PaymentPanel>
          ) : null}
          {!paid && !canceled ? (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={busy}
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                  >
                    {busy ? "Cancelando…" : "Cancelar este pedido"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancelar pedido {order.number}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      O pagamento pendente será encerrado. Você poderá criar uma
                      nova compra pelo marketplace.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter pedido</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void cancel()}>
                      Sim, cancelar pedido
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
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
