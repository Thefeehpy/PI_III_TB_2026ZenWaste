import type { FreteDetalheDTO, FreteDTO, SituacaoAuditoriaFrete } from "./tipos-api";
import type { ProcessoFrete, SituacaoFrete } from "./tipos";

const situacoesApresentacao: Record<SituacaoAuditoriaFrete, SituacaoFrete> = {
  aguardando_classificacao: "awaiting_classification",
  em_cotacao: "quoting",
  aguardando_conferencia: "awaiting_document",
  com_divergencia: "divergent",
  aguardando_entrega: "awaiting_delivery",
  concluido: "delivered",
  cancelado: "canceled",
};

/** Conversão exclusiva para exibição. Conferência e alocação permanecem no backend. */
function decimalExibicao(valor: string | null): number | null {
  if (valor === null) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new Error("A API retornou um valor decimal inválido.");
  return numero;
}

export function apresentarFreteApi(dados: FreteDTO): ProcessoFrete {
  return {
    id: dados.id,
    pedidoId: dados.pedido_id,
    origemDados: "api",
    situacaoAuditoria: dados.situacao,
    numeroPedido: dados.numero_pedido,
    cliente: dados.cliente,
    material: dados.material,
    quantidade: decimalExibicao(dados.quantidade) ?? 0,
    unidade: dados.unidade,
    origem: dados.origem,
    destino: dados.destino,
    pesoToneladas: decimalExibicao(dados.peso_toneladas) ?? 0,
    metrosCubicos: decimalExibicao(dados.cubagem_m3) ?? 0,
    quantidadeVolumes: dados.quantidade_volumes,
    dataPedido: dados.data_pedido,
    previsaoEntrega: dados.previsao_entrega || "",
    situacao: situacoesApresentacao[dados.situacao],
    modalidadeFrete: dados.modalidade === "cotar" ? "quote" : dados.modalidade === "contratado" ? "contracted" : dados.modalidade === "retirada_cliente" ? "customer_pickup" : undefined,
    origemCadastro: dados.pedido_id ? "marketplace" : "manual",
    valorReferencia: decimalExibicao(dados.valor_referencia),
    valorCteConferido: decimalExibicao(dados.valor_cte),
    diferencaConferida: decimalExibicao(dados.diferenca),
    divergenciaConfirmada: dados.divergente,
    divergenciaAberta: dados.divergencia_aberta,
    transportadoraNome: dados.transportadora?.razao_social,
    permissoes: dados.permissoes,
    cotacoes: [],
    tratativas: [],
  };
}

export function apresentarDetalheFreteApi(dados: FreteDetalheDTO): ProcessoFrete {
  return {
    ...apresentarFreteApi(dados),
    cotacoes: dados.cotacoes.map((cotacao) => ({
      id: cotacao.id, transportadora: cotacao.transportadora.razao_social,
      valor: decimalExibicao(cotacao.valor) ?? 0, prazoDias: cotacao.prazo_dias,
      observacao: cotacao.observacao, aprovada: cotacao.aprovada,
    })),
    documento: dados.documento ? {
      nomeArquivo: dados.documento.nome_arquivo, numeroCte: dados.documento.numero,
      valorCte: decimalExibicao(dados.documento.valor) ?? 0, recebidoEm: dados.documento.recebido_em,
    } : undefined,
    arquivoNfe: dados.documento?.arquivo_nfe || undefined,
    tratativas: dados.tratativas.map((tratativa) => ({
      id: tratativa.id, observacao: tratativa.observacao,
      autor: tratativa.autor.razao_social, registradoEm: tratativa.registrado_em,
    })),
    eventosHistorico: dados.historico.map((evento) => ({
      id: evento.id, tipo: evento.tipo.replace(/_/g, " "),
      autor: evento.autor.razao_social, registradoEm: evento.registrado_em,
    })),
    registroRetirada: dados.retirada ? { nomeFoto: dados.retirada.nome_foto, registradaEm: dados.retirada.registrada_em } : undefined,
    entrega: dados.entrega ? {
      nomeRecebedor: dados.entrega.nome_recebedor,
      confirmadoEm: dados.entrega.confirmado_em,
      tipoRecebimento: dados.entrega.tipo_recebimento === "com_ressalva" ? "with_reservation" : "complete",
      textoRessalva: dados.entrega.ressalva,
      assinaturaRegistrada: dados.entrega.assinatura_registrada,
    } : undefined,
  };
}

export function tituloFrete(processo: ProcessoFrete): string {
  return processo.origemDados === "api" && !processo.pedidoId
    ? `Frete avulso ${processo.id.slice(0, 8)}`
    : `Pedido #${processo.numeroPedido}`;
}
