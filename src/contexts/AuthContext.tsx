import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { servicoAutenticacao } from "@/services/servico-autenticacao";
import { armazenarTokenAutenticacao, ErroApi, EVENTO_SESSAO_ALTERADA, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";
import type { CadastroEmpresa, EmpresaAutenticada } from "@/types/empresa";

export type AuthUser = EmpresaAutenticada;
type SituacaoSessao = "anonymous" | "validating" | "validated" | "unavailable";
interface ResultadoAutenticacao { success: boolean; message?: string; cancelled?: boolean }
interface EstadoSessao {
  empresa: AuthUser | null;
  token: string | null;
  situacao: SituacaoSessao;
  erro: string | null;
  versao: number;
}
interface TentativaSessao { geracao: number; token: string | null; controle: AbortController }

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionStatus: SituacaoSessao;
  sessionError: string | null;
  sessionVersion: number;
  retrySession: () => Promise<void>;
  login: (email: string, password: string, signal?: AbortSignal) => Promise<ResultadoAutenticacao>;
  register: (input: CadastroEmpresa, signal?: AbortSignal) => Promise<ResultadoAutenticacao>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const MENSAGEM_RECUPERACAO = "Não foi possível confirmar sua sessão. Tente novamente ou entre com outra conta.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, definirEstado] = useState<EstadoSessao>(() => {
    const token = obterTokenAutenticacao();
    return { empresa: null, token, situacao: token ? "validating" : "anonymous", erro: null, versao: 0 };
  });
  const geracaoSessao = useRef(0);
  const montado = useRef(false);
  const consultaAtual = useRef<AbortController | null>(null);
  const tokenObservado = useRef(estado.token);

  const iniciar = useCallback((): TentativaSessao => {
    consultaAtual.current?.abort();
    const controle = new AbortController();
    consultaAtual.current = controle;
    const token = obterTokenAutenticacao();
    tokenObservado.current = token;
    const geracao = ++geracaoSessao.current;
    definirEstado({ empresa: null, token, situacao: "validating", erro: null, versao: geracao });
    return { controle, token, geracao };
  }, []);

  const atual = useCallback((tentativa: TentativaSessao) =>
    montado.current && geracaoSessao.current === tentativa.geracao && obterTokenAutenticacao() === tentativa.token, []);

  const restaurarSessao = useCallback(async () => {
    const tentativa = iniciar();
    if (!tentativa.token) {
      definirEstado({ empresa: null, token: null, situacao: "anonymous", erro: null, versao: tentativa.geracao });
      return;
    }
    const limite = window.setTimeout(() => {
      tentativa.controle.abort(new DOMException("Tempo de consulta esgotado.", "TimeoutError"));
      if (atual(tentativa)) definirEstado({ empresa: null, token: tentativa.token, situacao: "unavailable", erro: MENSAGEM_RECUPERACAO, versao: tentativa.geracao });
    }, 15000);
    const limparLimite = () => window.clearTimeout(limite);
    tentativa.controle.signal.addEventListener("abort", limparLimite, { once: true });
    try {
      const { user } = await servicoAutenticacao.obterEmpresaAtual({ signal: tentativa.controle.signal });
      if (atual(tentativa) && !tentativa.controle.signal.aborted) {
        definirEstado({ empresa: user, token: tentativa.token, situacao: "validated", erro: null, versao: tentativa.geracao });
      }
    } catch (erro) {
      if (!atual(tentativa)) return;
      if (erro instanceof ErroApi && erro.status === 401) {
        tokenObservado.current = null;
        removerTokenAutenticacao();
        definirEstado({ empresa: null, token: null, situacao: "anonymous", erro: null, versao: tentativa.geracao });
      } else {
        definirEstado({ empresa: null, token: tentativa.token, situacao: "unavailable", erro: MENSAGEM_RECUPERACAO, versao: tentativa.geracao });
      }
    } finally {
      limparLimite();
      tentativa.controle.signal.removeEventListener("abort", limparLimite);
    }
  }, [atual, iniciar]);

  useEffect(() => {
    montado.current = true;
    const aoAlterarToken = () => {
      if (obterTokenAutenticacao() !== tokenObservado.current) void restaurarSessao();
    };
    window.addEventListener("storage", aoAlterarToken);
    window.addEventListener(EVENTO_SESSAO_ALTERADA, aoAlterarToken);
    void restaurarSessao();
    return () => {
      montado.current = false;
      consultaAtual.current?.abort();
      window.removeEventListener("storage", aoAlterarToken);
      window.removeEventListener(EVENTO_SESSAO_ALTERADA, aoAlterarToken);
    };
  }, [restaurarSessao]);

  const login = useCallback(async (email: string, senha: string, signal?: AbortSignal): Promise<ResultadoAutenticacao> => {
    const tentativa = iniciar();
    const cancelar = () => tentativa.controle.abort(signal?.reason);
    signal?.addEventListener("abort", cancelar, { once: true });
    if (signal?.aborted) cancelar();
    try {
      const resposta = await servicoAutenticacao.entrar(email, senha, { signal: tentativa.controle.signal });
      if (!atual(tentativa)) return { success: false, cancelled: true };
      if (tentativa.controle.signal.aborted) {
        definirEstado({ empresa: null, token: tentativa.token, situacao: tentativa.token ? "unavailable" : "anonymous", erro: tentativa.token ? MENSAGEM_RECUPERACAO : null, versao: tentativa.geracao });
        return { success: false, cancelled: true };
      }
      tokenObservado.current = resposta.token;
      armazenarTokenAutenticacao(resposta.token);
      definirEstado({ empresa: resposta.user, token: resposta.token, situacao: "validated", erro: null, versao: tentativa.geracao });
      return { success: true };
    } catch (erro) {
      if (!atual(tentativa)) return { success: false, cancelled: true };
      definirEstado({
        empresa: null, token: tentativa.token, versao: tentativa.geracao,
        situacao: tentativa.token ? "unavailable" : "anonymous",
        erro: tentativa.token ? MENSAGEM_RECUPERACAO : null,
      });
      return tentativa.controle.signal.aborted ? { success: false, cancelled: true } : {
        success: false, message: erro instanceof Error ? erro.message : "Não foi possível entrar.",
      };
    } finally {
      signal?.removeEventListener("abort", cancelar);
    }
  }, [atual, iniciar]);

  const register = useCallback(async (entrada: CadastroEmpresa, signal?: AbortSignal): Promise<ResultadoAutenticacao> => {
    const geracao = geracaoSessao.current;
    const token = obterTokenAutenticacao();
    const podeAplicar = () => montado.current && geracaoSessao.current === geracao && obterTokenAutenticacao() === token && !signal?.aborted;
    try {
      await servicoAutenticacao.cadastrar(entrada, { signal });
      return podeAplicar() ? { success: true } : { success: false, cancelled: true };
    } catch (erro) {
      return podeAplicar() ? { success: false, message: erro instanceof Error ? erro.message : "Cadastro não concluído." } :
        { success: false, cancelled: true };
    }
  }, []);

  const logout = useCallback(() => {
    const geracao = ++geracaoSessao.current;
    consultaAtual.current?.abort();
    void servicoAutenticacao.sair().catch(() => undefined);
    tokenObservado.current = null;
    removerTokenAutenticacao();
    definirEstado({ empresa: null, token: null, situacao: "anonymous", erro: null, versao: geracao });
  }, []);

  const tokenCoincide = estado.token === obterTokenAutenticacao();
  const valor = useMemo<AuthContextValue>(() => ({
    user: tokenCoincide && estado.situacao === "validated" ? estado.empresa : null,
    isAuthenticated: tokenCoincide && estado.situacao === "validated" && Boolean(estado.empresa?.ativo),
    isLoading: !tokenCoincide || estado.situacao === "validating",
    sessionStatus: tokenCoincide ? estado.situacao : "validating",
    sessionError: tokenCoincide ? estado.erro : null,
    sessionVersion: estado.versao,
    retrySession: restaurarSessao, login, register, logout,
  }), [estado, tokenCoincide, restaurarSessao, login, register, logout]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  return contexto;
}

