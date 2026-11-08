import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { servicoAutenticacao } from "@/services/servico-autenticacao";
import { armazenarTokenAutenticacao, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";
import type { CadastroEmpresa, EmpresaAutenticada } from "@/types/empresa";

export type AuthUser = EmpresaAutenticada;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (input: CadastroEmpresa) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [empresa, definirEmpresa] = useState<EmpresaAutenticada | null>(null);
  const [carregando, definirCarregando] = useState(() => Boolean(obterTokenAutenticacao()));
  const geracaoSessao = useRef(0);

  useEffect(() => {
    const tokenConsultado = obterTokenAutenticacao();
    if (!tokenConsultado) {
      definirCarregando(false);
      return;
    }

    let ativo = true;
    const geracao = ++geracaoSessao.current;
    const podeAplicar = () => ativo && geracaoSessao.current === geracao && obterTokenAutenticacao() === tokenConsultado;
    servicoAutenticacao
      .obterEmpresaAtual()
      .then(({ user: empresaCarregada }) => {
        if (podeAplicar()) {
          definirEmpresa(empresaCarregada);
        }
      })
      .catch(() => {
        if (podeAplicar()) {
          removerTokenAutenticacao();
          definirEmpresa(null);
        }
      })
      .finally(() => {
        if (ativo && geracaoSessao.current === geracao) {
          definirCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  const valor = useMemo<AuthContextValue>(
    () => ({
      user: empresa,
      isAuthenticated: Boolean(empresa),
      isLoading: carregando,
      login: async (email, senha) => {
        const geracao = ++geracaoSessao.current;
        try {
          const resposta = await servicoAutenticacao.entrar(email, senha);
          if (geracaoSessao.current !== geracao) return { success: false, message: "A sessão foi alterada durante a autenticação." };
          armazenarTokenAutenticacao(resposta.token);
          definirEmpresa(resposta.user);
          return { success: true };
        } catch (erro) {
          return {
            success: false,
            message: erro instanceof Error ? erro.message : "Não foi possível entrar.",
          };
        } finally {
          if (geracaoSessao.current === geracao) definirCarregando(false);
        }
      },
      register: async (entrada) => {
        try {
          await servicoAutenticacao.cadastrar(entrada);
          return { success: true };
        } catch (erro) {
          return {
            success: false,
            message: erro instanceof Error ? erro.message : "Cadastro não concluído.",
          };
        }
      },
      logout: () => {
        ++geracaoSessao.current;
        void servicoAutenticacao.sair().catch(() => undefined);
        removerTokenAutenticacao();
        definirEmpresa(null);
        definirCarregando(false);
      },
    }),
    [carregando, empresa],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  }

  return contexto;
}

