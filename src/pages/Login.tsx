import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import heroBg from "@/assets/hero-bg.jpg";
import logo from "@/assets/logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const redirectTo = (location.state as { from?: string } | null)?.from || "/dashboard";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = login(email, password);
    if (!result.success) {
      toast({
        title: "Não foi possível entrar",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Login realizado",
      description: "Sua sessão foi restaurada e continuará ativa neste navegador.",
    });
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center gradient-hero">
        <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30" />
        <div className="relative z-10 text-center p-12 space-y-6">
          <div className="flex items-center justify-center gap-3">
            <img src={logo} alt="ZenWaste" className="h-16 w-16" />
          </div>
          <h1 className="text-4xl font-bold text-secondary-foreground">ZenWaste</h1>
          <p className="text-lg text-secondary-foreground/80 max-w-md mx-auto">
            Transforme resíduos em ativos financeiros. A plataforma inteligente para a economia circular industrial.
          </p>
          <div className="flex items-center justify-center gap-2 text-secondary-foreground/60 text-sm">
            <Leaf className="h-4 w-4" />
            <span>Economia Circular · Sustentabilidade · Inovação</span>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2 lg:hidden">
              <img src={logo} alt="ZenWaste" className="h-10 w-10" />
              <span className="font-bold text-xl text-foreground">ZenWaste</span>
            </div>
            <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
            <CardDescription>Entre com suas credenciais para acessar o painel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="empresa@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full">Entrar</Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Não tem conta?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">Cadastrar empresa</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
