import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGestaoEstoque } from "@/hooks/use-gestao-estoque";
import type { ItemEstoque, MovimentacaoEstoque } from "@/types/estoque";

function criarItem(alteracoes: Partial<ItemEstoque> = {}): ItemEstoque {
  return {
    id: "produto", name: "Papel", type: "Papel e Papelão", description: "",
    quantity: 100, committedQuantity: 20, availableQuantity: 80, unit: "kg",
    targetQuantity: 0, deadline: "2026-11-06", status: "concluido",
    createdAt: "2026-11-06", updatedAt: "2026-11-06T10:00:00Z", ...alteracoes,
  };
}
const movimentacao: MovimentacaoEstoque = {
  id: "movimento", itemId: "produto", itemName: "Papel", itemType: "Papel e Papelão",
  type: "entrada", quantity: 100, unit: "kg", note: "", createdAt: "2026-11-06T10:00:00Z", resultingQuantity: 100,
};
function criarServico() {
  return {
    listarItens: vi.fn().mockResolvedValue({ items: [criarItem()] }),
    listarMovimentacoes: vi.fn().mockResolvedValue({ movements: [movimentacao] }),
    cadastrarItem: vi.fn().mockResolvedValue({ item: criarItem({ id: "novo" }) }),
    atualizarItem: vi.fn().mockResolvedValue({ item: criarItem() }),
    registrarMovimentacao: vi.fn().mockResolvedValue({ item: criarItem({ quantity: 110, availableQuantity: 90 }), movement: { ...movimentacao, id: "nova-entrada", quantity: 10, resultingQuantity: 110 } }),
    desativarItem: vi.fn().mockResolvedValue({ message: "Desativado", closedAds: 1 }),
  };
}
function criarPromessaPendente<T>() {
  let resolver: (valor: T) => void = () => {};
  const promessa = new Promise<T>((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}

describe("gestão do estoque", () => {
  it("completa a lista se um cadastro é confirmado antes da primeira consulta terminar", async () => {
    const servico = criarServico();
    const consultaInicial = criarPromessaPendente<{ items: ItemEstoque[] }>();
    const novoItem = criarItem({ id: "novo" });
    servico.listarItens.mockReturnValueOnce(consultaInicial.promessa).mockResolvedValue({ items: [criarItem(), novoItem] });
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await act(async () => {
      expect((await result.current.cadastrarItem({ name: "Papel", type: "Papel e Papelão", unit: "kg", quantity: 10 })).sucesso).toBe(true);
    });
    await act(() => consultaInicial.resolver({ items: [criarItem()] }));
    expect(result.current.itens.map((item) => item.id).sort()).toEqual(["novo", "produto"]);
    expect(result.current.carregando).toBe(false);
  });

  it("preserva os itens consultados quando o histórico falha e permite repetir a consulta", async () => {
    const servico = criarServico();
    servico.listarMovimentacoes.mockRejectedValueOnce(new Error("Histórico indisponível"));
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.itens).toHaveLength(1);
    expect(result.current.erroMovimentacoes).toBe("Histórico indisponível");
    await act(() => result.current.atualizarEstoque());
    expect(result.current.erroMovimentacoes).toBeNull();
    expect(result.current.movimentacoes).toHaveLength(1);
  });

  it("mantém os últimos dados e informa uma falha de atualização", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    servico.listarItens.mockRejectedValueOnce(new Error("Estoque indisponível"));
    await act(() => result.current.atualizarEstoque());
    expect(result.current.itens[0].quantity).toBe(100);
    expect(result.current.erro).toBe("Estoque indisponível");
  });

  it("confirma o cadastro mesmo quando a leitura posterior do histórico falha", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    servico.listarMovimentacoes.mockRejectedValueOnce(new Error("Histórico indisponível"));
    await act(async () => {
      expect(await result.current.cadastrarItem({ name: " Novo ", type: "Papel", quantity: 1, unit: "kg" }))
        .toEqual({ sucesso: true, mensagem: "Item cadastrado com sucesso." });
    });
    expect(servico.cadastrarItem).toHaveBeenCalledOnce();
    expect(result.current.itens.map((item) => item.id)).toContain("novo");
    expect(result.current.erroMovimentacoes).toBe("Histórico indisponível");
  });

  it("descarta respostas da sessão anterior, inclusive ao entrar novamente na mesma empresa", async () => {
    const servico = criarServico();
    const pendente = criarPromessaPendente<{ item: ItemEstoque }>();
    servico.cadastrarItem.mockReturnValueOnce(pendente.promessa);
    const { result, rerender } = renderHook(({ empresa }) => useGestaoEstoque(empresa, servico), { initialProps: { empresa: "empresa" as string | null } });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    let cadastro: Promise<unknown>;
    act(() => { cadastro = result.current.cadastrarItem({ name: "Antigo", type: "Papel", quantity: 1, unit: "kg" }); });
    rerender({ empresa: null });
    expect(result.current.itens).toEqual([]);
    expect(result.current.movimentacoes).toEqual([]);
    rerender({ empresa: "empresa" });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { pendente.resolver({ item: criarItem({ id: "sessao-anterior" }) }); await cadastro; });
    expect(result.current.itens.map((item) => item.id)).toEqual(["produto"]);
  });

  it("não deixa uma consulta antiga sobrescrever uma movimentação confirmada", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const pendente = criarPromessaPendente<{ items: ItemEstoque[] }>();
    servico.listarItens.mockReturnValueOnce(pendente.promessa);
    let atualizacao: Promise<void>;
    act(() => { atualizacao = result.current.atualizarEstoque(); });
    await act(() => result.current.registrarMovimentacao({ itemId: "produto", type: "entrada", quantity: 10 }));
    await act(async () => { pendente.resolver({ items: [criarItem()] }); await atualizacao; });
    expect(result.current.itens[0].quantity).toBe(110);
    expect(result.current.movimentacoes.map((registro) => registro.id)).toContain("nova-entrada");
  });

  it("preserva o histórico ao desativar um item", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(() => result.current.desativarItem("produto"));
    expect(result.current.itens).toEqual([]);
    expect(result.current.movimentacoes).toEqual([movimentacao]);
  });

  it("impede gravações simultâneas no mesmo item", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const pendente = criarPromessaPendente<{ item: ItemEstoque; movement: MovimentacaoEstoque }>();
    servico.registrarMovimentacao.mockReturnValueOnce(pendente.promessa);
    let registro: Promise<unknown>;
    act(() => { registro = result.current.registrarMovimentacao({ itemId: "produto", quantity: 10, type: "entrada" }); });
    await act(async () => {
      expect((await result.current.desativarItem("produto")).sucesso).toBe(false);
    });
    expect(servico.desativarItem).not.toHaveBeenCalled();
    await act(async () => {
      pendente.resolver({ item: criarItem(), movement: movimentacao });
      await registro;
    });
    await act(() => result.current.desativarItem("produto"));
    expect(servico.desativarItem).toHaveBeenCalledOnce();
  });

  it("mantém o saldo e o histórico quando o backend rejeita uma movimentação", async () => {
    const servico = criarServico();
    const { result } = renderHook(() => useGestaoEstoque("empresa", servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    servico.registrarMovimentacao.mockRejectedValueOnce(new Error("Saldo comprometido"));
    await act(async () => {
      expect(await result.current.registrarMovimentacao({ itemId: "produto", type: "saida", quantity: 90 }))
        .toEqual({ sucesso: false, mensagem: "Saldo comprometido" });
    });
    expect(result.current.itens[0].quantity).toBe(100);
    expect(result.current.movimentacoes).toEqual([movimentacao]);
  });
});
