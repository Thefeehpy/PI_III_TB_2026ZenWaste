import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Leaf, Lock, Mail } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    <div className="relative min-h-screen bg-background">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen">
        <div className="relative hidden items-center justify-center gradient-hero lg:flex lg:w-1/2">
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-30"
          />
          <div className="relative z-10 space-y-6 p-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <img src={logo} alt="ZenWaste" className="h-16 w-16" />
            </div>
            <h1 className="text-4xl font-bold text-secondary-foreground">ZenWaste</h1>
            <p className="mx-auto max-w-md text-lg text-secondary-foreground/80">
              Transforme residuos em ativos financeiros. A plataforma inteligente para a economia circular industrial.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-secondary-foreground/60">
              <Leaf className="h-4 w-4" />
              <span>Economia Circular · Sustentabilidade · Inovacao</span>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
          <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2 lg:hidden">
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
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="empresa@email.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Entrar
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Nao tem conta?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Cadastrar empresa
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
