import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePrecosMercado } from "./use-precos-mercado";
import type { PrecosMercado } from "@/types/mercado";

const precos: PrecosMercado = {
  priceHistory: [{ month: "Nov", papel: 0.4 }],
  materials: [{ key: "papel", name: "Papel", color: "green", current: 0.4, change: 2 }],
  insight: "Análise recebida do backend",
};

describe("consulta de preços de mercado", () => {
  it("não inventa preços quando a consulta falha e permite tentar novamente", async () => {
    const obterPrecos = vi.fn().mockRejectedValueOnce(new Error("Mercado indisponível")).mockResolvedValueOnce(precos);
    const { result } = renderHook(() => usePrecosMercado({ obterPrecos }));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.dados).toBeNull();
    expect(result.current.erro).toBe("Mercado indisponível");
    await act(() => result.current.atualizar());
    expect(result.current.dados).toEqual(precos);
    expect(result.current.erro).toBeNull();
  });

  it("preserva a última consulta recebida e sinaliza falha de atualização", async () => {
    const obterPrecos = vi.fn().mockResolvedValueOnce(precos).mockRejectedValueOnce(new Error("Sem conexão"));
    const { result } = renderHook(() => usePrecosMercado({ obterPrecos }));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(() => result.current.atualizar());
    expect(result.current.dados).toEqual(precos);
    expect(result.current.erro).toBe("Sem conexão");
  });

  it("uma resposta antiga não substitui a consulta mais recente", async () => {
    let resolverAntiga: (dados: PrecosMercado) => void = () => {};
    const antiga = new Promise<PrecosMercado>((resolver) => { resolverAntiga = resolver; });
    const obterPrecos = vi.fn().mockReturnValueOnce(antiga).mockResolvedValueOnce(precos);
    const { result } = renderHook(() => usePrecosMercado({ obterPrecos }));
    await act(() => result.current.atualizar());
    await act(() => resolverAntiga({ ...precos, insight: "Resposta antiga" }));
    expect(result.current.dados?.insight).toBe(precos.insight);
  });
});
