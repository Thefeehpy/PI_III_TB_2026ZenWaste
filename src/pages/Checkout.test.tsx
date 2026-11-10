import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { empresaR1, promessaControlada } from "@/test/fixtures/acesso";
import { marketplaceItems } from "@/test/fixtures/anuncios";
import type { PaymentOrder } from "@/types/payment";
import { ErroApi } from "@/services/cliente-http";
import Checkout from "./Checkout";

type Auth = ReturnType<typeof useAuth>;
const mocks = vi.hoisted(() => ({ auth: {} as Auth, criar: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/contexts/MarketplaceContext", () => ({ useAnuncios: () => ({ anuncios: marketplaceItems, carregando: false, erro: null, atualizarAnuncios: vi.fn() }) }));
vi.mock("@/hooks/use-payments", () => ({ usePayments: () => ({ service: { createOrder: mocks.criar } }) }));
const caminho = `/checkout/${marketplaceItems[0].id}`;
function arvore() {
  return <MemoryRouter initialEntries={[caminho]}><Routes>
    <Route path="/checkout/:itemId" element={<Checkout />} />
    <Route path="/checkout/payment/:orderId" element={<p>Próxima etapa de pagamento</p>} />
    <Route path="/login" element={<p>Faça login</p>} />
  </Routes></MemoryRouter>;
}
function enviar() {
  fireEvent.click(screen.getByLabelText(/Revisei os dados/));
  fireEvent.submit(screen.getByRole("button", { name: /Ir para pagamento/ }).closest("form")!);
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VITE_PAYMENT_MODE", "backend");
  window.scrollTo = vi.fn();
  mocks.auth = { user: empresaR1, isAuthenticated: true, isLoading: false, sessionStatus: "validated", sessionError: null,
    sessionVersion: 1, retrySession: vi.fn(), logout: vi.fn(), login: vi.fn(), register: vi.fn() };
  mocks.criar.mockResolvedValue({ id: "pedido-ficticio" });
});
afterEach(() => vi.unstubAllEnvs());

describe("checkout empresarial R1", () => {
  it("mostra empresa e CNPJ fixo e mantém o payload esperado", async () => {
    render(arvore());
    const documento = screen.getByLabelText("CNPJ da empresa autenticada");
    expect(documento).toHaveAttribute("readonly");
    expect(screen.getByText(/Compra realizada por/)).toHaveTextContent(empresaR1.razaoSocial);
    fireEvent.change(documento, { target: { value: "52998224725" } });
    expect(documento).toHaveValue("11.222.333/0001-81");
    enviar();
    await screen.findByText("Próxima etapa de pagamento");
    expect(mocks.criar).toHaveBeenCalledTimes(1);
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ buyer: {
      name: empresaR1.razaoSocial, email: empresaR1.email, document: empresaR1.cnpj, phone: empresaR1.telefone,
    }, idempotencyKey: expect.any(String) }));
  });

  it("recusa CPF na identidade empresarial antes de enviar", () => {
    mocks.auth.user = { ...empresaR1, cnpj: "52998224725" };
    render(arvore()); enviar();
    expect(screen.getByText(/exige um CNPJ válido/)).toBeInTheDocument();
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it("impede envio com campos obrigatórios vazios e mostra limites de contato", () => {
    render(arvore());
    const nome = screen.getByLabelText("Nome do contato ou razão social");
    expect(nome).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("maxlength", "256");
    fireEvent.change(nome, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Telefone com DDD"), { target: { value: "123" } });
    enviar();
    expect(mocks.criar).not.toHaveBeenCalled();
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/10 a 13 dígitos/)).toBeInTheDocument();
  });

  it("associa erros aninhados do backend ao campo de contato", async () => {
    mocks.criar.mockRejectedValue(new ErroApi("Revise o telefone.", 400, { detalhes: { buyer: { phone: ["Telefone recusado pelo servidor."] } } }));
    render(arvore()); enviar();
    await screen.findByText("Telefone recusado pelo servidor.");
    expect(screen.getByLabelText("Telefone com DDD")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Revise o telefone.");
  });

  it("não mostra formulário de compra durante sessão não validada", () => {
    mocks.auth = { ...mocks.auth, user: null, isAuthenticated: false, sessionStatus: "unavailable", sessionError: "Tente novamente." };
    render(arvore());
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ir para pagamento/ })).not.toBeInTheDocument();
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it("descarta rascunho e navegação tardia após trocar de empresa", async () => {
    const pedido = promessaControlada<PaymentOrder>();
    mocks.criar.mockReturnValue(pedido.promessa);
    const tela = render(arvore()); enviar();
    mocks.auth = { ...mocks.auth, user: { ...empresaR1, id: "102", razaoSocial: "Outra FICTÍCIA", cnpj: "11444777000161" }, sessionVersion: 2 };
    tela.rerender(arvore());
    expect(screen.getByLabelText("Nome do contato ou razão social")).toHaveValue("Outra FICTÍCIA");
    expect(screen.getByLabelText("CNPJ da empresa autenticada")).toHaveValue("11.444.777/0001-61");
    await act(() => pedido.resolver({ id: "pedido-anterior" } as PaymentOrder));
    expect(screen.queryByText("Próxima etapa de pagamento")).not.toBeInTheDocument();
  });

  it("mantém compra demonstrativa sem empresa e com CPF", async () => {
    vi.stubEnv("VITE_PAYMENT_MODE", "demo");
    mocks.auth = { ...mocks.auth, user: null, isAuthenticated: false, sessionStatus: "anonymous" };
    render(arvore());
    for (const [label, valor] of [["Nome completo ou razão social", "Pessoa FICTÍCIA"], ["CPF ou CNPJ", "52998224725"], ["Telefone com DDD", "11999999999"], ["E-mail", "demo@example.invalid"]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });
    }
    enviar(); await screen.findByText("Próxima etapa de pagamento");
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ buyer: expect.objectContaining({ document: "52998224725" }) }));
  });
});
