"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Recycle, Mail, Lock, Eye, EyeOff } from "lucide-react"

interface LoginFormProps {
  onSwitchToRegister: () => void
  onSuccess: () => void
}

export function LoginForm({ onSwitchToRegister, onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const success = await login(email, password)
    
    if (success) {
      onSuccess()
    } else {
      setError("Email ou senha incorretos")
    }
    setIsLoading(false)
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-2xl bg-card/95 backdrop-blur-lg">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-xl shadow-violet-600/30 transition-transform duration-300 hover:scale-105">
          <Recycle className="h-10 w-10 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Bem-vindo de volta</CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          Entre na sua conta para acessar o marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email" className="text-foreground font-medium">Email</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500 dark:text-blue-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="empresa@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 text-base bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="password" className="text-foreground font-medium">Senha</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-500 dark:text-violet-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 h-12 text-base bg-muted/50 border-border focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>
          </FieldGroup>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-500 text-center font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-violet-600/30 transition-all duration-300 hover:shadow-xl hover:shadow-violet-600/40 hover:-translate-y-0.5"
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2" /> : null}
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-muted-foreground">Novo por aqui?</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="w-full py-3 px-4 rounded-lg border-2 border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-500/10 hover:border-blue-500/50 transition-all duration-300"
          >
            Cadastre sua empresa
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
