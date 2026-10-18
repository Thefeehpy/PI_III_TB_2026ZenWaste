import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package, Search, ShoppingBag } from "lucide-react";
import { usePayments } from "@/hooks/use-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DemoNotice,
  PaymentEmpty,
  PaymentLoading,
  StatusBadge,
} from "@/components/payment/CheckoutUI";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  methodLabels,
} from "@/lib/payment";
import { cn } from "@/lib/utils";

const filters = [
  { id: "all", label: "Todas" },
  { id: "paid", label: "Confirmadas" },
  { id: "pending", label: "Pendentes" },
  { id: "closed", label: "Encerradas" },
];

export default function Orders() {
  const { service, scope } = usePayments();
  const {
    data: orders = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["payment-orders", scope],
    queryFn: () => service.listOrders(),
    retry: false,
  });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  if (isPending) return <PaymentLoading />;
  if (error)
    return (
      <PaymentEmpty
        title="Não foi possível carregar suas compras"
        message={error.message}
      />
    );
  const filtered = orders.filter((order) => {
    const statusMatches =
      filter === "all" ||
      (filter === "paid"
        ? order.status === "paid"
        : filter === "closed"
          ? ["canceled", "failed"].includes(order.status)
          : ["awaiting_payment", "pending", "expired"].includes(order.status));
    return (
      statusMatches &&
      `${order.number} ${order.item.name} ${order.item.company}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))
    );
  });
  return (
    <div className="payment-page min-h-[calc(100vh-4rem)] pb-12">
      <div className="container max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <ShoppingBag className="h-4 w-4" />
              Seu histórico
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Minhas compras
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Seus pedidos, pagamentos e novos ciclos em um só lugar.
            </p>
          </div>
          <Button asChild className="rounded-xl">
            <Link to="/marketplace">
              Explorar marketplace
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <DemoNotice>
          Os pedidos de teste ficam disponíveis nesta sessão do navegador,
          separados por conta. Nenhuma compra real é realizada.
        </DemoNotice>
        <div className="my-7 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Pedidos realizados",
              value: String(orders.length),
              detail: "nesta sessão",
            },
            {
              label: "Compras confirmadas",
              value: String(
                orders.filter((order) => order.status === "paid").length,
              ),
              detail: "pagamentos de teste aprovados",
            },
            {
              label: "Total confirmado",
              value: formatMoney(
                orders
                  .filter((order) => order.status === "paid")
                  .reduce((total, order) => total + order.totalCents, 0),
              ),
              detail: "em compras demonstrativas",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="my-2 text-2xl font-extrabold tracking-tight">
                {stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground">{stat.detail}</p>
            </div>
          ))}
        </div>
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row">
          <div
            className="flex gap-1 overflow-x-auto rounded-xl bg-muted/80 p-1"
            role="group"
            aria-label="Filtrar compras"
          >
            {filters.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4",
                  filter === id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar pedidos"
              placeholder="Buscar pedido, material ou vendedor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl pl-9"
            />
          </div>
        </div>
        {filtered.length ? (
          <div className="space-y-4">
            {filtered.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-sm font-bold">{order.number}</h2>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <img
                      src={order.item.imageUrl}
                      alt={order.item.name}
                      className="h-20 w-20 shrink-0 rounded-xl bg-muted object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{order.item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.item.company}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatQuantity(order.quantity)} {order.item.unit} ·{" "}
                        {order.method
                          ? methodLabels[order.method]
                          : "Pagamento a definir"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:flex-col sm:items-end">
                    <p className="text-lg font-extrabold text-primary">
                      {formatMoney(order.totalCents)}
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                    >
                      <Link to={`/orders/${order.id}`}>
                        Ver pedido
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <div className="mb-5 rounded-2xl bg-primary/10 p-5">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold">
              {orders.length
                ? "Nenhum pedido encontrado"
                : "Seu próximo ciclo começa com uma escolha."}
            </h2>
            <p className="mb-6 mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {orders.length
                ? "Tente outro termo de busca ou ajuste o filtro."
                : "Explore os materiais do marketplace e faça sua primeira compra de demonstração."}
            </p>
            {orders.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button asChild className="rounded-xl">
                <Link to="/marketplace">
                  Encontrar materiais
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
