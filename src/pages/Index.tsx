import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
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

const mediaAssets = import.meta.glob("../assets/*", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const heroVideo = mediaAssets["../assets/video-bg.mp4"];

const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "Sobre", href: "#sobre" },
  { label: "O que e", href: "#o-que-e" },
  { label: "Processo", href: "#processo" },
];

const heroPillars = [
  { icon: Building2, label: "Marketplace B2B" },
  { icon: Gauge, label: "Gestao Inteligente" },
  { icon: Leaf, label: "Economia Circular" },
];

const aboutSignals = [
  { icon: Sparkles, label: "Tecnologia" },
  { icon: TrendingUp, label: "Inteligencia de mercado" },
  { icon: Boxes, label: "Gestao integrada" },
];

const processSteps = [
  {
    step: "1",
    icon: Building2,
    title: "Cadastre sua empresa",
    description: "Crie sua conta e acesse o ecossistema ZenWaste.",
  },
  {
    step: "2",
    icon: PackageSearch,
    title: "Publique ou encontre materiais",
    description: "Anuncie residuos industriais ou encontre oportunidades no marketplace.",
  },
  {
    step: "3",
    icon: Users,
    title: "Negocie diretamente",
    description: "Conecte-se com outras empresas de forma pratica e rapida.",
  },
  {
    step: "4",
    icon: BarChart3,
    title: "Gerencie tudo em um so lugar",
    description: "Controle estoque, metas e indicadores em tempo real.",
  },
];

const sectionTagClass =
  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]";

