import { afterEach, describe, expect, it, vi } from "vitest";
import { armazenarTokenAutenticacao, ErroApi, removerTokenAutenticacao, requisitar } from "./cliente-http";

describe("cliente HTTP compartilhado", () => {
  afterEach(() => {
    removerTokenAutenticacao();
    vi.unstubAllGlobals();
  });

  it("preserva autenticação, idempotência e cancelamento em uma requisição", async () => {
    armazenarTokenAutenticacao("token-assinado-de-teste");
    const controle = new AbortController();
    const executar = vi.fn().mockResolvedValue(new Response('{"id":"pedido"}', { status: 201 }));
    vi.stubGlobal("fetch", executar);

    expect(await requisitar("/orders/", {
      method: "POST", body: '{"quantity":1}',
      headers: { "Idempotency-Key": "chave-de-teste" }, signal: controle.signal,
    })).toEqual({ id: "pedido" });

    const [url, opcoes] = executar.mock.calls[0] as [string, RequestInit];
    const cabecalhos = new Headers(opcoes.headers);
    expect(url).toBe("http://127.0.0.1:8000/api/orders/");
    expect(cabecalhos.get("Authorization")).toBe("Bearer token-assinado-de-teste");
    expect(cabecalhos.get("Idempotency-Key")).toBe("chave-de-teste");
    expect(cabecalhos.get("Content-Type")).toBe("application/json");
    expect(opcoes.signal).toBe(controle.signal);
  });

  it("extrai validação aninhada do Django e mantém o status HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ images: [{ url: ["Informe uma imagem válida."] }] }), { status: 400 },
    )));
    await expect(requisitar("/marketplace/ads/")).rejects.toMatchObject({
      message: "Informe uma imagem válida.", status: 400,
    });
  });

  it("não apresenta conteúdo HTML do servidor como mensagem de erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>proxy indisponível</html>", { status: 502 })));
    await expect(requisitar("/inventory/items/")).rejects.toMatchObject({
      message: "A requisição não pôde ser concluída.", status: 502,
    });
  });

  it.each(["<html>login</html>", ""])("rejeita sucesso sem JSON válido: %s", async (conteudo) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(conteudo, { status: 200 })));
    await expect(requisitar("/inventory/items/")).rejects.toBeInstanceOf(ErroApi);
  });

  it("aceita DELETE com status 204 sem conteúdo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(requisitar<void>("/marketplace/ads/1/", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("distingue falha de rede de cancelamento intencional", async () => {
    const executar = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", executar);
    await expect(requisitar("/inventory/items/")).rejects.toMatchObject({ status: 0 });

    const cancelamento = new DOMException("Cancelada", "AbortError");
    executar.mockRejectedValueOnce(cancelamento);
    await expect(requisitar("/inventory/items/")).rejects.toBe(cancelamento);
  });
});
