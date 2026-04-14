import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Factory,
  Gauge,
  Leaf,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import logo from "@/assets/logo-zenwaste.png";
import heroBg from "@/assets/hero-bg.jpg";
import { ThemeToggle } from "@/components/theme-toggle";

const heroStats = [
  {
    value: "R$ 4,8 mi",
    label: "potencial anual capturado com revenda e reaproveitamento inteligente",
  },
  { value: "72h", label: "para transformar excedente operacional em oferta pronta para o mercado" },
  { value: "98%", label: "de visibilidade sobre estoque, demanda e critérios de conformidade" },
];

const featureCards = [
  {
    icon: PackageSearch,
    title: "Marketplace com contexto técnico",
    description:
      "Anuncie resíduos, subprodutos e materiais com especificações claras, informações operacionais e enquadramento ideal para compradores B2B.",
    points: ["Filtros por categoria, região e uso", "Listagens com atributos industriais relevantes"],
  },
  {
    icon: BarChart3,
    title: "Precificação orientada por dados",
    description:
      "Visualize tendências de mercado, entenda a pressão de demanda e publique ofertas com muito mais segurança comercial.",
    points: ["Sugestões de preço por lote", "Leitura rápida de aquecimento do mercado"],
  },
  {
    icon: ShieldCheck,
    title: "Governança para operação séria",
    description:
      "A plataforma apoia o time com rastreabilidade, checklist documental e visão consolidada da operação para reduzir fricção e risco.",
    points: ["Checklist antes de publicar", "Mais clareza para sustentabilidade e comercial"],
  },
];

const workflow = [
  {
    step: "01",
    icon: Boxes,
    title: "Organize o inventário",
    description:
      "Cadastre lotes, classifique materiais e centralize a visão do que hoje gera custo, ociosidade ou descarte.",
  },
  {
    step: "02",
    icon: Gauge,
    title: "Entenda valor e demanda",
    description:
      "Receba sinais de mercado, apoio para precificação e mais contexto para posicionar cada oportunidade com inteligência.",
  },
  {
    step: "03",
    icon: Users,
    title: "Conecte oferta com compradores",
    description:
      "Publique anúncios com mais credibilidade, atraia parceiros certos e acompanhe a evolução da operação em um só lugar.",
  },
];

