import { webcrypto as criptografia } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi, requisitar } from "@/services/cliente-http";
import { freteSintetico } from "@/test/fixtures/fretes";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";

const sessao = vi.hoisted(() => ({ token: "token-sintetico" }));
vi.mock("@/services/cliente-http", async (original) => ({
  ...(await original<typeof import("@/services/cliente-http")>()),
  obterTokenAutenticacao: () => sessao.token,
  requisitar: vi.fn(),
}));
beforeEach(() => {
  sessao.token = "token-sintetico";
  vi.stubGlobal("crypto", criptografia);
  vi.mocked(requisitar).mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("serviço HTTP de auditoria", () => {
  it("consulta filtros e diretórios com paginação real", async () => {
    vi.mocked(requisitar).mockResolvedValue({ resultados: [] });
    const servico = criarServicoHttpAuditoriaFretes();
    await servico.listar({
      pagina: 2,
      situacao: "com_divergencia",
      busca: "material",
    });
    expect(requisitar).toHaveBeenCalledWith(
      "/fretes/?pagina=2&situacao=com_divergencia&busca=material",
      expect.anything(),
    );
    await servico.listarCompradoras("empresa", undefined, 3);
    expect(requisitar).toHaveBeenLastCalledWith(
      "/fretes/compradoras/?busca=empresa&pagina=3",
      expect.anything(),
    );
  });
  it("duas submissões simultâneas compartilham uma única requisição", async () => {
    let confirmar: (valor: unknown) => void;
    vi.mocked(requisitar).mockImplementation(
      () =>
        new Promise((resolver) => {
          confirmar = resolver;
        }),
    );
    const servico = criarServicoHttpAuditoriaFretes();
    const primeira = servico.registrarCTe("teste", {
      numero: "CTE-SINTETICO",
      valor: "650",
    });
    const segunda = servico.registrarCTe("teste", {
      valor: "650",
      numero: "CTE-SINTETICO",
    });
    await vi.waitFor(() => expect(requisitar).toHaveBeenCalledTimes(1));
    confirmar(freteSintetico());
    expect(await primeira).toEqual(await segunda);
    expect(requisitar).toHaveBeenCalledTimes(1);
  });
  it("reutiliza a chave depois de falha incerta e a renova depois de confirmação", async () => {
    vi.mocked(requisitar)
      .mockRejectedValueOnce(new ErroApi("Resultado incerto", 503))
      .mockResolvedValue(freteSintetico());
    const servico = criarServicoHttpAuditoriaFretes();
    await expect(
      servico.registrarTratativa("teste", "Registro sintético"),
    ).rejects.toThrow("incerto");
    await servico.registrarTratativa("teste", "Registro sintético");
    await servico.registrarTratativa("teste", "Registro sintético");
    const chaves = vi
      .mocked(requisitar)
      .mock.calls.map(
        ([, opcoes]) =>
          (opcoes.headers as Record<string, string>)["Idempotency-Key"],
      );
    expect(chaves[0]).toBe(chaves[1]);
    expect(chaves[2]).not.toBe(chaves[1]);
  });
  it("não repete a chave de um conflito confirmado pelo servidor", async () => {
    vi.mocked(requisitar)
      .mockRejectedValueOnce(new ErroApi("Conflito", 409))
      .mockResolvedValue(freteSintetico());
    const servico = criarServicoHttpAuditoriaFretes();
    await expect(servico.cancelar("teste", "Justificativa")).rejects.toThrow(
      "Conflito",
    );
    await servico.cancelar("teste", "Justificativa");
    const primeira = vi.mocked(requisitar).mock.calls[0][1].headers;
    const segunda = vi.mocked(requisitar).mock.calls[1][1].headers;
    expect(primeira).not.toEqual(segunda);
  });
  it("bloqueia envio pendente quando o token muda durante o hash", async () => {
    let concluir: (valor: ArrayBuffer) => void;
    vi.spyOn(criptografia.subtle, "digest").mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          concluir = resolver;
        }),
    );
    const servico = criarServicoHttpAuditoriaFretes();
    const operacao = servico.cancelar("teste", "Justificativa");
    sessao.token = "outra-sessao-sintetica";
    concluir(new ArrayBuffer(32));
    await expect(operacao).rejects.toThrow("sessão mudou");
    expect(requisitar).not.toHaveBeenCalled();
  });
});
