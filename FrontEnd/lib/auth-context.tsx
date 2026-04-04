"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Company } from "./types"

interface AuthContextType {
  user: Company | null
  login: (email: string, password: string) => Promise<boolean>
  register: (company: Omit<Company, "id" | "createdAt">) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem("residuos_user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    const companies: Company[] = JSON.parse(localStorage.getItem("residuos_companies") || "[]")
    const company = companies.find((c) => c.email === email && c.password === password)

    if (company) {
      setUser(company)
      localStorage.setItem("residuos_user", JSON.stringify(company))
      return true
    }
    return false
  }

  const register = async (companyData: Omit<Company, "id" | "createdAt">): Promise<boolean> => {
    const companies: Company[] = JSON.parse(localStorage.getItem("residuos_companies") || "[]")

    if (companies.some((c) => c.email === companyData.email || c.cnpj === companyData.cnpj)) {
      return false
    }

    const newCompany: Company = {
      ...companyData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }

    companies.push(newCompany)
    localStorage.setItem("residuos_companies", JSON.stringify(companies))
    setUser(newCompany)
    localStorage.setItem("residuos_user", JSON.stringify(newCompany))
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("residuos_user")
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
