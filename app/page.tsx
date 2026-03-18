"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { initializeMockData } from "@/lib/mock-data"
import { Recycle, Leaf, BarChart3, MessageSquare, Package } from "lucide-react"

export default function HomePage() {
  const [isLogin, setIsLogin] = useState(true)
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    initializeMockData()
  }, [])

  useEffect(() => {
    if (user && !isLoading) {
      router.push("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
        <div className="animate-pulse text-white text-xl">Carregando...</div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const features = [
    {
      icon: Package,
      title: "Marketplace de Resíduos",
      description: "Compre e venda resíduos industriais de forma legal e segura",
    },
    {
      icon: BarChart3,
      title: "Bolsa de Valores",
      description: "Acompanhe os preços reais dos materiais em tempo real",
    },
    {
      icon: Leaf,
      title: "Controle de Estoque",
      description: "Gerencie seus resíduos e acompanhe metas de produção",
    },
    {
      icon: MessageSquare,
      title: "Chat Integrado",
      description: "Negocie diretamente com outras empresas",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
      <div className="flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                <Recycle className="h-8 w-8 text-emerald-300" />
              </div>
              <h1 className="text-3xl font-bold text-white">ReciclaTrade</h1>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6 text-balance">
              O marketplace B2B para comércio de resíduos industriais
            </h2>

            <p className="text-lg text-emerald-100/80 mb-12 text-pretty">
              Conectamos empresas que geram resíduos com aquelas que podem reaproveitá-los. 
              Economia circular de verdade, com transparência e segurança.
            </p>

            <div className="grid gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                    <feature.icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-emerald-100/70">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Auth Forms */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md lg:max-w-2xl">
            {/* Mobile branding */}
            <div className="mb-8 text-center lg:hidden">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                  <Recycle className="h-6 w-6 text-emerald-300" />
                </div>
                <h1 className="text-2xl font-bold text-white">ReciclaTrade</h1>
              </div>
              <p className="text-emerald-100/80">
                Marketplace B2B de resíduos industriais
              </p>
            </div>

            {isLogin ? (
              <LoginForm
                onSwitchToRegister={() => setIsLogin(false)}
                onSuccess={() => router.push("/dashboard")}
              />
            ) : (
              <RegisterForm
                onSwitchToLogin={() => setIsLogin(true)}
                onSuccess={() => router.push("/dashboard")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
