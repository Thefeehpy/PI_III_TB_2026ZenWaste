import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { armazenarTokenAutenticacao, ErroApi, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";
import type { EmpresaAutenticada } from "@/types/empresa";
import { empresaR1, promessaControlada } from "@/test/fixtures/acesso";

const simulacoes = vi.hoisted(() => ({ obterEmpresaAtual: vi.fn(), entrar: vi.fn(), sair: vi.fn(), cadastrar: vi.fn() }));
vi.mock("@/services/servico-autenticacao", () => ({ servicoAutenticacao: simulacoes }));
const empresa: EmpresaAutenticada = {
  id: "empresa-atual", razaoSocial: "Empresa de teste", cnpj: "11222333000181", email: "teste@example.com",
  telefone: "11999999999", segmento: "Indústria", ativo: true, roles: ["vendedora"],
};
function consultaPendente() {
  let resolver: (dados: { user: EmpresaAutenticada }) => void = () => {};
  let rejeitar: (erro: Error) => void = () => {};
  const promessa = new Promise<{ user: EmpresaAutenticada }>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promessa, resolver, rejeitar };
}
beforeEach(() => {
  vi.resetAllMocks();
  armazenarTokenAutenticacao("token-anterior");
  simulacoes.sair.mockResolvedValue({ message: "Sessão encerrada" });
  simulacoes.entrar.mockResolvedValue({ token: "token-atual", user: empresa });
});
afterEach(() => { removerTokenAutenticacao(); vi.useRealTimers(); });

