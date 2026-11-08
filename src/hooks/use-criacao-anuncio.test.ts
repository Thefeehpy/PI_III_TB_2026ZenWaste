import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCriacaoAnuncio } from "@/hooks/use-criacao-anuncio";
import type { SugestaoDescricao, SugestaoPreco } from "@/types/mercado";
import type { EnderecoCep } from "@/services/servico-enderecos";

const simulacoes = vi.hoisted(() => ({
  criarAnuncio: vi.fn(), sugerirPreco: vi.fn(), sugerirDescricao: vi.fn(),
  consultarCep: vi.fn(), processarImagem: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "empresa" } }) }));
vi.mock("@/contexts/InventoryContext", () => ({ useEstoque: () => ({
  itens: [{ id: "produto", name: "Papel", type: "Papel e Papelão", unit: "kg", quantity: 100, committedQuantity: 20, availableQuantity: 80 }],
  carregando: false, erro: null, atualizarEstoque: vi.fn(),
}) }));
vi.mock("@/contexts/MarketplaceContext", () => ({ useAnuncios: () => ({ criarAnuncio: simulacoes.criarAnuncio }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: simulacoes.toast }) }));
vi.mock("@/services/servico-mercado", () => ({ servicoMercado: { sugerirPreco: simulacoes.sugerirPreco, sugerirDescricao: simulacoes.sugerirDescricao } }));
vi.mock("@/services/servico-enderecos", () => ({ servicoEnderecos: { consultarCep: simulacoes.consultarCep } }));
vi.mock("@/utils/imagens-anuncio", () => ({ processarImagemAnuncio: simulacoes.processarImagem }));

