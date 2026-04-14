import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Lock, Mail, Phone } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCNPJ, validateCNPJ } from "@/utils/cnpj";
import heroBg from "@/assets/hero-bg.jpg";
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

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register } = useAuth();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    const result = register({
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
    <div className="relative min-h-screen overflow-hidden gradient-hero">
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-30"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%)]" />
      <div className="absolute -left-12 top-16 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-200/10 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/10 bg-slate-950/10 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-white">
              <img src={logo} alt="ZenWaste" className="w-28 h-auto" />
              <span className="font-bold text-lg sm:text-xl">ZenWaste</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-lg animate-fade-in border-border/70 bg-background/90 shadow-[0_28px_80px_rgba(15,23,42,0.32)] backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <img src={logo} alt="ZenWaste" className="w-32 h-auto shrink-0" />
                <span className="font-bold text-xl text-foreground">ZenWaste</span>
              </div>
              <CardTitle className="text-2xl">Cadastro Empresarial</CardTitle>
              <CardDescription>Apenas empresas com CNPJ valido podem se cadastrar</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="razao">Razao Social</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="razao"
                      placeholder="Razao Social da Empresa"
                      className="pl-10"
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
                    value={form.cnpj}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    required
                  />
                  {cnpjError && <p className="text-sm text-destructive">{cnpjError}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Segmento de Atuacao</Label>
                  <Select
                    value={form.segmento}
                    onValueChange={(value) => setForm({ ...form, segmento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="contato@empresa.com"
                        className="pl-10"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tel">Telefone / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="tel"
                        placeholder="(00) 00000-0000"
                        className="pl-10"
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
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="pass"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmar Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Criar Conta
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Ja tem conta?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Fazer login
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