describe("sessão da empresa", () => {
  it("prioriza o novo login quando dois pedidos respondem fora de ordem", async () => {
    removerTokenAutenticacao();
    const antiga = promessaControlada<{ user: EmpresaAutenticada; token: string }>();
    simulacoes.entrar.mockReturnValueOnce(antiga.promessa).mockResolvedValueOnce({ user: empresa, token: "token-novo" });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    let primeira!: ReturnType<typeof result.current.login>;
    act(() => { primeira = result.current.login("antigo@example.invalid", "ficticia"); });
    await act(() => result.current.login("novo@example.invalid", "ficticia"));
    await act(async () => { antiga.resolver({ user: { ...empresa, id: "antiga" }, token: "token-antigo" }); await primeira; });
    expect(result.current.user?.id).toBe(empresa.id);
    expect(obterTokenAutenticacao()).toBe("token-novo");
  });

  it("descarta resultado do cadastro quando a identidade mudou", async () => {
    removerTokenAutenticacao();
    const cadastro = promessaControlada<{ user: EmpresaAutenticada }>();
    simulacoes.cadastrar.mockReturnValue(cadastro.promessa);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    const resposta = result.current.register({ ...empresaR1, password: "ficticia" });
    await act(() => result.current.login("nova@example.invalid", "ficticia"));
    cadastro.resolver({ user: empresaR1 });
    await expect(resposta).resolves.toMatchObject({ success: false, cancelled: true });
    expect(obterTokenAutenticacao()).toBe("token-atual");
  });

  it("revalida mudança de credencial vinda de outra aba", async () => {
    simulacoes.obterEmpresaAtual.mockResolvedValueOnce({ user: empresa }).mockResolvedValueOnce({ user: { ...empresa, id: "outra-aba" } });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    act(() => {
      window.localStorage.setItem("zenwaste.auth-token", "token-outra-aba");
      window.dispatchEvent(new StorageEvent("storage", { key: "zenwaste.auth-token", newValue: "token-outra-aba" }));
    });
    expect(result.current.user).toBeNull();
    await waitFor(() => expect(result.current.user?.id).toBe("outra-aba"));
  });

  it("permanece anônimo sem consultar /me quando não há credencial", async () => {
    removerTokenAutenticacao();
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(simulacoes.obterEmpresaAtual).not.toHaveBeenCalled();
  });

  it("torna o timeout recuperável mesmo se a requisição não responder", async () => {
    vi.useFakeTimers();
    simulacoes.obterEmpresaAtual.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(result.current.sessionError).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(obterTokenAutenticacao()).toBe("token-anterior");
  });

  it("não aplica a resposta de uma tentativa substituída por retry", async () => {
    const anterior = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValueOnce(anterior.promessa).mockResolvedValueOnce({ user: empresa });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await act(() => result.current.retrySession());
    await act(() => anterior.rejeitar(new ErroApi("Antiga", 401)));
    expect(result.current.isAuthenticated).toBe(true);
    expect(obterTokenAutenticacao()).toBe("token-anterior");
  });

  it("uma mudança de token bloqueia a identidade antiga até validar a nova", async () => {
    const anterior = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValueOnce(anterior.promessa)
      .mockResolvedValueOnce({ user: { ...empresa, id: "empresa-nova" } });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => armazenarTokenAutenticacao("token-novo"));
    expect(result.current.user).toBeNull();
    await waitFor(() => expect(result.current.user?.id).toBe("empresa-nova"));
    await act(() => anterior.resolver({ user: empresa }));
    expect(result.current.user?.id).toBe("empresa-nova");
    expect(obterTokenAutenticacao()).toBe("token-novo");
  });

  it("descarta login tardio depois de logout", async () => {
    removerTokenAutenticacao();
    let resolver!: (valor: { token: string; user: EmpresaAutenticada }) => void;
    simulacoes.entrar.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    let resposta!: ReturnType<typeof result.current.login>;
    act(() => { resposta = result.current.login("teste@example.com", "ficticia"); });
    act(() => result.current.logout());
    await act(async () => { resolver({ token: "nao-aplicar", user: empresa }); await resposta; });
    expect(result.current.isAuthenticated).toBe(false);
    expect(obterTokenAutenticacao()).toBeNull();
  });

  it("confirma a empresa apenas após uma resposta válida", async () => {
    const consulta = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValue(consulta.promessa);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(false);
    await act(() => consulta.resolver({ user: empresa }));
    expect(result.current.user).toEqual(empresa);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("remove a credencial consultada quando /me responde 401", async () => {
    simulacoes.obterEmpresaAtual.mockRejectedValue(new ErroApi("Credencial inválida", 401));
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(obterTokenAutenticacao()).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it.each([
    ["503", new ErroApi("Indisponível", 503)],
    ["403", new ErroApi("Sem permissão", 403)],
    ["rede", new ErroApi("Falha de conexão", 0)],
    ["timeout", new DOMException("Tempo esgotado", "TimeoutError")],
  ])("preserva token sem liberar a empresa após falha de %s", async (_, erro) => {
    simulacoes.obterEmpresaAtual.mockRejectedValue(erro);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(obterTokenAutenticacao()).toBe("token-anterior");
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionError).toBeTruthy();
  });

  it("recupera a sessão ao tentar novamente depois de 503", async () => {
    simulacoes.obterEmpresaAtual.mockRejectedValueOnce(new ErroApi("Indisponível", 503))
      .mockResolvedValueOnce({ user: empresa });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.retrySession());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(obterTokenAutenticacao()).toBe("token-anterior");
    expect(result.current.sessionError).toBeNull();
  });

  it("um 401 antigo não apaga a credencial de um novo login", async () => {
    const consulta = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValue(consulta.promessa);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await act(() => result.current.login("teste@example.com", "senha-de-teste"));
    await act(() => consulta.rejeitar(new ErroApi("Expirou", 401)));
    expect(obterTokenAutenticacao()).toBe("token-atual");
    expect(result.current.user).toEqual(empresa);
  });

  it("uma consulta antiga não autentica novamente após sair da conta", async () => {
    const consulta = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValue(consulta.promessa);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => result.current.logout());
    await act(() => consulta.resolver({ user: empresa }));
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(obterTokenAutenticacao()).toBeNull();
  });

  it.each(["sucesso", "falha"])("o %s de uma consulta anterior preserva a nova autenticação", async (resultado) => {
    const consulta = consultaPendente();
    simulacoes.obterEmpresaAtual.mockReturnValue(consulta.promessa);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    await act(() => result.current.login("teste@example.com", "senha-de-teste"));
    await act(() => resultado === "sucesso"
      ? consulta.resolver({ user: { ...empresa, id: "empresa-anterior" } })
      : consulta.rejeitar(new Error("Token anterior expirado")));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.id).toBe("empresa-atual");
    expect(obterTokenAutenticacao()).toBe("token-atual");
  });
});
