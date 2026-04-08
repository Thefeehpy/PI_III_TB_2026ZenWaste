import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Mail, Lock, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCNPJ, validateCNPJ } from "@/utils/cnpj";
import logo from "@/assets/logo.png";

const segments = [
  "Metalurgia",
  "Petroquímica",
  "Alimentos e Bebidas",
  "Papel e Celulose",
  "Automotivo",
  "Construção Civil",
  "Têxtil",
  "Eletrônico",
  "Farmacêutico",
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
      setCnpjError(validateCNPJ(formatted) ? "" : "CNPJ inválido");
    } else {
      setCnpjError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCNPJ(form.cnpj)) {
      setCnpjError("CNPJ inválido. Apenas empresas podem se cadastrar.");
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
        title: "Cadastro não concluído",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Conta criada",
      description: "Agora você já pode entrar com seu e-mail e senha.",
    });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logo} alt="ZenWaste" className="h-10 w-10" />
            <span className="font-bold text-xl text-foreground">ZenWaste</span>
          </div>
          <CardTitle className="text-2xl">Cadastro Empresarial</CardTitle>
          <CardDescription>Apenas empresas com CNPJ válido podem se cadastrar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razao">Razão Social</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="razao" placeholder="Razão Social da Empresa" className="pl-10" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} required />
              {cnpjError && <p className="text-sm text-destructive">{cnpjError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Segmento de Atuação</Label>
              <Select value={form.segmento} onValueChange={(value) => setForm({ ...form, segmento: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="contato@empresa.com" className="pl-10" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel">Telefone / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="tel" placeholder="(00) 00000-0000" className="pl-10" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pass">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="pass" type="password" placeholder="••••••••" className="pl-10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm" type="password" placeholder="••••••••" className="pl-10" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full">Criar Conta</Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Fazer login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