export default function Index() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealNodes = Array.from(page.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (prefersReducedMotion.matches) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    revealNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={pageRef} className="landing-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <section
        id="home"
        className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(135deg,#06101d_0%,#0b2236_42%,#0d5f52_100%)] text-white lg:min-h-[110vh]"
      >
        <div className="landing-grid absolute inset-0 opacity-30" />

        {heroVideo ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={heroBg}
            className="absolute inset-0 h-full w-full object-cover opacity-[0.28] mix-blend-screen"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
        ) : (
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.18] mix-blend-screen"
          />
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(110,231,183,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.16),transparent_30%)]" />
        <div className="landing-glow-orb absolute -left-16 top-24 h-72 w-72 rounded-full bg-emerald-300/20" />
        <div className="landing-glow-orb landing-glow-orb-alt absolute right-0 top-16 h-96 w-96 rounded-full bg-cyan-200/20" />
        <div className="landing-glow-orb absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-white/[0.08]" />

        <header className="relative z-20 container flex items-center justify-between gap-4 py-6">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="ZenWaste" className="h-auto w-36 sm:w-40" />
          </Link>

          <div className="flex items-center gap-3">
            <nav className="landing-nav-shell hidden items-center gap-5 rounded-full px-5 py-3 text-sm text-white/[0.72] lg:flex">
              {navigationItems.map((item) => (
                <a key={item.label} href={item.href} className="transition-colors duration-300 hover:text-white">
                  {item.label}
                </a>
              ))}
            </nav>

            <Button
              asChild
              variant="outline"
              className="hidden h-11 rounded-full border-white/20 bg-white/[0.06] px-5 text-white hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Link to="/login">Entrar</Link>
            </Button>

            <ThemeToggle />
          </div>
        </header>

        <div className="container relative z-10 flex flex-1 items-center pb-24 pt-10 sm:pt-12 lg:pb-28 lg:pt-16">
          <div data-reveal className="reveal-on-scroll max-w-3xl">
            <div className={`${sectionTagClass} border-white/[0.14] bg-white/10 text-white/[0.82] backdrop-blur`}>
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Home
            </div>

            <h1 className="mt-8 max-w-3xl font-display text-4xl font-semibold leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-[4.8rem]">
              Transforme residuos industriais em novas oportunidades.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/[0.74] sm:text-lg">
              A plataforma que conecta empresas para comprar, vender e gerenciar residuos de forma
              inteligente, sustentavel e lucrativa.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {heroPillars.map((pillar, index) => (
                <div
                  key={pillar.label}
                  data-reveal
                  className="reveal-on-scroll landing-nav-shell inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/[0.78]"
                  style={{ transitionDelay: `${120 + index * 90}ms` }}
                >
                  <pillar.icon className="h-4 w-4 text-emerald-200" />
                  {pillar.label}
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                size="lg"
                asChild
                className="h-12 rounded-full bg-white px-7 text-base font-semibold text-slate-950 shadow-[0_22px_60px_rgba(255,255,255,0.18)] hover:bg-white/[0.92]"
              >
                <Link to="/register">
                  Comece agora gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Link to="/login" className="text-sm font-medium text-white/[0.68] transition-colors hover:text-white">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="sobre" className="relative py-24 sm:py-28">
        <div className="absolute inset-x-0 top-16 h-72 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_60%)]" />

        <div className="container relative grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div data-reveal className="reveal-on-scroll max-w-xl">
            <div className={`${sectionTagClass} border-primary/[0.16] bg-primary/[0.08] text-primary`}>
              <Sparkles className="h-4 w-4" />
              Sobre
            </div>

            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Sustentabilidade com tecnologia de verdade.
            </h2>

            <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
              A ZenWaste nasceu para resolver um dos maiores desafios da industria: o descarte
              ineficiente de residuos.
            </p>

            <div className="mt-6 rounded-[30px] border border-border/70 bg-background/75 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-base leading-8 text-foreground/[0.88]">
                Unimos tecnologia, inteligencia de mercado e gestao integrada para transformar
                materiais descartados em ativos estrategicos para outras empresas.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {aboutSignals.map((signal, index) => (
              <article
                key={signal.label}
                data-reveal
                className="reveal-on-scroll landing-card rounded-[28px] p-6"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="flex h-full flex-col justify-between gap-10">
                  <div className="w-fit rounded-2xl bg-accent p-3 text-accent-foreground">
                    <signal.icon className="h-6 w-6" />
                  </div>
                  <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
                    {signal.label}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="o-que-e" className="relative overflow-hidden bg-muted/[0.35] py-24 sm:py-28">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="container relative">
          <div data-reveal className="reveal-on-scroll max-w-2xl">
            <div className={`${sectionTagClass} border-primary/[0.16] bg-primary/[0.08] text-primary`}>
              <Sparkles className="h-4 w-4" />
              O que e
            </div>

            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Muito alem de um marketplace.
            </h2>

            <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
              A ZenWaste e uma plataforma inteligente que conecta industrias interessadas em
              reutilizar residuos e reduzir custos operacionais.
            </p>
          </div>

          <div className="mt-12 grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
            <article
              data-reveal
              className="reveal-on-scroll landing-card rounded-[34px] p-7 sm:p-8"
            >
              <div className="max-w-3xl">
                <p className="text-lg leading-8 text-foreground/[0.9] sm:text-xl sm:leading-9">
                  Com ela, sua empresa pode publicar residuos disponiveis para venda, encontrar
                  materiais com menor custo, gerenciar estoque interno, acompanhar metas e
                  indicadores e receber sugestoes inteligentes de precificacao.
                </p>

                <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg">
                  Tudo acontece em um ambiente seguro, moderno e pensado para o mercado industrial,
                  com uma experiencia mais fluida, visual e estrategica para conectar oferta,
                  demanda e operacao em um unico lugar.
                </p>
              </div>
            </article>

            <article
              data-reveal
              className="reveal-on-scroll landing-card-dark overflow-hidden rounded-[34px] p-7 sm:p-8"
              style={{ transitionDelay: "120ms" }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.18),transparent_32%)]" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/[0.72]">
                  <ShieldCheck className="h-4 w-4 text-emerald-200" />
                  Ambiente seguro
                </div>

                <p className="mt-6 font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Menos atrito para vender, comprar e gerenciar residuos com visao comercial e
                  operacional.
                </p>

                <p className="mt-5 text-base leading-8 text-white/[0.7]">
                  A proposta da ZenWaste e transformar uma rotina normalmente fragmentada em um
                  fluxo centralizado, claro e pronto para gerar novas oportunidades entre empresas.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="processo" className="relative overflow-hidden py-24 sm:py-28">
        <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-200/[0.14] blur-3xl" />

        <div className="container relative">
          <div data-reveal className="reveal-on-scroll mx-auto max-w-2xl text-center">
            <div className={`${sectionTagClass} border-primary/[0.16] bg-primary/[0.08] text-primary`}>
              <Sparkles className="h-4 w-4" />
              Processo
            </div>

            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Simples, rapido e eficiente.
            </h2>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((item, index) => {
              const darkCard = index % 2 === 1;

              return (
                <article
                  key={item.step}
                  data-reveal
                  className={`reveal-on-scroll rounded-[30px] p-6 sm:p-7 ${
                    darkCard ? "landing-card-dark" : "landing-card"
                  }`}
                  style={{ transitionDelay: `${index * 90}ms` }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-4">
                      <div
                        className={`rounded-full px-4 py-2 font-display text-2xl font-semibold ${
                          darkCard
                            ? "border border-white/[0.12] bg-white/[0.08] text-white"
                            : "border border-primary/[0.14] bg-primary/10 text-primary"
                        }`}
                      >
                        {item.step}
                      </div>

                      <div
                        className={`rounded-2xl p-3 ${
                          darkCard ? "bg-white/10 text-emerald-100" : "bg-accent text-accent-foreground"
                        }`}
                      >
                        <item.icon className="h-6 w-6" />
                      </div>
                    </div>

                    <h3
                      className={`mt-8 font-display text-2xl font-semibold tracking-tight ${
                        darkCard ? "text-white" : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </h3>

                    <p
                      className={`mt-4 text-base leading-7 ${
                        darkCard ? "text-white/[0.72]" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container pb-24 sm:pb-28">
        <div className="rounded-[42px] bg-[linear-gradient(135deg,rgba(6,16,29,0.88),rgba(11,34,54,0.9),rgba(13,95,82,0.9),rgba(245,158,11,0.28))] p-[1px] shadow-[0_34px_100px_rgba(15,23,42,0.24)]">
          <div className="relative overflow-hidden rounded-[41px] border border-white/[0.08] bg-[linear-gradient(135deg,#07121e_0%,#0d2840_34%,#0f6a5d_74%,#1f8a72_100%)] px-8 py-10 text-white md:px-12 md:py-14">
            <div className="landing-glow-orb absolute -right-8 top-0 h-56 w-56 rounded-full bg-emerald-300/24" />
            <div className="landing-glow-orb landing-glow-orb-alt absolute left-0 top-0 h-48 w-48 rounded-full bg-cyan-200/[0.2]" />
            <div className="landing-glow-orb absolute bottom-0 right-1/3 h-56 w-56 rounded-full bg-amber-300/[0.22]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_28%)]" />
            <div className="absolute inset-[1px] rounded-[40px] border border-white/[0.08]" />

            <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
              <div data-reveal className="reveal-on-scroll max-w-2xl">
                <div className={`${sectionTagClass} border-white/[0.12] bg-white/10 text-white/[0.82]`}>
                  <Sparkles className="h-4 w-4 text-emerald-200" />
                  Cadastro
                </div>

                <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  O futuro da gestao sustentavel comeca agora.
                </h2>

                <p className="mt-5 text-base leading-8 text-white/[0.76] sm:text-lg">
                  Reduza custos, gere novas oportunidades e conecte sua empresa ao mercado da
                  economia circular.
                </p>

                <p className="mt-4 font-display text-2xl font-semibold text-white">
                  Faca parte da ZenWaste.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    asChild
                    className="h-12 rounded-full bg-white px-7 text-base font-semibold text-slate-950 hover:bg-white/[0.92]"
                  >
                    <Link to="/register">
                      Criar conta gratuitamente
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="h-12 rounded-full border-white/20 bg-white/[0.08] px-7 text-base text-white hover:bg-white/[0.12] hover:text-white"
                  >
                    <Link to="/login">Entrar</Link>
                  </Button>
                </div>
              </div>

              <div data-reveal className="reveal-on-scroll">
                <div className="relative mx-auto max-w-xl">
                  <div className="absolute -right-6 top-10 h-36 w-36 rounded-full bg-emerald-300/[0.18] blur-3xl" />
                  <div className="absolute -left-4 bottom-8 h-28 w-28 rounded-full bg-amber-300/[0.18] blur-3xl" />

                  <div className="landing-card-dark rounded-[34px] p-6 sm:p-7">
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/[0.72]">
                        <Building2 className="h-4 w-4 text-emerald-200" />
                        Cadastro empresarial
                      </div>

                      <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                        Entrada rapida em uma plataforma feita para conectar operacao, mercado e
                        sustentabilidade.
                      </h3>

                      <div className="mt-6 grid gap-3">
                        {[
                          {
                            icon: Gauge,
                            title: "Ativacao fluida",
                            text: "Comece com uma experiencia clara, leve e pronta para escalar.",
                          },
                          {
                            icon: Sparkles,
                            title: "Mais presenca visual",
                            text: "Um bloco de cadastro com mais brilho, profundidade e contraste.",
                          },
                          {
                            icon: ShieldCheck,
                            title: "Base segura",
                            text: "Fluxo moderno para empresas entrarem com mais confianca no ecossistema.",
                          },
                        ].map((item) => (
                          <div
                            key={item.title}
                            className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-4"
                          >
                            <div className="flex items-start gap-4">
                              <div className="rounded-2xl bg-white/[0.08] p-3 text-emerald-100">
                                <item.icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{item.title}</p>
                                <p className="mt-2 text-sm leading-6 text-white/[0.68]">{item.text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="landing-nav-shell absolute -left-6 bottom-6 hidden rounded-[22px] px-4 py-3 text-sm text-white/[0.78] lg:block">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-200" />
                      Economia circular com entrada imediata
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/80 py-8">
        <div className="container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="ZenWaste" className="h-auto w-28" />
          </Link>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {navigationItems.map((item) => (
              <a key={item.label} href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </a>
            ))}
            <Link to="/login" className="transition-colors hover:text-foreground">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