const previewBars = [34, 52, 46, 68, 80, 94];

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative isolate overflow-hidden gradient-hero text-secondary-foreground">
        <div className="landing-grid absolute inset-0 opacity-40" />
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-soft-light"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/20 to-transparent" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-cyan-200/10 blur-3xl" />

        <header className="relative z-10 container flex items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="ZenWaste" className="w-36 h-auto sm:w-40" />
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">ZenWaste</p>
              <p className="text-sm text-white/[0.65]">
                Economia circular industrial com visão de produto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <a href="#como-funciona" className="transition-colors hover:text-white">
                Como funciona
              </a>
              <Link to="/marketplace" className="transition-colors hover:text-white">
                Marketplace
              </Link>
              <Link to="/login" className="transition-colors hover:text-white">
                Entrar
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        <div className="relative z-10 container grid gap-14 pb-24 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/[0.85] backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Plataforma B2B para transformar resíduos em receita recorrente
            </div>

            <h1 className="mt-8 font-display text-5xl font-semibold leading-[0.94] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Sua operação industrial pode vender melhor o que hoje parece apenas excedente.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/[0.72] sm:text-xl">
              A ZenWaste reúne marketplace, inteligência de mercado e governança operacional para
              dar mais valor aos resíduos e subprodutos que passam pela sua cadeia.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 rounded-full bg-white px-7 text-base font-semibold text-slate-950 hover:bg-white/90"
              >
                <Link to="/register">
                  Cadastrar empresa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 rounded-full border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/marketplace">Explorar marketplace</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-white/12 bg-white/[0.08] p-4 backdrop-blur-xl"
                >
                  <p className="font-display text-2xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/[0.65]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/[0.68]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5">
                <Leaf className="h-4 w-4 text-emerald-200" />
                Sustentabilidade com resultado econômico
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Mais rastreabilidade e segurança operacional
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[35rem]">
            <div className="float-soft absolute -right-6 bottom-10 hidden w-52 rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_22px_60px_rgba(2,12,27,0.34)] backdrop-blur-xl lg:block">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3 text-white">
                  <ShieldCheck className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Checklist ativo</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">
                    Publicação pronta
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Documentação, lote e descrição revisados antes de entrar no mercado.
              </p>
            </div>

            <div className="surface-panel-dark relative overflow-hidden rounded-[34px] border border-white/12 p-4 shadow-[0_28px_80px_rgba(2,12,27,0.38)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.18),transparent_35%)]" />
              <div className="relative rounded-[30px] border border-white/10 bg-slate-950/65 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/[0.42]">
                      Painel ZenWaste
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
                      Visão comercial e operacional no mesmo lugar
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-50">
                    <Sparkles className="h-3.5 w-3.5" />
                    IA ativa
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-white/[0.58]">Lote em destaque</p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          Aparas de alumínio série 6000
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-3">
                        <Factory className="h-5 w-5 text-emerald-200" />
                      </div>
                    </div>

                    <div className="mt-6 rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-white/[0.06] to-transparent p-4">
                      <div className="flex h-36 items-end gap-3">
                        {previewBars.map((height, index) => (
                          <div
                            key={`${height}-${index}`}
                            className="flex-1 rounded-t-[14px] bg-gradient-to-t from-emerald-400 via-teal-300 to-cyan-200 shadow-[0_0_18px_rgba(74,222,128,0.25)]"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-white/[0.56]">Preço sugerido por tonelada</span>
                      <span className="font-semibold text-white">R$ 4.720</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/[0.58]">Demanda aquecida</span>
                        <TrendingUp className="h-5 w-5 text-emerald-200" />
                      </div>
                      <p className="mt-4 font-display text-4xl font-semibold text-white">+18%</p>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Mais compradores buscando material compatível nas últimas 2 semanas.
                      </p>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-300/15 p-3">
                          <ShieldCheck className="h-5 w-5 text-emerald-100" />
                        </div>
                        <div>
                          <p className="text-sm text-white/[0.58]">Checklist documental</p>
                          <p className="mt-1 text-lg font-semibold text-white">Conforme para publicar</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {[
                          "MTR e licenças revisados",
                          "Descrição técnica validada",
                          "Baixo risco operacional",
                        ].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm text-white/[0.64]">
                            <BadgeCheck className="h-4 w-4 text-emerald-200" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Lotes ativos", value: "148", detail: "com rastreio por categoria" },
                    { label: "Conversão média", value: "31%", detail: "em contatos qualificados" },
                    { label: "Alertas estratégicos", value: "12", detail: "oportunidades de margem" },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-white/[0.38]">
                        {metric.label}
                      </p>
                      <p className="mt-2 font-display text-3xl font-semibold text-white">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm text-white/[0.56]">{metric.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-10">
        <div className="container">
          <div className="surface-panel grid gap-8 rounded-[32px] border border-white/60 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
                Oportunidade real de negócio
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                A landing agora comunica valor com mais clareza, maturidade e desejo de uso.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Em vez de parecer apenas institucional, a página passa a vender uma experiência de
                produto: mais confiança, mais modernidade e percepção clara do ganho para a operação.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { value: "B2B", label: "posicionamento mais premium e confiável" },
                { value: "UX", label: "escaneável, elegante e com CTA forte" },
                { value: "UI", label: "camadas, contraste e atmosfera de produto" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-border/60 bg-card/75 p-5 backdrop-blur"
                >
                  <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
              Experiência de produto
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Uma narrativa visual pensada para operação, sustentabilidade e comercial.
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              A home agora combina linguagem executiva, contexto industrial e uma estética mais atual
              para que o usuário entenda rápido por que a ZenWaste merece atenção.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {featureCards.map((feature, index) => (
              <article
                key={feature.title}
                className="surface-panel rounded-[30px] border border-border/60 p-7 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-4xl font-semibold tracking-tight text-foreground/90">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                </div>

                <h3 className="mt-8 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-muted-foreground">{feature.description}</p>

                <div className="mt-6 space-y-3">
                  {feature.points.map((point) => (
                    <div
                      key={point}
                      className="rounded-[22px] border border-border/60 bg-background/80 px-4 py-4 text-sm leading-6 text-foreground/[0.85]"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-muted/40 py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
              Como funciona
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Um fluxo simples para dar inteligência ao que antes virava custo.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {workflow.map((item) => (
              <article
                key={item.step}
                className="surface-panel rounded-[30px] border border-border/60 p-7 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-4xl font-semibold tracking-tight text-foreground/90">
                    {item.step}
                  </span>
                  <div className="rounded-2xl bg-accent p-3 text-accent-foreground">
                    <item.icon className="h-6 w-6" />
                  </div>
                </div>

                <h3 className="mt-8 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-24">
        <div className="relative overflow-hidden rounded-[36px] border border-border/60 bg-[linear-gradient(135deg,rgba(7,44,35,0.98),rgba(15,23,42,0.96))] px-8 py-10 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:px-12 md:py-14">
          <div className="absolute -right-12 top-0 h-52 w-52 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="absolute left-0 top-0 h-40 w-40 rounded-full bg-cyan-200/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/70">
                Próximo passo
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-5xl">
                Coloque sua operação em uma vitrine mais inteligente e mais rentável.
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/[0.72]">
                Crie sua conta empresarial, organize seu inventário e publique com muito mais
                contexto, confiança e percepção de valor.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 rounded-full bg-white px-7 text-base font-semibold text-slate-950 hover:bg-white/90"
              >
                <Link to="/register">
                  Criar conta empresarial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 rounded-full border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/80 py-8">
        <div className="container flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="ZenWaste" className="w-28 h-auto" />
            <div>
              <p className="font-medium text-foreground">ZenWaste</p>
              <p>Plataforma de economia circular industrial</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link to="/marketplace" className="transition-colors hover:text-foreground">
              Marketplace
            </Link>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Entrar
            </Link>
            <Link to="/register" className="transition-colors hover:text-foreground">
              Cadastrar empresa
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
