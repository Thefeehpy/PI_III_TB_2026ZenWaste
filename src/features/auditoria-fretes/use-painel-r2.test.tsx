import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ErroApi } from "@/services/cliente-http";
import { freteSintetico, listaFretesSintetica } from "@/test/fixtures/fretes";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import { usePainelAuditoriaIntegrada } from "./use-painel-auditoria-integrada";
import { cadastroInicial } from "./validacoes";
import type { FreteDetalheDTO } from "./tipos-api";

const auth = vi.hoisted(() => ({ id: "1", retry: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: auth.id, roles: ["vendedora"] }, retrySession: auth.retry }) }));
const pedido = { id: "00000000-0000-0000-0000-000000000031", numero: "PED-31", cliente: "Compradora fictícia", material: "Material A", unidade: "kg", origem: "Coleta A", quantidade: "10.000", quantidade_restante: "8.000", data_pedido: "2026-11-10" };
const pedidoB = { ...pedido, id: "00000000-0000-0000-0000-000000000032", numero: "PED-32", material: "Material B", origem: "Coleta B", quantidade_restante: "4.000" };
const paginacao = { pagina: 1, tamanho_pagina: 6, total: 2, total_paginas: 1 };
function servicoFake() {
  const s = criarServicoHttpAuditoriaFretes();
  vi.spyOn(s,"listar").mockResolvedValue(listaFretesSintetica());
  vi.spyOn(s,"listarPedidosDisponiveis").mockResolvedValue({ resultados: [pedido,pedidoB], paginacao });
  vi.spyOn(s,"listarDemandas").mockResolvedValue({ resultados: [], paginacao });
  vi.spyOn(s,"obter").mockImplementation(async id => freteSintetico({id}));
  vi.spyOn(s,"cadastrar").mockResolvedValue(freteSintetico());
  vi.spyOn(s,"classificar").mockResolvedValue(freteSintetico({ situacao: "em_cotacao", modalidade: "cotar" }));
  vi.spyOn(s,"registrarCotacao").mockResolvedValue(freteSintetico());
  vi.spyOn(s,"registrarCTe").mockResolvedValue(freteSintetico());
  vi.spyOn(s,"publicarDemanda").mockResolvedValue(freteSintetico());
  return s;
}
async function iniciar() {
  const servico = servicoFake();
  const hook = renderHook(() => usePainelAuditoriaIntegrada(servico));
  await waitFor(() => expect(hook.result.current.dados.carregando).toBe(false));
  act(() => hook.result.current.definirCadastroAberto(true));
  return { ...hook, servico };
}
type Painel = ReturnType<typeof usePainelAuditoriaIntegrada>;
function preencher(p: Painel) {
  p.definirFormularioCadastro({ ...cadastroInicial, tipo: "avulso", compradoraId: "2", material: "Plástico", unidade: "kg", quantidade: "3,125", origem: "Coleta", destino: "Entrega", pesoToneladas: "0", metrosCubicos: "1,001", quantidadeVolumes: "0" });
}
beforeEach(() => { auth.id = "1"; auth.retry.mockReset(); localStorage.clear(); });

