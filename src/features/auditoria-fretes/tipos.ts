import type { SituacaoAuditoriaFrete } from "./tipos-api";

export type SituacaoFrete = "awaiting_classification" | "awaiting_quote" | "quoting" | "awaiting_document" | "awaiting_delivery" | "transport" | "divergent" | "delivered" | "canceled";
export type CotacaoFrete = {
    id: string;
    transportadora: string;
    valor: number;
    prazoDias: number;
    observacao: string;
    aprovada?: boolean;
};
export type DocumentoFrete = {
    nomeArquivo: string;
    numeroCte: string;
    valorCte: number;
    recebidoEm: string;
};
export type TratativaFrete = {
    id: string;
    registradoEm: string;
    autor: string;
    observacao: string;
};
export type EntregaFrete = {
    nomeRecebedor: string;
    confirmadoEm: string;
    dadosAssinatura?: string;
    assinaturaRegistrada?: boolean;
    tipoRecebimento: "complete" | "with_reservation";
    textoRessalva?: string;
};
export type ProcessoFrete = {
    id: string;
    pedidoId?: string | null;
    origemDados?: "api" | "demonstrativo";
    situacaoAuditoria?: SituacaoAuditoriaFrete;
    quantidade?: number;
    unidade?: string;
    valorReferencia?: number | null;
    valorCteConferido?: number | null;
    diferencaConferida?: number | null;
    divergenciaConfirmada?: boolean;
    divergenciaAberta?: boolean;
    transportadoraNome?: string;
    permissoes?: { gerenciar: boolean; confirmar_entrega: boolean };
    eventosHistorico?: Array<{ id: string; tipo: string; autor: string; registradoEm: string }>;
    numeroPedido: string;
    cliente: string;
    material: string;
    origem: string;
    destino: string;
    metrosCubicos: number;
    pesoToneladas: number;
    dataPedido: string;
    previsaoEntrega: string;
    situacao: SituacaoFrete;
    origemCadastro?: "erp" | "manual" | "marketplace";
    modalidadeFrete?: "quote" | "contracted" | "customer_pickup";
    motivoSemCotacao?: string;
    quantidadeVolumes?: number;
    dimensoesCaixaCm?: {
        length: number;
        width: number;
        height: number;
    };
    arquivoNfe?: string;
    registroRetirada?: {
        nomeFoto: string;
        registradaEm: string;
    };
    cotacoes: CotacaoFrete[];
    documento?: DocumentoFrete;
    tratativas: TratativaFrete[];
    entrega?: EntregaFrete;
};
export type PedidoErp = {
    id: string;
    numeroPedido: string;
    cliente: string;
    material: string;
    produtos: string;
    origem: string;
    destino: string;
    quantidade: number;
    unidadesPorCaixa: number;
    quantidadeVolumes: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    pesoToneladas: number;
    dataPedido: string;
    previsaoEntrega: string;
};
export type FormularioNovoFrete = {
    numeroPedido: string;
    cliente: string;
    material: string;
    origem: string;
    destino: string;
    metrosCubicos: string;
    pesoToneladas: string;
    previsaoEntrega: string;
};
export type TransportePublicado = {
    id: string;
    numeroPedido: string;
    material: string;
    origem: string;
    destino: string;
    pesoToneladas: number;
    metrosCubicos: number;
    valorSugerido: number;
    janelaColeta: string;
    tipoVeiculo: string;
    observacoes: string;
    propostas: number;
    publicadoEm: string;
};
export type FormularioPublicacaoTransporte = {
    valorSugerido: string;
    janelaColeta: string;
    tipoVeiculo: string;
    observacoes: string;
};
export type FormularioCotacao = {
    transportadora: string;
    valor: string;
    prazoDias: string;
    observacao: string;
};
export type FormularioDocumento = {
    arquivoNfe: string;
    nomeArquivo: string;
    numeroCte: string;
    valorCte: string;
};
export type FormularioCubagem = {
    quantidadeVolumes: string;
    comprimentoCm: string;
    larguraCm: string;
    alturaCm: string;
    pesoToneladas: string;
};
/** Snapshot da demonstração; não representa um contrato HTTP logístico existente. */
export interface EstadoAuditoriaFretes {
    processos: ProcessoFrete[];
    pedidosErpPendentes: PedidoErp[];
    transportesPublicados: TransportePublicado[];
}
