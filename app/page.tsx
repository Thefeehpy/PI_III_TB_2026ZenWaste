"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { initializeMockData } from "@/lib/mock-data"
import { Recycle, Leaf, BarChart3, Package, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
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

  const handleSwitch = (toLogin: boolean) => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsLogin(toLogin)
      setTimeout(() => {
        setIsAnimating(false)
      }, 50)
    }, 300)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-violet-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-blue-400/30 border-t-violet-400 animate-spin" />
            <Recycle className="absolute inset-0 m-auto h-8 w-8 text-blue-300" />
          </div>
          <p className="text-blue-200 text-lg font-medium animate-pulse">Carregando...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const features = [
    {
      icon: Package,
      title: "Marketplace de Residuos",
      description: "Compre e venda residuos industriais de forma legal e segura",
      color: "from-blue-500 to-blue-700",
    },
    {
      icon: BarChart3,
      title: "Bolsa de Valores",
      description: "Acompanhe os precos reais dos materiais em tempo real",
      color: "from-violet-500 to-violet-700",
    },
    {
      icon: Leaf,
      title: "Controle de Estoque",
      description: "Gerencie seus residuos e acompanhe metas de producao",
      color: "from-blue-600 to-violet-600",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-violet-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl animate-pulse delay-500" />
        <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-red-500/10 blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-8 group">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-violet-600/30 transition-transform duration-300 group-hover:scale-105">
                <Recycle className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">ReciclaTrade</h1>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6 text-balance">
              O marketplace B2B para comercio de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-violet-300 to-blue-400">
                residuos industriais
              </span>
            </h2>

            <p className="text-lg text-blue-100 mb-12 text-pretty leading-relaxed">
              Conectamos empresas que geram residuos com aquelas que podem reaproveitá-los. 
              Economia circular de verdade, com transparencia e seguranca.
            </p>

            <div className="space-y-5">
              {features.map((feature, index) => (
                <div 
                  key={feature.title} 
                  className="flex gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-blue-400/30 hover:translate-x-2"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md bg-gradient-to-br",
                    feature.color
                  )}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-blue-200">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 flex items-center gap-2 text-blue-300">
              <ArrowRight className="h-5 w-5 animate-bounce-x" />
              <span className="text-sm">Cadastre sua empresa e comece a negociar hoje</span>
            </div>
          </div>
        </div>

        {/* Right side - Auth Forms */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md lg:max-w-2xl">
            {/* Mobile branding */}
            <div className="mb-8 text-center lg:hidden">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
                  <Recycle className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">ReciclaTrade</h1>
              </div>
              <p className="text-blue-200">
                Marketplace B2B de residuos industriais
              </p>
            </div>

            {/* Form container with animation */}
            <div 
              className={cn(
                "transition-all duration-300 ease-out",
                isAnimating 
                  ? "opacity-0 scale-95 translate-y-4" 
                  : "opacity-100 scale-100 translate-y-0"
              )}
            >
              {isLogin ? (
                <LoginForm
                  onSwitchToRegister={() => handleSwitch(false)}
                  onSuccess={() => router.push("/dashboard")}
                />
              ) : (
                <RegisterForm
                  onSwitchToLogin={() => handleSwitch(true)}
                  onSuccess={() => router.push("/dashboard")}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
        .animate-bounce-x {
          animation: bounce-x 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
