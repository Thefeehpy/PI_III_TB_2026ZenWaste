import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { criarServicoAuditoriaDemonstrativa } from "./servico-auditoria-fretes";
import { useDadosAuditoriaFretes } from "./use-dados-auditoria-fretes";
import type { EstadoAuditoriaFretes } from "./tipos";

describe("consulta e comandos de auditoria", () => {
  it("exibe erro de consulta sem criar dados e permite nova tentativa", async () => {
    const servico = criarServicoAuditoriaDemonstrativa();
    const estado = await servico.carregar();
    vi.spyOn(servico, "carregar").mockRejectedValueOnce(new Error("Consulta indisponível"));
    const { result } = renderHook(() => useDadosAuditoriaFretes(servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.estado.processos).toEqual([]);
    expect(result.current.erro).toBe("Consulta indisponível");
    await act(() => result.current.recarregar());
    expect(result.current.estado.processos).toHaveLength(estado.processos.length);
    expect(result.current.erro).toBeNull();
  });

  it("protege o comando pendente contra duplo clique e preserva o estado se ele falhar", async () => {
    const servico = criarServicoAuditoriaDemonstrativa();
    let rejeitar: (falha: Error) => void = () => {};
    const pendente = new Promise<EstadoAuditoriaFretes>((_, reject) => { rejeitar = reject; });
    const comando = vi.fn().mockReturnValue(pendente);
    const { result } = renderHook(() => useDadosAuditoriaFretes(servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const estadoAnterior = result.current.estado;
    let operacao: Promise<unknown>;
    act(() => { operacao = result.current.executar(comando); });
    await act(async () => { expect(await result.current.executar(comando)).toBeNull(); });
    expect(comando).toHaveBeenCalledOnce();
    await act(async () => { rejeitar(new Error("Operação recusada")); await operacao; });
    expect(result.current.erro).toBe("Operação recusada");
    expect(result.current.estado).toEqual(estadoAnterior);
    expect(result.current.executando).toBe(false);
  });
});