it("cria avulso normalizado e adota UUID sem depender de releitura", async () => {
  const { result, servico } = await iniciar();
  act(() => preencher(result.current));
  await act(async () => result.current.cadastrarFrete());
  expect(servico.cadastrar).toHaveBeenCalledWith(expect.objectContaining({ quantidade: "3.125", cubagem_m3: "1.001", empresa_compradora_id: 2 }));
  expect(result.current.dados.idSelecionado).toBe(freteSintetico().id);
  expect(result.current.detalhesAbertos).toBe(true);
  expect(result.current.cadastroAberto).toBe(false);
  expect(servico.obter).not.toHaveBeenCalled();
});
it("cria pedido vinculado válido", async () => {
  const { result, servico } = await iniciar();
  act(() => result.current.selecionarPedido(pedido));
  act(() => result.current.definirFormularioCadastro(f => ({ ...f, destino: "Entrega", pesoToneladas: "0", metrosCubicos: "0", quantidadeVolumes: "1" })));
  await act(async () => result.current.cadastrarFrete());
  expect(servico.cadastrar).toHaveBeenCalledWith(expect.objectContaining({ pedido_id: pedido.id, quantidade: "8.000" }));
});
it("troca de pedido exige aviso e reinicia material, origem, quantidade e destino", async () => {
  const { result } = await iniciar();
  act(() => result.current.selecionarPedido(pedido));
  act(() => result.current.definirFormularioCadastro(f => ({ ...f, destino: "Destino antigo" })));
  act(() => result.current.selecionarPedido(pedidoB));
  expect(result.current.descarte).not.toBeNull();
  expect(result.current.formularioCadastro.material).toBe("Material A");
  act(() => result.current.cancelarDescarte());
  expect(result.current.formularioCadastro.destino).toBe("Destino antigo");
  act(() => result.current.selecionarPedido(pedidoB));
  act(() => result.current.confirmarDescarte());
  expect(result.current.formularioCadastro).toMatchObject({ material: "Material B", origem: "Coleta B", quantidade: "4.000", destino: "" });
});
it.each(["pedido","avulso"] as const)("troca de %s isola dados comerciais", async tipo => {
  const { result } = await iniciar();
  act(() => result.current.definirFormularioCadastro({ ...cadastroInicial, tipo, destino: "Dado anterior" }));
  act(() => result.current.trocarTipoCadastro(tipo === "pedido" ? "avulso" : "pedido"));
  act(() => result.current.confirmarDescarte());
  expect(result.current.formularioCadastro).toMatchObject({ pedidoId: "", compradoraId: "", material: "", destino: "" });
});
it("fechar cadastro preenchido exige confirmação e reabertura limpa", async () => {
  const { result } = await iniciar();
  act(() => preencher(result.current));
  act(() => result.current.definirCadastroAberto(false));
  expect(result.current.cadastroAberto).toBe(true);
  act(() => result.current.confirmarDescarte());
  act(() => result.current.definirCadastroAberto(true));
  expect(result.current.formularioCadastro).toEqual(cadastroInicial);
});
it("troca de empresa oculta rascunho e ignora resposta antiga", async () => {
  const { result, rerender, servico } = await iniciar();
  let resolver: (v: FreteDetalheDTO) => void;
  vi.mocked(servico.cadastrar).mockImplementationOnce(() => new Promise(r => { resolver = r; }));
  act(() => preencher(result.current));
  let pendente: Promise<void>;
  act(() => { pendente = result.current.cadastrarFrete(); });
  auth.id = "2"; rerender();
  expect(result.current.formularioCadastro).toEqual(cadastroInicial);
  expect(result.current.cadastroAberto).toBe(false);
  await act(async () => { resolver(freteSintetico()); await pendente; });
  expect(result.current.dados.idSelecionado).toBeNull();
  expect(result.current.detalhesAbertos).toBe(false);
});
it("troca de frete descarta cotação anterior somente após aviso", async () => {
  const { result } = await iniciar();
  await act(async () => result.current.abrirDetalhes("frete-a"));
  act(() => result.current.definirCotacaoAberta(true));
  act(() => result.current.definirFormularioCotacao({ transportadora: "3", valor: "15,00", prazoDias: "2", observacao: "Antiga" }));
  await act(async () => result.current.abrirDetalhes("frete-b"));
  expect(result.current.dados.idSelecionado).toBe("frete-a");
  await act(async () => result.current.confirmarDescarte());
  await waitFor(() => expect(result.current.dados.idSelecionado).toBe("frete-b"));
  act(() => result.current.definirCotacaoAberta(true));
  expect(result.current.formularioCotacao.valor).toBe("");
});
it("reabertura de classificação não carrega transportadora e valor antigos", async () => {
  const { result } = await iniciar();
  await act(async () => result.current.abrirDetalhes("frete-a"));
  act(() => result.current.definirClassificacaoAberta(true));
  act(() => result.current.definirFormularioClassificacao({ modalidade: "contratado", transportadoraId: "3", valorReferencia: "10" }));
  act(() => result.current.definirClassificacaoAberta(false));
  act(() => result.current.confirmarDescarte());
  act(() => result.current.definirClassificacaoAberta(true));
  expect(result.current.formularioClassificacao).toEqual({ modalidade: "cotar", transportadoraId: "", valorReferencia: "" });
});
it("falha apenas na classificação nunca reenvia criação", async () => {
  const { result, servico } = await iniciar();
  act(() => preencher(result.current));
  await act(async () => result.current.cadastrarFrete());
  act(() => result.current.definirClassificacaoAberta(true));
  vi.mocked(servico.classificar).mockRejectedValueOnce(new ErroApi("Temporariamente indisponível",503));
  await act(async () => result.current.classificarFrete());
  expect(result.current.classificacaoAberta).toBe(true);
  expect(result.current.dados.idSelecionado).toBe(freteSintetico().id);
  await act(async () => result.current.classificarFrete());
  expect(servico.cadastrar).toHaveBeenCalledTimes(1);
  expect(servico.classificar).toHaveBeenCalledTimes(2);
  expect(servico.classificar).toHaveBeenLastCalledWith(freteSintetico().id,{modalidade:"cotar"});
});
it("sucesso de criação continua confirmado com falha na recarga", async () => {
  const { result, servico } = await iniciar();
  vi.mocked(servico.listar).mockRejectedValue(new ErroApi("Falha na releitura",503));
  act(() => preencher(result.current));
  await act(async () => result.current.cadastrarFrete());
  await waitFor(() => expect(result.current.dados.erro).toContain("releitura"));
  expect(result.current.dados.detalhe.id).toBe(freteSintetico().id);
  expect(result.current.cadastroAberto).toBe(false);
  expect(result.current.dados.erroComando).toBeNull();
});
it("bloqueia envio duplicado enquanto pendente", async () => {
  const { result, servico } = await iniciar();
  let resolver: (v: FreteDetalheDTO) => void;
  vi.mocked(servico.cadastrar).mockImplementationOnce(() => new Promise(r => { resolver = r; }));
  act(() => preencher(result.current));
  let pendente: Promise<void>;
  act(() => { pendente = result.current.cadastrarFrete(); });
  await act(async () => result.current.cadastrarFrete());
  expect(servico.cadastrar).toHaveBeenCalledTimes(1);
  expect(result.current.dados.executando).toBe(true);
  await act(async () => { resolver(freteSintetico()); await pendente; });
});
it("400 associa campos sem repetir mensagem genérica", async () => {
  const { result, servico } = await iniciar();
  vi.mocked(servico.cadastrar).mockRejectedValue(new ErroApi("Revise",400,{ detalhes: { destino: ["Destino não atendido"] } }));
  act(() => preencher(result.current));
  await act(async () => result.current.cadastrarFrete());
  expect(result.current.errosCadastro.destino).toBe("Destino não atendido");
  expect(result.current.dados.erroComando).toBeNull();
  expect(result.current.formularioCadastro.destino).toBe("Entrega");
});
it.each([401,403,409,500,503,0])("falha %i preserva rascunho e respeita sessão", async status => {
  const { result, servico } = await iniciar();
  vi.mocked(servico.cadastrar).mockRejectedValue(new ErroApi("Retorno real",status));
  act(() => preencher(result.current));
  await act(async () => result.current.cadastrarFrete());
  expect(result.current.cadastroAberto).toBe(true);
  expect(result.current.formularioCadastro.quantidade).toBe("3,125");
  expect(result.current.dados.erroComando).toBeTruthy();
  expect(auth.retry).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
});
it.each(["Pedido cancelado","Pedido expirado","Quantidade restante alterada"])("retorno real 409: %s", async mensagem => {
  const { result, servico } = await iniciar();
  vi.mocked(servico.cadastrar).mockRejectedValue(new ErroApi(mensagem,409));
  act(() => result.current.selecionarPedido(pedido));
  act(() => result.current.definirFormularioCadastro(f => ({ ...f, destino: "Entrega", pesoToneladas: "0", metrosCubicos: "0", quantidadeVolumes: "0" })));
  await act(async () => result.current.cadastrarFrete());
  expect(result.current.dados.erroComando).toContain(mensagem);
});
it("corrige moeda de CT-e e impede terceira casa e textos excedidos", async () => {
  const { result, servico } = await iniciar();
  await act(async () => result.current.abrirDetalhes("frete-a"));
  act(() => result.current.definirFormularioDocumento({ numeroCte: "X".repeat(61), valorCte: "12.345", nomeArquivo: "", arquivoNfe: "" }));
  await act(async () => result.current.registrarDocumentos());
  expect(servico.registrarCTe).not.toHaveBeenCalled();
  expect(result.current.errosDocumento).toHaveProperty("numeroCte");
  expect(result.current.errosDocumento).toHaveProperty("valorCte");
  act(() => result.current.definirFormularioDocumento({ numeroCte: "CTE-FAKE", valorCte: "12,34", nomeArquivo: "", arquivoNfe: "" }));
  await act(async () => result.current.registrarDocumentos());
  expect(servico.registrarCTe).toHaveBeenCalledWith("frete-a",expect.objectContaining({ valor: "12.34" }));
});
it("cotação recusa prazo fracionário e observação excedida", async () => {
  const { result, servico } = await iniciar();
  await act(async () => result.current.abrirDetalhes("frete-a"));
  act(() => result.current.definirFormularioCotacao({ transportadora: "3", valor: "10,25", prazoDias: "1.5", observacao: "X".repeat(1001) }));
  await act(async () => result.current.cadastrarCotacao());
  expect(servico.registrarCotacao).not.toHaveBeenCalled();
  expect(result.current.errosCotacao).toHaveProperty("prazoDias");
  expect(result.current.errosCotacao).toHaveProperty("observacao");
});
it("401 no diretório revalida sessão e 403 mantém autorização separada", async () => {
  const { result, servico } = await iniciar();
  vi.spyOn(servico,"listarCompradoras").mockRejectedValueOnce(new ErroApi("Sessão a confirmar",401))
    .mockRejectedValueOnce(new ErroApi("Acesso recusado",403));
  await act(async () => { await expect(result.current.dados.consultarCompradoras()).rejects.toMatchObject({status:401}); });
  expect(auth.retry).toHaveBeenCalledTimes(1);
  await act(async () => { await expect(result.current.dados.consultarCompradoras()).rejects.toMatchObject({status:403}); });
  expect(auth.retry).toHaveBeenCalledTimes(1);
});
it("401 atrasado de diretório da empresa anterior não afeta a sessão atual", async () => {
  const { result, servico, rerender } = await iniciar();
  let rejeitar: (v: unknown) => void;
  vi.spyOn(servico,"listarTransportadoras").mockImplementationOnce(() => new Promise((_, r) => { rejeitar = r; }));
  const consulta = result.current.dados.consultarTransportadoras().catch(erro => erro);
  auth.id = "2"; rerender();
  await act(async () => { rejeitar(new ErroApi("Sessão anterior",401)); await consulta; });
  expect(auth.retry).not.toHaveBeenCalled();
});
