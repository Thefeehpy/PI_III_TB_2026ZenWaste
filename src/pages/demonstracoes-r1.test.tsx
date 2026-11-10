import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CarrierDashboard from "./CarrierDashboard";
import DriverDeliveries from "./DriverDeliveries";
import ClientDeliverySignature from "./ClientDeliverySignature";
import { armazenarTokenAutenticacao, obterTokenAutenticacao, removerTokenAutenticacao } from "@/services/cliente-http";

vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/QrCodePreview", () => ({ QrCodePreview: () => <p>QR fictício</p> }));
vi.mock("@/components/SignaturePad", () => ({ SignaturePad: ({ onChange }: { onChange: (valor: string) => void }) =>
  <button onClick={() => onChange("assinatura-ficticia-para-teste-ui")}>Desenhar assinatura fictícia</button> }));

const executar = vi.fn();
beforeEach(() => { executar.mockReset(); vi.stubGlobal("fetch", executar); armazenarTokenAutenticacao("token-empresarial-ficticio"); });
afterEach(() => { removerTokenAutenticacao(); vi.unstubAllGlobals(); });
function abrir(caminho: string) {
  return render(<MemoryRouter initialEntries={[caminho]}><Routes>
    <Route path="/carrier/dashboard" element={<CarrierDashboard />} />
    <Route path="/driver/deliveries" element={<DriverDeliveries />} />
    <Route path="/delivery-signature/:orderNumber" element={<ClientDeliverySignature />} />
  </Routes></MemoryRouter>);
}
describe("fronteira das demonstrações", () => {
  it.each(["/carrier/dashboard", "/driver/deliveries", "/delivery-signature/5842"])("identifica acesso direto a %s sem consumir token ou API", (caminho) => {
    abrir(caminho);
    expect(screen.getByLabelText("Aviso de demonstração")).toHaveTextContent("não alteram pedidos, fretes ou entregas reais");
    expect(obterTokenAutenticacao()).toBe("token-empresarial-ficticio");
    expect(executar).not.toHaveBeenCalled();
  });
  it("simula proposta e não comunica envio operacional", () => {
    abrir("/carrier/dashboard");
    fireEvent.click(screen.getAllByRole("button", { name: "Ver mais" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Simular proposta" }));
    expect(screen.getByRole("button", { name: "Proposta simulada" })).toBeDisabled();
    expect(screen.queryByText("Proposta enviada")).not.toBeInTheDocument();
    expect(executar).not.toHaveBeenCalled();
  });
  it("simula canhoto sem afirmar persistência de recebimento", () => {
    abrir("/delivery-signature/5842");
    fireEvent.change(screen.getByLabelText("Nome de quem recebeu"), { target: { value: "Maria Souza" } });
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "12345678901" } });
    fireEvent.click(screen.getByRole("button", { name: "Liberar assinatura" }));
    fireEvent.click(screen.getByRole("button", { name: "Desenhar assinatura fictícia" }));
    fireEvent.click(screen.getByRole("button", { name: "Simular recebimento" }));
    expect(screen.getByText("Recebimento simulado")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum canhoto foi gravado no backend/)).toBeInTheDocument();
    expect(screen.queryByText("Entrega confirmada")).not.toBeInTheDocument();
    expect(executar).not.toHaveBeenCalled();
  });
});
