import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Leaf,
  Loader2,
  Lock,
  Mail,
  Phone,
  Truck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEnvioFormulario } from "@/hooks/use-envio-formulario";
import { AvisoDemonstracao } from "@/components/AvisoDemonstracao";
import { formatCNPJ, validateCNPJ } from "@/utils/cnpj";
import { formatPhone } from "@/utils/input-masks";
import iconLogo from "@/assets/icone-logo.png";
import logo from "@/assets/logo-zenwaste.png";

const segments = [
  "Metalurgia",
  "Petroquimica",
  "Alimentos e Bebidas",
  "Papel e Celulose",
  "Automotivo",
  "Construcao Civil",
  "Textil",
  "Eletronico",
  "Farmaceutico",
  "Outro",
];

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
    description: "Cadastrar com CNPJ",
    icon: Building2,
  },
  {
    id: "driver",
    title: "Entregador / Transportador",
    description: "Demonstração de entregas",
    icon: Truck,
  },
  {
    id: "client",
    title: "Cliente",
    description: "Demonstração de canhoto",
    icon: UserCheck,
  },
];

const profileRoutes: Record<Exclude<AccessProfile, "company">, string> = {
  driver: "/carrier/dashboard",
  client: "/delivery-signature/5842",
};

const profileButtonLabel: Record<AccessProfile, string> = {
  company: "Criar conta",
  driver: "Abrir demonstração da transportadora",
  client: "Abrir demonstração do canhoto",
};

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register } = useAuth();
  const [profile, setProfile] = useState<AccessProfile>("company");
  const [form, setForm] = useState({
    razaoSocial: "",
    cnpj: "",
    segmento: "",
    email: "",
    telefone: "",
    password: "",
    confirmPassword: "",
  });
  const [cnpjError, setCnpjError] = useState("");
  const [erroFormulario, definirErroFormulario] = useState("");
  const { pendente, executar } = useEnvioFormulario(profile);

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm({ ...form, cnpj: formatted });
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 14) {
      setCnpjError(validateCNPJ(formatted) ? "" : "CNPJ invalido");
    } else {
      setCnpjError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profile !== "company") {
      toast({ title: "Demonstração", description: "Abrindo dados fictícios. Nenhuma conta foi criada." });
      navigate(profileRoutes[profile]);
      return;
    }

    if (!validateCNPJ(form.cnpj)) {
      setCnpjError("CNPJ invalido. Apenas empresas podem se cadastrar.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast({
        title: "Senhas diferentes",
        description: "Confirme a mesma senha nos dois campos.",
        variant: "destructive",
      });
      return;
    }

    definirErroFormulario("");
    const result = await executar((signal) => register({
      razaoSocial: form.razaoSocial,
      cnpj: form.cnpj,
      segmento: form.segmento,
      email: form.email,
      telefone: form.telefone.replace(/\D/g, ""),
      password: form.password,
    }, signal));

    if (!result || result.cancelled) return;

    if (!result.success) {
      definirErroFormulario(result.message || "Cadastro não concluído. Tente novamente.");
      toast({
        title: "Cadastro nao concluido",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Conta criada",
      description: "Agora voce ja pode entrar com seu e-mail e senha.",
    });
    navigate("/login");
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
        <Card className="auth-glass auth-rise w-full max-w-2xl rounded-[2rem] border-white/20 text-card-foreground shadow-none">
          <CardHeader className="relative z-10 space-y-4 pb-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_16px_40px_rgba(52,211,153,0.18)]">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-display text-3xl">
                {profile === "company" ? "Cadastro empresarial" : "Explorar demonstração"}
              </CardTitle>
              <CardDescription className="mt-2 text-sm">
                {profile === "company"
                  ? "Informe os dados da empresa para liberar o painel."
                  : "Explore dados fictícios sem criar conta ou informar credenciais."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="relative z-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset disabled={pendente} className="space-y-5" aria-busy={pendente}>
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
                      onClick={() => {
                        setProfile(accessProfile.id);
                        setCnpjError("");
                        definirErroFormulario("");
                        setForm((atual) => ({ ...atual, password: "", confirmPassword: "" }));
                      }}
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

              {profile === "company" ? (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-2">
                    <Label htmlFor="razao">Razao Social</Label>
                    <div className="relative">
                      <Building2 className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      <Input
                        id="razao"
                        placeholder="Razao Social da Empresa"
                        className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                        value={form.razaoSocial}
                        onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <MaskedInput
                      id="cnpj"
                      inputMode="numeric"
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.cnpj}
                      formatValue={formatCNPJ}
                      onValueChange={handleCnpjChange}
                      required
                    />
                    {cnpjError && <p className="text-sm text-destructive">{cnpjError}</p>}
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label>Segmento de Atuacao</Label>
                    <Select
                      value={form.segmento}
                      onValueChange={(value) => setForm({ ...form, segmento: value })}
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus:ring-primary/40">
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((segment) => (
                          <SelectItem key={segment} value={segment}>
                            {segment}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : <AvisoDemonstracao />}

              {profile === "company" && <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={profile === "company" ? "contato@empresa.com" : "seu@email.com"}
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tel">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <MaskedInput
                      id="tel"
                      type="tel"
                      autoComplete="tel-national"
                      maxLength={15}
                      placeholder="(00) 00000-0000"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.telefone}
                      formatValue={formatPhone}
                      onValueChange={(value) => setForm({ ...form, telefone: value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pass">Senha</Label>
                  <div className="relative">
                    <Lock className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="pass"
                      type="password"
                      placeholder="senha"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="senha"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              </>}
              {erroFormulario && <p role="alert" className="text-sm text-destructive">{erroFormulario}</p>}
              <Button
                type="submit"
                disabled={pendente}
                className="auth-shimmer h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-primary to-cyan-500 font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.26)] transition-transform hover:scale-[1.01]"
              >
                {pendente ? "Criando conta…" : profileButtonLabel[profile]}
                {pendente ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              </fieldset>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ja tem conta?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
