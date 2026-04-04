"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Recycle, Building2, Mail, Lock, Phone, MapPin, Eye, EyeOff } from "lucide-react"

interface RegisterFormProps {
  onSwitchToLogin: () => void
  onSuccess: () => void
}

const sectors = [
  "Industria Metalurgica",
  "Industria Alimenticia",
  "Industria Quimica",
  "Industria Textil",
  "Industria de Papel e Celulose",
  "Industria de Plasticos",
  "Construcao Civil",
  "Logistica e Transporte",
  "Tecnologia",
  "Varejo",
  "Reciclagem",
  "Outro",
]

const states = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

export function RegisterForm({ onSwitchToLogin, onSuccess }: RegisterFormProps) {
  const { register } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    sector: "",
    description: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18)
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas nao coincidem")
      return
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setIsLoading(true)

    const success = await register({
      name: formData.name,
      cnpj: formData.cnpj,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      sector: formData.sector,
      description: formData.description,
    })

    if (success) {
      onSuccess()
    } else {
      setError("Email ou CNPJ ja cadastrado")
    }
    setIsLoading(false)
  }

  return (
    <Card className="w-full max-w-2xl border-0 shadow-2xl bg-card/95 backdrop-blur-lg">
      <CardHeader className="text-center pb-2 pt-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-xl shadow-violet-600/30 transition-transform duration-300 hover:scale-105">
          <Recycle className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Cadastre sua empresa</CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          Junte-se ao maior marketplace de residuos industriais
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name" className="text-foreground font-medium">Nome da Empresa</FieldLabel>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 dark:text-blue-400" />
                  <Input
                    id="name"
                    placeholder="Empresa LTDA"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="cnpj" className="text-foreground font-medium">CNPJ</FieldLabel>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => handleChange("cnpj", formatCNPJ(e.target.value))}
                  className="h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email" className="text-foreground font-medium">Email</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500 dark:text-violet-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border focus:border-violet-500 focus:ring-violet-500/20"
                    required
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="phone" className="text-foreground font-medium">Telefone</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 dark:text-blue-400" />
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    className="pl-10 h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password" className="text-foreground font-medium">Senha</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500 dark:text-violet-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="pl-10 pr-10 h-11 bg-muted/50 border-border focus:border-violet-500 focus:ring-violet-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Senha</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500 dark:text-violet-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    className="pl-10 pr-10 h-11 bg-muted/50 border-border focus:border-violet-500 focus:ring-violet-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="sector" className="text-foreground font-medium">Setor</FieldLabel>
                <Select value={formData.sector} onValueChange={(value) => handleChange("sector", value)}>
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="state" className="text-foreground font-medium">Estado</FieldLabel>
                <Select value={formData.state} onValueChange={(value) => handleChange("state", value)}>
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="address" className="text-foreground font-medium">Endereco</FieldLabel>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500 dark:text-red-400" />
                <Input
                  id="address"
                  placeholder="Rua, numero, bairro"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="pl-10 h-11 bg-muted/50 border-border focus:border-red-500 focus:ring-red-500/20"
                  required
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="city" className="text-foreground font-medium">Cidade</FieldLabel>
              <Input
                id="city"
                placeholder="Sao Paulo"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="h-11 bg-muted/50 border-border focus:border-blue-500 focus:ring-blue-500/20"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description" className="text-foreground font-medium">Descricao da Empresa (opcional)</FieldLabel>
              <Textarea
                id="description"
                placeholder="Descreva brevemente a atividade da sua empresa..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={2}
                className="bg-muted/50 border-border focus:border-violet-500 focus:ring-violet-500/20 resize-none"
              />
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
            {isLoading ? "Cadastrando..." : "Cadastrar Empresa"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-muted-foreground">Ja tem uma conta?</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full py-3 px-4 rounded-lg border-2 border-violet-500/30 text-violet-600 dark:text-violet-400 font-semibold hover:bg-violet-500/10 hover:border-violet-500/50 transition-all duration-300"
          >
            Fazer login
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
