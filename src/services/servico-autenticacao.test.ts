import { afterEach, describe, expect, it, vi } from "vitest";
import { servicoAutenticacao } from "./servico-autenticacao";
import { empresaR1 } from "@/test/fixtures/acesso";

afterEach(() => vi.unstubAllGlobals());
describe("contratos empresariais de autenticação", () => {
  it.each([{}, { user: {} }, { user: { ...empresaR1, ativo: false } }, { user: { ...empresaR1, roles: ["motorista"] } }, { user: { ...empresaR1, cnpj: "123" } }])("não confirma uma identidade incompleta ou inválida", async (resposta) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(resposta), { status: 200 })));
    await expect(servicoAutenticacao.obterEmpresaAtual()).rejects.toMatchObject({ status: 200, tipo: "resposta_invalida" });
  });
  it("encaminha o sinal e aceita os papéis empresariais existentes", async () => {
    const executar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: empresaR1 }), { status: 200 }));
    vi.stubGlobal("fetch", executar);
    const controle = new AbortController();
    await expect(servicoAutenticacao.obterEmpresaAtual({ signal: controle.signal })).resolves.toEqual({ user: empresaR1 });
    expect(executar.mock.calls[0][1].signal).toBe(controle.signal);
  });
  it("rejeita login sem credencial, mesmo com dados empresariais", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: empresaR1 }), { status: 200 })));
    await expect(servicoAutenticacao.entrar("teste@example.invalid", "senha-ficticia")).rejects.toMatchObject({ tipo: "resposta_invalida" });
  });
  it("preserva payload e resposta de login", async () => {
    const executar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "ficticio", user: empresaR1 }), { status: 200 }));
    vi.stubGlobal("fetch", executar);
    await expect(servicoAutenticacao.entrar("teste@example.invalid", "senha-ficticia")).resolves.toEqual({ token: "ficticio", user: empresaR1 });
    expect(JSON.parse(executar.mock.calls[0][1].body)).toEqual({ email: "teste@example.invalid", password: "senha-ficticia" });
  });
});
