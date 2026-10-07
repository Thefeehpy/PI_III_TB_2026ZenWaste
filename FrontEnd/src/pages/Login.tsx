import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Leaf,
  Lock,
  Mail,
  Truck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import iconLogo from "@/assets/icone-logo.png";
import logo from "@/assets/logo-zenwaste.png";

type AccessProfile = "company" | "driver" | "client";

const accessProfiles: Array<{
  id: AccessProfile;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "company",
    title: "Empresa",
    description: "Painel completo",
    icon: Building2,
  },
  {
    id: "driver",
    title: "Entregador / Transportador",
    description: "Entregas e fretes",
    icon: Truck,
  },
  {
    id: "client",
    title: "Cliente",
    description: "Assinar entrega",
    icon: UserCheck,
  },
];

const profileRoutes: Record<Exclude<AccessProfile, "company">, string> = {
  driver: "/carrier/dashboard",
  client: "/delivery-signature/5842",
};

const profileButtonLabel: Record<AccessProfile, string> = {
  company: "Entrar no painel",
  driver: "Entrar como transportador",
  client: "Abrir canhoto digital",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<AccessProfile>("company");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const redirectTo = (location.state as { from?: string } | null)?.from || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profile !== "company") {
      toast({
        title: "Acesso liberado",
        description:
          profile === "driver"
            ? "Abrindo a dashboard da transportadora."
            : "Abrindo a assinatura digital da entrega.",
      });
      navigate(profileRoutes[profile]);
      return;
    }

    const result = await login(email, password);
    if (!result.success) {
      toast({
        title: "Nao foi possivel entrar",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Login realizado",
      description: "Sua sessao foi restaurada e continuara ativa neste navegador.",
    });
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="auth-page relative min-h-screen overflow-hidden text-white">
      <div className="auth-aurora auth-aurora-one" />
      <div className="auth-aurora auth-aurora-two" />
      <div className="auth-green-glow auth-green-glow-one" />
      <div className="auth-green-glow auth-green-glow-two" />
      <div className="auth-green-glow auth-green-glow-three" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_42%),linear-gradient(180deg,rgba(2,8,18,0.12),rgba(2,8,18,0.74))]" />
      <img
        src={iconLogo}
        alt=""
        className="auth-watermark pointer-events-none absolute left-1/2 top-1/2 z-0 w-[min(58vw,520px)] -translate-x-1/2 -translate-y-1/2 select-none"
      />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link to="/" className="inline-flex items-center gap-3">
          <img src={logo} alt="ZenWaste" className="h-auto w-36 drop-shadow-[0_14px_36px_rgba(52,211,153,0.24)]" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] w-full items-center justify-center px-5 pb-10 sm:px-8">
        <Card className="auth-glass auth-rise w-full max-w-xl rounded-[2rem] border-white/20 text-card-foreground shadow-none">
          <CardHeader className="relative z-10 space-y-4 pb-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_16px_40px_rgba(52,211,153,0.18)]">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-display text-3xl">Bem-vindo de volta</CardTitle>
              <CardDescription className="mt-2 text-sm">
                Escolha seu perfil e entre no ambiente certo para continuar.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="relative z-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {accessProfiles.map((accessProfile) => {
                  const Icon = accessProfile.icon;
                  const isSelected = profile === accessProfile.id;

                  return (
                    <button
                      key={accessProfile.id}
                      type="button"
                      aria-pressed={isSelected}
                      data-selected={isSelected}
                      onClick={() => setProfile(accessProfile.id)}
                      className="auth-profile-option rounded-2xl p-3 text-left"
                    >
                      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="block text-sm font-semibold text-foreground">{accessProfile.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                        {accessProfile.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="empresa@email.com"
                    className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="senha"
                    className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="auth-shimmer h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-primary to-cyan-500 font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.26)] transition-transform hover:scale-[1.01]"
              >
                {profileButtonLabel[profile]}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Nao tem conta?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Criar acesso
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
