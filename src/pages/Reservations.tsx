import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  PackageCheck,
  PieChart,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { EstadoConsulta } from "@/components/EstadoConsulta";
import { useReservas } from "@/hooks/use-reservas";
import { apresentarReserva, type SituacaoExibicaoReserva } from "@/lib/reservas";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatInventoryCalendarDate, formatInventoryQuantity } from "@/lib/inventory";
import { cn } from "@/lib/utils";

type SituacaoReservaExibida = SituacaoExibicaoReserva;

const metadadosSituacoes: Record<
  SituacaoReservaExibida,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
    chartColor: string;
  }
> = {
  coberta: {
    label: "Coberta",
    description: "saldo suficiente",
    badgeClassName: "border-primary/25 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
    chartColor: "hsl(var(--primary))",
  },
  pendente: {
    label: "Em andamento",
    description: "faltam volumes",
    badgeClassName: "border-info/25 bg-info/10 text-info",
    dotClassName: "bg-info",
    chartColor: "hsl(var(--info))",
  },
  atencao: {
    label: "Atenção",
    description: "prazo próximo",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
    chartColor: "hsl(var(--warning))",
  },
  finalizada: {
    label: "Finalizada",
    description: "registro concluído",
    badgeClassName: "border-primary/25 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
    chartColor: "hsl(var(--primary))",
  },
  cancelada: {
    label: "Cancelada",
    description: "fora dos compromissos ativos",
    badgeClassName: "border-muted-foreground/25 bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
    chartColor: "hsl(var(--muted-foreground))",
  },
  expirada: {
    label: "Expirada",
    description: "prazo do pedido encerrado",
    badgeClassName: "border-warning/30 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
    chartColor: "hsl(var(--warning))",
  },
};

