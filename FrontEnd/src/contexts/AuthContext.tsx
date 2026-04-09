import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const USERS_STORAGE_KEY = "zenwaste.users";
const SESSION_STORAGE_KEY = "zenwaste.session";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export interface AuthUser {
  id: string;
  razaoSocial: string;
  cnpj: string;
  segmento: string;
  email: string;
  telefone: string;
  password: string;
}

type RegisterInput = Omit<AuthUser, "id">;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (input: RegisterInput) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readUsers(): AuthUser[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthUser[]) : [];
  } catch {
    return [];
  }
}

function readSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const values = Object.values(data as Record<string, unknown>);
  const firstValue = values[0];

  if (typeof firstValue === "string") {
    return firstValue;
  }

  if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
    return firstValue[0];
  }

  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AuthUser[]>(() => readUsers());
  const [user, setUser] = useState<AuthUser | null>(() => readSession());

  useEffect(() => {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (user) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      return;
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    login: async (email, password) => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, message: data.message ?? "E-mail ou senha invalidos." };
        }

        const authenticatedUser: AuthUser = {
          id: data.empresa.id,
          razaoSocial: data.empresa.razaoSocial,
          cnpj: data.empresa.cnpj,
          segmento: data.empresa.segmento,
          email: data.empresa.email,
          telefone: data.empresa.telefone,
          password: "",
        };

        setUser(authenticatedUser);
        return { success: true };
      } catch {
        return { success: false, message: "Nao foi possivel conectar ao servidor de login." };
      }
    },
    register: async (input) => {
      try {
        const response = await fetch(`${API_BASE_URL}/empresa/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cnpj: input.cnpj.replace(/\D/g, ""),
            razao_social: input.razaoSocial,
            telefone_whatsapp: input.telefone,
            descricao_segmento: input.segmento,
            email: input.email,
            senha: input.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            message: extractErrorMessage(data, "Nao foi possivel concluir o cadastro."),
          };
        }

        return { success: true };
      } catch {
        return { success: false, message: "Nao foi possivel conectar ao servidor de cadastro." };
      }
    },
    logout: () => {
      setUser(null);
    },
  }), [user, users]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
