import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGestaoAnuncios } from "./use-gestao-anuncios";
import { servicoAnuncios } from "@/services/servico-anuncios";
import type { AnuncioVendedor } from "@/types/anuncio";
import type { ItemEstoque, MovimentacaoEstoque } from "@/types/estoque";

const anuncio: AnuncioVendedor = {
  id: "1", itemId: "10", name: "Metal", type: "Sucata", description: "Material limpo",
  quantity: 100, availableQuantity: 100, unit: "kg", price: 5, location: "Araras - SP",
  company: "Empresa", imageUrl: "", images: [], createdAt: "2026-11-06", contactPhone: "", whatsappUrl: "", status: "ativo",
};
const item: ItemEstoque = {
  id: "10", name: "Metal", type: "Sucata", description: "Material limpo", quantity: 60,
  committedQuantity: 0, availableQuantity: 60, unit: "kg", targetQuantity: 0, deadline: "2026-11-06",
  status: "concluido", createdAt: "2026-11-06", updatedAt: "2026-11-06T12:00:00Z",
};
const movimento: MovimentacaoEstoque = {
  id: "1", itemId: "10", itemName: "Metal", itemType: "Sucata", type: "saida", quantity: 40,
  unit: "kg", note: "Venda", createdAt: "2026-11-06T12:00:00Z", resultingQuantity: 60,
};
function criarServico() {
  return {
    ...servicoAnuncios,
    listar: vi.fn().mockResolvedValue({ items: [anuncio] }),
    listarDaEmpresa: vi.fn().mockResolvedValue({ items: [anuncio] }),
    criar: vi.fn().mockResolvedValue({ item: anuncio }),
    desativar: vi.fn().mockResolvedValue(undefined),
    finalizarVenda: vi.fn().mockResolvedValue({ ad: { ...anuncio, quantity: 60, availableQuantity: 60 }, item, movement: movimento }),
  };
}
function promessaAdiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((concluir) => { resolver = concluir; });
  return { promessa, resolver };
}

describe("gestão de anúncios", () => {
  it("expõe erro de leitura sem anunciar dados simulados e permite tentar novamente", async () => {
    const servico = criarServico();
    servico.listar.mockRejectedValueOnce(new Error("Servidor indisponível."));
    const estoque = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGestaoAnuncios(null, estoque, servico));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.anuncios).toEqual([]);
    expect(result.current.erro).toBe("Servidor indisponível.");

    await act(() => result.current.atualizarAnuncios());
    expect(result.current.anuncios).toEqual([anuncio]);
    expect(result.current.erro).toBeNull();
  });

  it("preserva venda parcial confirmada quando a releitura do estoque falha", async () => {
    const servico = criarServico();
    const estoque = vi.fn().mockRejectedValue(new Error("Falha ao recarregar estoque."));
    const { result } = renderHook(() => useGestaoAnuncios("empresa-a", estoque, servico));
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));

    await act(async () => {
      const resultado = await result.current.finalizarVenda("1", 40);
      expect(resultado.sucesso).toBe(true);
      expect(resultado.mensagem).toContain("Venda registrada");
    });
    expect(result.current.anuncios[0]).toMatchObject({ id: "1", quantity: 60 });
    expect(result.current.anunciosEmpresa[0]).toMatchObject({ id: "1", status: "ativo", quantity: 60 });
    expect(estoque).toHaveBeenCalledOnce();
  });

  it("ignora uma listagem iniciada antes da venda que contém a quantidade anterior", async () => {
    const servico = criarServico();
    const estoque = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGestaoAnuncios("empresa-a", estoque, servico));
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));
    const leituraAntiga = promessaAdiada<{ items: AnuncioVendedor[] }>();
    servico.listar.mockReturnValueOnce(leituraAntiga.promessa);
    let consulta!: Promise<void>;
    act(() => { consulta = result.current.atualizarAnuncios(); });
    await act(() => result.current.finalizarVenda("1", 40));
    await act(async () => {
      leituraAntiga.resolver({ items: [anuncio] });
      await consulta;
    });
    expect(result.current.anuncios[0].quantity).toBe(60);
    expect(result.current.carregando).toBe(false);
  });

  it("não aplica uma venda da sessão anterior após trocar de empresa e retornar", async () => {
    const servico = criarServico();
    const estoque = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ empresa }) => useGestaoAnuncios(empresa, estoque, servico), { initialProps: { empresa: "empresa-a" } });
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));
    const vendaAntiga = promessaAdiada<{ ad: AnuncioVendedor; item: ItemEstoque; movement: MovimentacaoEstoque }>();
    servico.finalizarVenda.mockReturnValueOnce(vendaAntiga.promessa);
    let venda!: ReturnType<typeof result.current.finalizarVenda>;
    act(() => { venda = result.current.finalizarVenda("1", 40); });
    servico.listar.mockResolvedValue({ items: [] });
    servico.listarDaEmpresa.mockResolvedValue({ items: [] });
    rerender({ empresa: "empresa-b" });
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));
    rerender({ empresa: "empresa-a" });
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));
    await act(async () => {
      vendaAntiga.resolver({ ad: { ...anuncio, quantity: 60, availableQuantity: 60 }, item, movement: movimento });
      await venda;
    });
    expect(result.current.anuncios).toEqual([]);
    expect(result.current.anunciosEmpresa).toEqual([]);
    expect(estoque).not.toHaveBeenCalled();
  });

  it("impede duas vendas simultâneas do mesmo anúncio", async () => {
    const servico = criarServico();
    const estoque = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGestaoAnuncios("empresa-a", estoque, servico));
    await waitFor(() => expect(result.current.carregandoEmpresa).toBe(false));
    const vendaPendente = promessaAdiada<{ ad: AnuncioVendedor; item: ItemEstoque; movement: MovimentacaoEstoque }>();
    servico.finalizarVenda.mockReturnValueOnce(vendaPendente.promessa);
    let venda!: ReturnType<typeof result.current.finalizarVenda>;
    act(() => { venda = result.current.finalizarVenda("1", 40); });
    await act(async () => expect((await result.current.finalizarVenda("1", 40)).sucesso).toBe(false));
    expect(servico.finalizarVenda).toHaveBeenCalledOnce();
    await act(async () => {
      vendaPendente.resolver({ ad: { ...anuncio, status: "vendido", quantity: 0, availableQuantity: 0 }, item, movement: movimento });
      await venda;
    });
    expect(result.current.anuncios).toEqual([]);
    expect(result.current.anunciosEmpresa[0].status).toBe("vendido");
  });
});
