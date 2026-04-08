import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const USERS_STORAGE_KEY = "zenwaste.users";
const SESSION_STORAGE_KEY = "zenwaste.session";

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
  login: (email: string, password: string) => { success: boolean; message?: string };
  register: (input: RegisterInput) => { success: boolean; message?: string };
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
    login: (email, password) => {
      const foundUser = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());

      if (!foundUser || foundUser.password !== password) {
        return { success: false, message: "E-mail ou senha inválidos." };
      }

      setUser(foundUser);
      return { success: true };
    },
    register: (input) => {
      const alreadyExists = users.some((candidate) => candidate.email.toLowerCase() === input.email.toLowerCase());

      if (alreadyExists) {
        return { success: false, message: "Já existe uma conta com este e-mail." };
      }

      const newUser: AuthUser = {
        id: crypto.randomUUID(),
        ...input,
      };

      setUsers((current) => [...current, newUser]);
      return { success: true };
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
