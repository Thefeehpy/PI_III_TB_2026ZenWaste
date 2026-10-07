import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Leaf,
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCNPJ, validateCNPJ } from "@/utils/cnpj";
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
    description: "Acesso as entregas",
    icon: Truck,
  },
  {
    id: "client",
    title: "Cliente",
    description: "Canhoto digital",
    icon: UserCheck,
  },
];

const profileRoutes: Record<Exclude<AccessProfile, "company">, string> = {
  driver: "/carrier/dashboard",
  client: "/delivery-signature/5842",
};

const profileButtonLabel: Record<AccessProfile, string> = {
  company: "Criar conta",
  driver: "Continuar como transportador",
  client: "Continuar como cliente",
};

const materialCostFields = [
  { key: "paperCostKm", label: "Papel e papelao" },
  { key: "plasticCostKm", label: "Plastico" },
  { key: "metalCostKm", label: "Metal" },
  { key: "glassCostKm", label: "Vidro" },
] as const;

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
  const [carrierForm, setCarrierForm] = useState({
    companyName: "",
    document: "",
    transportType: "",
    coverage: "",
    fleetSize: "",
    paperCostKm: "",
    plasticCostKm: "",
    metalCostKm: "",
    glassCostKm: "",
  });
  const [cnpjError, setCnpjError] = useState("");

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
      if (profile === "driver" && !carrierForm.companyName.trim()) {
        toast({
          title: "Dados da transportadora",
          description: "Informe o nome da empresa transportadora para continuar.",
          variant: "destructive",
        });
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

      toast({
        title: "Cadastro preparado",
        description:
          profile === "driver"
            ? "Abrindo a dashboard da transportadora com propostas de frete."
            : "Abrindo a experiencia de assinatura do canhoto digital.",
      });
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

    const result = await register({
      razaoSocial: form.razaoSocial,
      cnpj: form.cnpj,
      segmento: form.segmento,
      email: form.email,
      telefone: form.telefone,
      password: form.password,
    });

    if (!result.success) {
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
                {profile === "company" ? "Cadastro empresarial" : "Criar acesso"}
              </CardTitle>
              <CardDescription className="mt-2 text-sm">
                {profile === "company"
                  ? "Informe os dados da empresa para liberar o painel."
                  : "Escolha seu perfil para abrir o fluxo correto."}
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
                      onClick={() => {
                        setProfile(accessProfile.id);
                        setCnpjError("");
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
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
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
              ) : profile === "driver" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="carrier-company">Nome da empresa transportadora</Label>
                      <div className="relative">
                        <Truck className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                        <Input
                          id="carrier-company"
                          placeholder="Ex.: Rota Verde Transportes"
                          className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                          value={carrierForm.companyName}
                          onChange={(event) => setCarrierForm((current) => ({ ...current, companyName: event.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="carrier-document">CNPJ / Registro ANTT</Label>
                      <Input
                        id="carrier-document"
                        placeholder="00.000.000/0000-00 ou registro"
                        className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                        value={carrierForm.document}
                        onChange={(event) => setCarrierForm((current) => ({ ...current, document: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-1">
                      <Label>Tipo de transporte</Label>
                      <Select
                        value={carrierForm.transportType}
                        onValueChange={(value) => setCarrierForm((current) => ({ ...current, transportType: value }))}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus:ring-primary/40">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fracionado">Fracionado</SelectItem>
                          <SelectItem value="carga-fechada">Carga fechada</SelectItem>
                          <SelectItem value="roll-on">Roll-on / cacamba</SelectItem>
                          <SelectItem value="dedicado">Dedicado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 sm:col-span-1">
                      <Label htmlFor="carrier-coverage">Regiao atendida</Label>
                      <Input
                        id="carrier-coverage"
                        placeholder="Ex.: SP, PR e MG"
                        className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                        value={carrierForm.coverage}
                        onChange={(event) => setCarrierForm((current) => ({ ...current, coverage: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-1">
                      <Label htmlFor="carrier-fleet">Tamanho da frota</Label>
                      <Input
                        id="carrier-fleet"
                        type="number"
                        placeholder="Ex.: 12"
                        className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                        value={carrierForm.fleetSize}
                        onChange={(event) => setCarrierForm((current) => ({ ...current, fleetSize: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">Custo por KM por material transportado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Esses valores ajudam o sistema a sugerir oportunidades compatíveis com a transportadora.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {materialCostFields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Input
                            id={field.key}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="R$ por KM"
                            className="h-12 rounded-2xl border-border/70 bg-background/70 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                            value={carrierForm[field.key]}
                            onChange={(event) =>
                              setCarrierForm((current) => ({ ...current, [field.key]: event.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="razao">Nome completo</Label>
                  <div className="relative">
                    <UserCheck className="auth-field-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="razao"
                      placeholder="Nome do responsavel"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.razaoSocial}
                      onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

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
                    <Input
                      id="tel"
                      placeholder="(00) 00000-0000"
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-11 shadow-inner shadow-black/5 backdrop-blur focus-visible:ring-primary/40"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: e.target.value })}
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

              <Button
                type="submit"
                className="auth-shimmer h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-primary to-cyan-500 font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.26)] transition-transform hover:scale-[1.01]"
              >
                {profileButtonLabel[profile]}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
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
