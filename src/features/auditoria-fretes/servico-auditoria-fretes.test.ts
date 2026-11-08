import { describe, expect, it } from "vitest";
import { criarServicoAuditoriaDemonstrativa } from "./servico-auditoria-fretes";

describe("serviço demonstrativo de auditoria", () => {
  it("isola instâncias e devolve cópias sem alterar os dados de outra sessão", async () => {
    const primeira = criarServicoAuditoriaDemonstrativa();
    const segunda = criarServicoAuditoriaDemonstrativa();
    const inicial = await primeira.carregar();
    const pedido = inicial.pedidosErpPendentes[0];
    await primeira.importarPedidoErp(pedido.id, "quote");
    expect((await primeira.carregar()).pedidosErpPendentes.some((registro) => registro.id === pedido.id)).toBe(false);
    expect((await segunda.carregar()).pedidosErpPendentes.some((registro) => registro.id === pedido.id)).toBe(true);
    inicial.processos.length = 0;
    expect((await primeira.carregar()).processos.length).toBeGreaterThan(0);
  });

  it("preserva cotação, conferência com divergência e entrega na mesma simulação", async () => {
    const servico = criarServicoAuditoriaDemonstrativa();
    const inicial = await servico.carregar();
    const importacao = await servico.importarPedidoErp(inicial.pedidosErpPendentes[0].id, "quote");
    const processo = importacao.processos[0];
    const cotacao = await servico.cadastrarCotacao(processo.id, { transportadora: "Transportadora de teste", valor: "400", prazoDias: "2", observacao: "Cotação demonstrativa" });
    const idCotacao = cotacao.processos[0].cotacoes[0].id;
    await servico.aprovarCotacao(processo.id, idCotacao);
    const conferencia = await servico.registrarDocumentoDemonstrativo(processo.id, { arquivoNfe: "nfe-teste.pdf", nomeArquivo: "cte-teste.pdf", numeroCte: "senha-de-teste", valorCte: "420" });
    expect(conferencia.processos[0].situacao).toBe("divergent");
    expect(conferencia.processos[0].cotacoes.find((registro) => registro.aprovada)?.valor).toBe(400);
    const entrega = await servico.confirmarEntrega(processo.id, { nomeRecebedor: "Recebedor de teste", dadosAssinatura: "assinatura-demonstrativa", tipoRecebimento: "with_reservation", textoRessalva: "Conferir um volume" });
    expect(entrega.processos[0]).toMatchObject({ situacao: "delivered", entrega: { nomeRecebedor: "Recebedor de teste", textoRessalva: "Conferir um volume" } });
    expect(entrega.processos[0].tratativas).toHaveLength(4);
  });
});