export default function Reservas() {
  const { user } = useAuth();
  const { reservas: registros, carregando, erro, atualizarReservas } = useReservas(user?.id ?? null);
  const chartTheme = useChartTheme();
  const isMobile = useIsMobile();
  const reservas = useMemo(() => registros.map((reserva) => apresentarReserva(reserva)), [registros]);
  const ativas = useMemo(() => reservas.filter((reserva) => reserva.ativa), [reservas]);

  const totais = useMemo(() => reservas.reduce((acumulado, reserva) => {
    acumulado[reserva.situacao] += 1;
    if (reserva.ativa) {
      acumulado.ativas += 1;
      if (reserva.modalidade === "captacao") acumulado.captacoes += 1;
      else acumulado.compromissos += 1;
    }
    return acumulado;
  }, { ativas: 0, captacoes: 0, compromissos: 0, coberta: 0, pendente: 0, atencao: 0, finalizada: 0, cancelada: 0, expirada: 0 }), [reservas]);
  const proporcaoCobertas = ativas.length ? Math.round(totais.coberta / ativas.length * 100) : 0;
  const dadosGraficoCobertura = useMemo(() => ativas.slice(0, 6).map((reserva) => ({
    name: `${reserva.nomeProduto} (${reserva.unidade})`,
    reservado: reserva.quantidadeReservada,
    coberto: Math.max(0, reserva.quantidadeReservada - reserva.quantidadeFaltante),
  })), [ativas]);

  const dadosGraficoSituacoes = useMemo(
    () =>
      (Object.keys(metadadosSituacoes) as SituacaoReservaExibida[])
        .map((status) => ({
          name: metadadosSituacoes[status].label,
          value: totais[status],
          fill: metadadosSituacoes[status].chartColor,
        }))
        .filter((entry) => entry.value > 0),
    [totais],
  );

  return (
    <div className="space-y-8">
      <EstadoConsulta carregando={carregando} erro={erro} tentarNovamente={() => void atualizarReservas()} />
      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-cyan-100/14 blur-3xl" />

        <CardContent className="relative grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_24rem] xl:items-end">
          <div className="max-w-3xl space-y-5">
            <Badge className="w-fit rounded-full border border-white/16 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
              <Sparkles className="mr-2 h-4 w-4" />
              Gestão de compromissos
            </Badge>

            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reservas</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Consulte metas de captação, compromissos de estoque e reservas vinculadas a pedidos, com os dados registrados pela empresa.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/12 p-5 backdrop-blur-xl">
            <p className="text-sm text-white/70">Reservas ativas com saldo físico suficiente</p>
            <p className="mt-3 text-5xl font-semibold">{proporcaoCobertas}%</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full border border-white/30 bg-white/12">
              <div
                className="h-full rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.48)]"
                style={{ width: `${proporcaoCobertas}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{reservas.length}</p>
                <p className="mt-1 text-xs text-white/62">reservas</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totais.pendente}</p>
                <p className="mt-1 text-xs text-white/62">em andamento</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/10 p-3">
                <p className="text-2xl font-semibold">{totais.atencao}</p>
                <p className="mt-1 text-xs text-white/62">atenção</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Reservas ativas</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totais.ativas}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">registros em andamento</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Compromissos de estoque</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totais.compromissos}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">reservas ativas que comprometem saldo</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Metas de captação</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {totais.captacoes}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">metas que não bloqueiam o estoque</p>
              </div>
              <div className="rounded-2xl bg-warning/10 p-3 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Reservas finalizadas</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{totais.finalizada}</p>
                <p className="mt-2 text-xs text-muted-foreground">histórico concluído</p>
              </div>
              <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Cobertura individual das reservas</CardTitle>
            <CardDescription>Comparação individual com o saldo físico. O mesmo produto pode aparecer em mais de uma reserva; consulte o estoque para ver o saldo disponível após os compromissos.</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosGraficoCobertura.length === 0 && !carregando && !erro ? (
              <div className="flex h-[340px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                As reservas ativas aparecerão aqui após o cadastro ou a criação de um pedido.
              </div>
            ) : dadosGraficoCobertura.length > 0 ? (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoCobertura} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" horizontal={false} />
                    <XAxis type="number" stroke={chartTheme.axis} fontSize={12} allowDecimals />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={chartTheme.axis}
                      fontSize={12}
                      width={isMobile ? 92 : 150}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBackground,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        borderRadius: "16px",
                        color: chartTheme.tooltipText,
                      }}
                      formatter={(value: number, name: string) => [`${value.toLocaleString("pt-BR")}`, name]}
                      labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                    />
                    <Bar dataKey="reservado" fill="rgba(148,163,184,0.28)" radius={[0, 10, 10, 0]} barSize={18} />
                    <Bar dataKey="coberto" fill={chartTheme.primary} radius={[0, 10, 10, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl">Status das reservas</CardTitle>
            <CardDescription>Distribuição rápida dos compromissos por nível de atendimento.</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosGraficoSituacoes.length === 0 && !carregando && !erro ? (
              <div className="flex h-[300px] items-center justify-center rounded-[28px] border border-dashed border-border bg-muted/20 text-center text-sm text-muted-foreground">
                Nenhum status para exibir ainda.
              </div>
            ) : dadosGraficoSituacoes.length > 0 ? (
              <>
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={dadosGraficoSituacoes} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
                        {dadosGraficoSituacoes.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.tooltipBackground,
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          borderRadius: "16px",
                          color: chartTheme.tooltipText,
                        }}
                        formatter={(value: number) => [`${value} reserva(s)`, "Total"]}
                        labelStyle={{ color: chartTheme.tooltipText, fontWeight: 600 }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {(Object.keys(metadadosSituacoes) as SituacaoReservaExibida[]).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn("h-3 w-3 rounded-full", metadadosSituacoes[status].dotClassName)} />
                        <span className="text-sm font-medium text-foreground">{metadadosSituacoes[status].label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{totais[status]}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Reservas registradas</CardTitle>
            <CardDescription>Detalhamento dos compromissos, prazos e volumes pendentes por produto.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            {reservas.length} registros
          </Badge>
        </CardHeader>
        <CardContent>
          {reservas.length === 0 && !carregando && !erro ? (
            <div className="rounded-[28px] border border-dashed border-border bg-muted/20 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhuma reserva cadastrada</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                As metas de captação e reservas cadastradas ou vinculadas a pedidos aparecerão aqui.
              </p>
            </div>
          ) : reservas.length > 0 ? (
            <div className="grid gap-4">
              {reservas.map((reserva) => {
                const status = metadadosSituacoes[reserva.situacao];

                return (
                  <article
                    key={reserva.id}
                    className="rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 md:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("rounded-full px-3 py-1", status.badgeClassName)}>
                            <span className={cn("mr-2 h-2 w-2 rounded-full", status.dotClassName)} />
                            {status.label}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3 py-1">{reserva.origem}</Badge>
                          <span className="text-xs text-muted-foreground">{status.description}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{reserva.nomeProduto}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{reserva.categoria}</p>
                        {reserva.observacao && <p className="mt-2 text-sm leading-6 text-muted-foreground">{reserva.observacao}</p>}
                        {reserva.pedidoId && <p className="mt-2 text-xs text-muted-foreground">Acompanhamento e alterações pelo pedido vinculado.</p>}
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Comprador / contato</p>
                        <p className="mt-1 font-semibold text-foreground">{reserva.comprador}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">{reserva.modalidade === "captacao" ? "Meta de captação" : "Quantidade reservada"}</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatInventoryQuantity(reserva.quantidadeReservada, reserva.unidade)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Saldo físico atual do produto</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatInventoryQuantity(reserva.saldoFisico, reserva.unidade)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Falta para atender</p>
                        <p className="mt-2 font-semibold text-foreground">
                          {reserva.ativa ? formatInventoryQuantity(reserva.quantidadeFaltante, reserva.unidade) : "Registro encerrado"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card p-3">
                        <p className="text-xs text-muted-foreground">Prazo</p>
                        <p className="mt-2 font-semibold text-foreground">{reserva.prazo ? formatInventoryCalendarDate(reserva.prazo) : "Não informado"}</p>
                      </div>
                    </div>

                    {reserva.ativa && <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          <span>
                            {reserva.diasRestantes === null
                              ? "Prazo não identificado"
                              : reserva.diasRestantes < 0
                                ? `${Math.abs(reserva.diasRestantes)} dia(s) em atraso`
                                : `${reserva.diasRestantes} dia(s) restantes`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Factory className="h-4 w-4 text-primary" />
                          <span>{reserva.progresso}% de cobertura</span>
                        </div>
                      </div>

                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),rgba(52,211,153,0.55))]"
                          style={{ width: `${reserva.progresso}%` }}
                        />
                      </div>
                    </div>}
                  </article>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
