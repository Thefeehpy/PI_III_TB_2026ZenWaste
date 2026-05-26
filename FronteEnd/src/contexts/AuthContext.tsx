import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  api,
  clearAuthToken,
  getStoredAuthToken,
  setAuthToken,
  type ApiUser,
  type RegisterInput,
} from "@/lib/api";

export type AuthUser = ApiUser;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (input: RegisterInput) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredAuthToken()));

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setIsLoading(false);
      return;
    }

    let active = true;
    api
      .me()
      .then(({ user: loadedUser }) => {
        if (active) {
          setUser(loadedUser);
        }
      })
      .catch(() => {
        clearAuthToken();
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login: async (email, password) => {
        try {
          const response = await api.login(email, password);
          setAuthToken(response.token);
          setUser(response.user);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel entrar.",
          };
        }
      },
      register: async (input) => {
        try {
          await api.register(input);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Cadastro nao concluido.",
          };
        }
      },
      logout: () => {
        void api.logout().catch(() => undefined);
        clearAuthToken();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
