import { afterEach, describe, expect, it, vi } from "vitest";
import { armazenarTokenAutenticacao, removerTokenAutenticacao } from "./cliente-http";
import { servicoEnderecos } from "./servico-enderecos";

describe("consulta externa de endereço", () => {
  afterEach(() => { removerTokenAutenticacao(); vi.unstubAllGlobals(); });

  it("adapta ViaCEP sem enviar o token da empresa ao serviço externo", async () => {
    armazenarTokenAutenticacao("token-de-teste");
    const executar = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      logradouro: "Rua de teste", bairro: "Centro", localidade: "Campinas", uf: "SP",
    })));
    vi.stubGlobal("fetch", executar);
    expect(await servicoEnderecos.consultarCep("13010000")).toEqual({
      street: "Rua de teste", neighborhood: "Centro", city: "Campinas", state: "SP",
    });
    const [, opcoes] = executar.mock.calls[0] as [string, RequestInit];
    expect(new Headers(opcoes.headers).has("Authorization")).toBe(false);
  });

  it("um CEP inexistente não produz endereço parcial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"erro":true}')));
    await expect(servicoEnderecos.consultarCep("00000000")).rejects.toThrow("CEP não encontrado.");
  });
});
