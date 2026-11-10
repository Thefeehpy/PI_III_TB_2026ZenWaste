import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import Login from "./Login";
import Register from "./Register";
import { promessaControlada } from "@/test/fixtures/acesso";

type Auth = ReturnType<typeof useAuth>;
const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), toast: vi.fn(), auth: {} as Auth }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear(); window.sessionStorage.clear();
  mocks.auth = { user: null, isAuthenticated: false, isLoading: false, sessionStatus: "anonymous", sessionError: null,
    sessionVersion: 0, retrySession: vi.fn(), logout: vi.fn(), login: mocks.login, register: mocks.register };
});
function abrir(cadastro = false) {
  return render(<MemoryRouter initialEntries={[cadastro ? "/register" : "/login"]}><Routes>
    <Route path={cadastro ? "/register" : "/login"} element={cadastro ? <Register /> : <Login />} />
    <Route path="/dashboard" element={<p>Painel autenticado</p>} />
    <Route path="/login" element={<p>Destino login</p>} />
    <Route path="/carrier/dashboard" element={<p>Demo transportadora</p>} />
    <Route path="/delivery-signature/5842" element={<p>Demo canhoto</p>} />
  </Routes></MemoryRouter>);
}
function preencher(cadastro = false) {
  if (cadastro) {
    fireEvent.change(screen.getByLabelText("Razao Social"), { target: { value: "Empresa FICTÍCIA" } });
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11222333000181" } });
    fireEvent.change(screen.getByLabelText("Telefone / WhatsApp"), { target: { value: "11999999999" } });
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), { target: { value: "senha-ficticia-r1" } });
  }
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), { target: { value: "senha-ficticia-r1" } });
}

describe("submissão dos formulários empresariais", () => {
  it.each([false, true])("bloqueia repetição e permite recuperar falha (cadastro=%s)", async (cadastro) => {
    const primeira = promessaControlada<{ success: boolean; message?: string }>();
    const executar = cadastro ? mocks.register : mocks.login;
    executar.mockReturnValueOnce(primeira.promessa).mockResolvedValueOnce({ success: true });
    abrir(cadastro); preencher(cadastro);
    const botao = screen.getByRole("button", { name: cadastro ? "Criar conta" : "Entrar no painel" });
    const form = botao.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form); fireEvent.submit(form);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(botao).toBeDisabled();
    await act(() => primeira.resolver({ success: false, message: "Conexão indisponível. Tente novamente." }));
    expect(screen.getByRole("alert")).toHaveTextContent("Conexão indisponível");
    expect(botao).not.toBeDisabled();
    fireEvent.submit(form);
    await screen.findByText(cadastro ? "Destino login" : "Painel autenticado");
    expect(executar).toHaveBeenCalledTimes(2);
    expect(Object.values(window.localStorage).join(" ")).not.toContain("senha-ficticia-r1");
    expect(Object.values(window.sessionStorage).join(" ")).not.toContain("senha-ficticia-r1");
  });

  it("cancela o formulário desmontado sem anunciar sucesso tardio", async () => {
    const consulta = promessaControlada<{ success: boolean }>();
    mocks.login.mockReturnValue(consulta.promessa);
    const tela = abrir(); preencher();
    fireEvent.submit(screen.getByRole("button", { name: "Entrar no painel" }).closest("form")!);
    const signal = mocks.login.mock.calls[0][2] as AbortSignal;
    tela.unmount();
    expect(signal.aborted).toBe(true);
    await act(() => consulta.resolver({ success: true }));
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("não anuncia cadastro concluído quando o contexto marca a resposta como antiga", async () => {
    mocks.register.mockResolvedValue({ success: false, cancelled: true });
    abrir(true); preencher(true);
    fireEvent.submit(screen.getByRole("button", { name: "Criar conta" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar conta" })).not.toBeDisabled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it.each([false, true])("abre demo sem pedir senha nem chamar autenticação (cadastro=%s)", async (cadastro) => {
    abrir(cadastro);
    fireEvent.click(screen.getByRole("button", { name: /Entregador \/ Transportador/ }));
    expect(screen.getByLabelText("Aviso de demonstração")).toHaveTextContent("dados fictícios");
    expect(screen.queryByLabelText("Senha", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir demonstração da transportadora" }));
    await screen.findByText("Demo transportadora");
    expect(mocks.login).not.toHaveBeenCalled(); expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Demonstração" }));
  });
});
