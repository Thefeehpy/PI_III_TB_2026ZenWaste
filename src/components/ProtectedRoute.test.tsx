import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { armazenarTokenAutenticacao, ErroApi, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";
import { empresaR1, promessaControlada } from "@/test/fixtures/acesso";

const servico = vi.hoisted(() => ({ obterEmpresaAtual: vi.fn(), sair: vi.fn() }));
vi.mock("@/services/servico-autenticacao", () => ({ servicoAutenticacao: servico }));
function tela() {
  return render(<AuthProvider><MemoryRouter initialEntries={["/protegido"]}><Routes>
    <Route element={<ProtectedRoute />}><Route path="/protegido" element={<button>Operação protegida</button>} /></Route>
    <Route path="/login" element={<p>Autenticação necessária</p>} />
  </Routes></MemoryRouter></AuthProvider>);
}
beforeEach(() => { vi.resetAllMocks(); armazenarTokenAutenticacao("ficticio-r1"); servico.sair.mockResolvedValue({ message: "saiu" }); });
afterEach(removerTokenAutenticacao);
describe("guard de sessão empresarial", () => {
  it("não monta operações durante validação ou 503 e recupera por retry", async () => {
    const consulta = promessaControlada<{ user: typeof empresaR1 }>();
    servico.obterEmpresaAtual.mockReturnValueOnce(consulta.promessa).mockResolvedValueOnce({ user: empresaR1 });
    tela();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando sessão");
    expect(screen.queryByRole("button", { name: "Operação protegida" })).not.toBeInTheDocument();
    consulta.rejeitar(new ErroApi("Indisponível", 503));
    await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.queryByText("Autenticação necessária")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Operação protegida" })).not.toBeInTheDocument();
    expect(obterTokenAutenticacao()).toBe("ficticio-r1");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("button", { name: "Operação protegida" });
  });
  it("invalida somente 401 e redireciona ao login", async () => {
    servico.obterEmpresaAtual.mockRejectedValue(new ErroApi("Inválido", 401));
    tela();
    await screen.findByText("Autenticação necessária");
    expect(obterTokenAutenticacao()).toBeNull();
  });
  it("preserva 403 e permite escolher outra conta explicitamente", async () => {
    servico.obterEmpresaAtual.mockRejectedValue(new ErroApi("Sem permissão", 403));
    tela();
    fireEvent.click(await screen.findByRole("button", { name: "Usar outra conta" }));
    await waitFor(() => expect(obterTokenAutenticacao()).toBeNull());
    await screen.findByText("Autenticação necessária");
  });
});
