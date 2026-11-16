import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeletorResiduo } from "./SeletorResiduo";
import { JornadaMTR } from "./PaginaMTR";
import { lerCatalogos, lerIntencao, lerRascunho, resultadoIncerto, servicoMTR } from "./servico";
import { ErroApi } from "@/services/cliente-http";

const rascunho = { id: "r1", frete_id: "f1", versao: 1, estado: "RASCUNHO", ambiente: "MOCK", dados: { gerador_cnpj: "00000000000001" }, revisao: null, intencao: null, eventos: [], emissao_real_habilitada: false };
const intencao = { id: "i1", rascunho_id: "r1", revisao_id: "v1", estado: "INDETERMINADA", referencia: "MOCK-ref", cenario: "timeout", quantidade_envios: 1, resultado: { numero_oficial: null }, simulado: true, emissao_oficial: false, ambiente: "MOCK" };
const catalogos = { ambiente: "MOCK", simulado: true, aprovado_ambientalmente: false, fonte: "FICTICIO", referencia_operador: { registros: 895, origem: "operador", sha256: "abc" }, residuos: [{ codigo: "000001", descricao: "Fixture", origem: "fixture_fase1a" }], unidades: [], tratamentos: [], estados: [], acondicionamentos: [], classes: [] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Contratos MTR locais", () => {
  it("mantem ambiente, codigos textuais e procedencia", () => {
    expect(lerCatalogos(catalogos).residuos[0].codigo).toBe("000001");
    expect(lerRascunho(rascunho).dados.gerador_cnpj).toBe("00000000000001");
    expect(lerIntencao(intencao).estado).toBe("INDETERMINADA");
  });
  it.each(["SIGOR", null, undefined])("rejeita ambiente inesperado %s", ambiente => {
    expect(() => lerRascunho({ ...rascunho, ambiente })).toThrow();
    expect(() => lerIntencao({ ...intencao, ambiente })).toThrow();
  });
  it.each([{ numero_oficial: "oficial" }, { emissao_oficial: true }])("nao apresenta confirmacao oficial %s", resultado => {
    expect(() => lerIntencao({ ...intencao, resultado })).toThrow();
  });
  it("recusa estruturas malformadas", () => {
    expect(() => lerRascunho({ ...rascunho, dados: { segredo: [] } })).toThrow();
    expect(() => lerCatalogos({ ...catalogos, residuos: [{ codigo: {}, descricao: "X" }] })).toThrow();
    expect(() => lerRascunho({ ...rascunho, versao: 0 })).toThrow();
  });
  it("preserva resultado incerto sem transforma-lo em falha definitiva", () => {
    expect(resultadoIncerto(new ErroApi("rede", 0))).toBe(true);
    expect(resultadoIncerto(new ErroApi("servidor", 503))).toBe(true);
    expect(resultadoIncerto(new Error("resposta invalida"))).toBe(true);
    expect(resultadoIncerto(new ErroApi("conflito", 409))).toBe(false);
  });
  it("envia comando tipado com chave e identidade separadas", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...rascunho, estado: "APROVADO" }), { status: 201 })); vi.stubGlobal("fetch", fetch);
    await servicoMTR.revisar(lerRascunho(rascunho), "chave-ficticia", "token-ficticio");
    const [url, opcoes] = fetch.mock.calls[0];
    expect(url).toContain("/mtr/rascunhos/r1/revisoes/");
    expect(opcoes.headers.get("Idempotency-Key")).toBe("chave-ficticia");
    expect(opcoes.headers.get("X-MTR-Actor-Token")).toBe("token-ficticio");
    expect(opcoes.body).not.toContain("token-ficticio");
  });
});

describe("Seletor de residuos real com resultados ficticios", () => {
  const itens = [{ codigo: "000001", descricao: "Mesmo nome", origem: "fixture_fase1a" }, { codigo: "000002(*)", descricao: "Mesmo nome", origem: "referencia_operador_homologacao" }];
  it("seleciona primeiro resultado com teclado e preserva codigo", () => {
    const selecionar = vi.fn(); render(<SeletorResiduo valor="" itens={itens} carregando={false} buscar={vi.fn()} selecionar={selecionar} />);
    const input = screen.getByRole("combobox"); fireEvent.focus(input); fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.keyDown(input, { key: "Enter" });
    expect(selecionar).toHaveBeenCalledWith(itens[0]); expect(input).toHaveAttribute("aria-expanded", "false");
  });
  it("pesquisa remota e escape preservam selecao anterior", () => {
    const buscar = vi.fn(); render(<SeletorResiduo valor="000002(*)" itens={itens} carregando={false} buscar={buscar} selecionar={vi.fn()} />);
    const input = screen.getByRole("combobox"); fireEvent.focus(input); fireEvent.change(input, { target: { value: "Mesmo" } });
    expect(buscar).toHaveBeenLastCalledWith("Mesmo"); fireEvent.keyDown(input, { key: "Escape" }); expect(input).toHaveValue("000002(*)");
  });
  it("carregamento nao seleciona resultado antigo", () => {
    const selecionar = vi.fn(); render(<SeletorResiduo valor="" itens={itens} carregando buscar={vi.fn()} selecionar={selecionar} />);
    const input = screen.getByRole("combobox"); fireEvent.focus(input); fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.keyDown(input, { key: "Enter" });
    expect(selecionar).not.toHaveBeenCalled(); expect(screen.getByRole("status")).toHaveTextContent("Pesquisando");
  });
  it("exibe resultado vazio compreensivel", () => {
    render(<SeletorResiduo valor="" itens={[]} carregando={false} buscar={vi.fn()} selecionar={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox")); expect(screen.getByRole("status")).toHaveTextContent("Nenhum código encontrado");
  });
});

describe("Jornada React real com HTTP simulado", () => {
  function leituras() {
    vi.spyOn(servicoMTR, "contexto").mockResolvedValue({ ambiente: "MOCK" });
    vi.spyOn(servicoMTR, "operacoes").mockResolvedValue({ resultados: [{ id: "f1", referencia: "FRETE-FICTICIO", material: "Material", quantidade: "7.000", unidade: "KG", situacao: "aguardando_conferencia", origem_cadastro: "pedido" }], paginacao: { pagina: 1, total_paginas: 1, total: 1 } });
    vi.spyOn(servicoMTR, "catalogos").mockResolvedValue(lerCatalogos(catalogos));
    vi.spyOn(servicoMTR, "preenchimento").mockResolvedValue([{ campo: "cnpj_vendedora", valor: "00000000000001", fonte: "Empresa.cnpj", identificador_origem: "1", situacao: "presumido", pendencias: [], requer_validacao_humana: true }]);
    vi.spyOn(servicoMTR, "existentes").mockResolvedValue([]);
  }
  it("apresenta jornada honesta, reutiliza fonte e cria rascunho", async () => {
    leituras(); const criar = vi.spyOn(servicoMTR, "criar").mockResolvedValue(lerRascunho(rascunho)); render(<JornadaMTR />);
    fireEvent.click(await screen.findByRole("radio"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Compradora não é inferida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho com os dados disponíveis" }));
    await waitFor(() => expect(criar).toHaveBeenCalled()); expect(await screen.findByText(/Rascunho persistido/)).toBeInTheDocument();
  });
  it("exibe erro e retry sem mostrar operacoes de outra empresa", async () => {
    leituras(); vi.spyOn(servicoMTR, "operacoes").mockRejectedValue(new ErroApi("Sessão indisponível", 503)); render(<JornadaMTR />);
    expect(await screen.findByText("Sessão indisponível")).toBeInTheDocument(); expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