const endereco: EnderecoCep = { street: "Rua Um", neighborhood: "Centro", city: "Campinas", state: "SP" };
const sugestaoPreco: SugestaoPreco = { suggestedPrice: 5, insight: "Referência atual", source: "fallback", aiAvailable: false };
function promessaPendente<T>() {
  let resolver: (valor: T) => void = () => {};
  const promessa = new Promise<T>((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}
async function preparar() {
  const retorno = renderHook(() => useCriacaoAnuncio());
  act(() => retorno.result.current.definirFormulario((anterior) => ({
    ...anterior, inventoryId: "produto", title: "Papel para reciclagem", type: "Papel e Papelão",
    quantity: "10.125", unit: "kg", price: "4", cep: "13000000", number: "10",
    photos: ["data:image/webp;base64,imagem"],
  })));
  await waitFor(() => expect(retorno.result.current.podePublicar).toBe(true));
  return retorno;
}

beforeEach(() => {
  vi.resetAllMocks();
  simulacoes.criarAnuncio.mockResolvedValue({ sucesso: true, mensagem: "Publicado" });
  simulacoes.sugerirPreco.mockResolvedValue(sugestaoPreco);
  simulacoes.sugerirDescricao.mockResolvedValue({ description: "Descrição sugerida", source: "fallback", aiAvailable: false });
  simulacoes.consultarCep.mockResolvedValue(endereco);
  simulacoes.processarImagem.mockResolvedValue("data:image/webp;base64,nova");
});

describe("criação de anúncio", () => {
  it("publica uma única vez mesmo com duplo clique e envia a coleção de imagens", async () => {
    const { result } = await preparar();
    const pendente = promessaPendente<{ sucesso: boolean }>();
    simulacoes.criarAnuncio.mockReturnValueOnce(pendente.promessa);
    let publicacao: Promise<void>;
    act(() => {
      publicacao = result.current.publicar();
      void result.current.publicar();
    });
    expect(simulacoes.criarAnuncio).toHaveBeenCalledOnce();
    expect(simulacoes.criarAnuncio).toHaveBeenCalledWith(expect.objectContaining({
      inventoryId: "produto", quantity: 10.125, price: 4,
      images: [{ url: "data:image/webp;base64,imagem", isCover: true, order: 0 }],
    }));
    await act(async () => { pendente.resolver({ sucesso: true }); await publicacao; });
    expect(result.current.formulario.inventoryId).toBe("");
    expect(result.current.publicando).toBe(false);
    expect(simulacoes.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Anúncio publicado" }));
  });

  it("preserva o formulário quando a publicação é recusada", async () => {
    const { result } = await preparar();
    simulacoes.criarAnuncio.mockResolvedValueOnce({ sucesso: false, mensagem: "Saldo indisponível" });
    await act(() => result.current.publicar());
    expect(result.current.formulario.inventoryId).toBe("produto");
    expect(result.current.publicando).toBe(false);
    expect(simulacoes.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Anúncio não publicado", description: "Saldo indisponível" }));
  });

  it("mantém uma edição nova feita durante a publicação confirmada", async () => {
    const { result } = await preparar();
    const pendente = promessaPendente<{ sucesso: boolean }>();
    simulacoes.criarAnuncio.mockReturnValueOnce(pendente.promessa);
    let publicacao: Promise<void>;
    act(() => { publicacao = result.current.publicar(); });
    act(() => result.current.definirFormulario((anterior) => ({ ...anterior, title: "Próximo anúncio" })));
    await act(async () => { pendente.resolver({ sucesso: true }); await publicacao; });
    expect(result.current.formulario.title).toBe("Próximo anúncio");
  });

  it("não deixa a consulta automática substituir o preço solicitado manualmente depois", async () => {
    const automatica = promessaPendente<SugestaoPreco>();
    simulacoes.sugerirPreco.mockImplementation((entrada: unknown) => typeof entrada === "string"
      ? automatica.promessa : Promise.resolve({ ...sugestaoPreco, suggestedPrice: 7 }));
    const { result } = await preparar();
    await act(() => result.current.sugerirPreco());
    await act(async () => { automatica.resolver({ ...sugestaoPreco, suggestedPrice: 2 }); await automatica.promessa; });
    expect(result.current.formulario.price).toBe("7.00");
    expect(result.current.formulario.suggestedPrice).toBe("7.00");
  });

  it("descarta uma descrição antiga quando o usuário já editou o texto", async () => {
    const { result } = await preparar();
    const pendente = promessaPendente<SugestaoDescricao>();
    simulacoes.sugerirDescricao.mockReturnValueOnce(pendente.promessa);
    let consulta: Promise<void>;
    act(() => { consulta = result.current.sugerirDescricao(); });
    act(() => result.current.definirFormulario((anterior) => ({ ...anterior, description: "Texto revisado pelo usuário" })));
    await act(async () => { pendente.resolver({ description: "Texto antigo", source: "ai", aiAvailable: true }); await consulta; });
    expect(result.current.formulario.description).toBe("Texto revisado pelo usuário");
    expect(simulacoes.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Descrição gerada por IA" }));
  });

  it("descarta uma sugestão de preço quando o contexto do material mudou", async () => {
    const { result } = await preparar();
    const pendente = promessaPendente<SugestaoPreco>();
    simulacoes.sugerirPreco.mockReturnValueOnce(pendente.promessa);
    let consulta: Promise<void>;
    act(() => { consulta = result.current.sugerirPreco(); });
    act(() => result.current.definirFormulario((anterior) => ({ ...anterior, quantity: "20" })));
    await act(async () => { pendente.resolver({ ...sugestaoPreco, suggestedPrice: 9 }); await consulta; });
    expect(result.current.formulario.price).toBe("4");
    expect(result.current.sugerindoPreco).toBe(false);
  });

  it("descarta uma consulta de CEP anterior quando o usuário informa outro CEP", async () => {
    const primeira = promessaPendente<EnderecoCep>();
    const segunda = promessaPendente<EnderecoCep>();
    simulacoes.consultarCep.mockReturnValueOnce(primeira.promessa).mockReturnValueOnce(segunda.promessa);
    const { result } = renderHook(() => useCriacaoAnuncio());
    act(() => result.current.definirFormulario((anterior) => ({ ...anterior, cep: "13000000" })));
    act(() => result.current.definirFormulario((anterior) => ({ ...anterior, cep: "14000000" })));
    await act(async () => { segunda.resolver({ ...endereco, city: "Cidade atual" }); await segunda.promessa; });
    await act(async () => { primeira.resolver({ ...endereco, city: "Cidade antiga" }); await primeira.promessa; });
    expect(result.current.formulario.city).toBe("Cidade atual");
  });

  it("preserva o endereço quando o mesmo CEP é colado com outra formatação", async () => {
    const { result } = await preparar();
    act(() => result.current.alterarCep("13000-000"));
    expect(result.current.formulario.city).toBe("Campinas");
    expect(result.current.formulario.number).toBe("10");
    expect(simulacoes.consultarCep).toHaveBeenCalledOnce();
  });

  it("não reinsere uma imagem removida enquanto o processamento estava pendente", async () => {
    const { result } = await preparar();
    const pendente = promessaPendente<string>();
    simulacoes.processarImagem.mockReturnValueOnce(pendente.promessa);
    const arquivo = new File(["imagem"], "foto.webp", { type: "image/webp" });
    const arquivos = Object.assign([arquivo], { item: (indice: number) => indice === 0 ? arquivo : null }) as unknown as FileList;
    let processamento: Promise<void>;
    act(() => { processamento = result.current.selecionarArquivo(arquivos); });
    act(() => result.current.removerFoto());
    await act(async () => { pendente.resolver("data:image/webp;base64,antiga"); await processamento; });
    expect(result.current.formulario.photos).toEqual([]);
    expect(result.current.processandoImagem).toBe(false);
  });
});
