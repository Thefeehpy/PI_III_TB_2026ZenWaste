import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { armazenarTokenAutenticacao, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";
import type { EmpresaAutenticada } from "@/types/empresa";

const simulacoes = vi.hoisted(() => ({ obterEmpresaAtual: vi.fn(), entrar: vi.fn(), sair: vi.fn() }));
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
afterEach(removerTokenAutenticacao);

describe("sessão da empresa", () => {
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
