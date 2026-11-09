import type {
  FreteDetalheDTO,
  ListaFretesDTO,
} from "@/features/auditoria-fretes/tipos-api";

export function freteSintetico(
  alteracoes: Partial<FreteDetalheDTO> = {},
): FreteDetalheDTO {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    pedido_id: null,
    numero_pedido: "AV-TESTE",
    cliente: "Compradora sintética",
    material: "Material sintético",
    quantidade: "3.000",
    unidade: "KG",
    origem: "Origem",
    destino: "Destino",
    empresa_vendedora: { id: 1, razao_social: "Vendedora sintética" },
    empresa_compradora: { id: 2, razao_social: "Compradora sintética" },
    transportadora: null,
    peso_toneladas: "0.003",
    cubagem_m3: "1.000",
    quantidade_volumes: 1,
    data_pedido: "2026-11-08",
    previsao_entrega: null,
    situacao: "aguardando_classificacao",
    modalidade: null,
    valor_referencia: null,
    valor_cte: null,
    diferenca: null,
    divergente: false,
    divergencia_aberta: false,
    recebimento_confirmado: false,
    permissoes: {
      gerenciar: true,
      confirmar_entrega: false,
      registrar_retirada: false,
    },
    cotacoes: [],
    documento: null,
    documentos: [],
    divergencias: [],
    tratativas: [],
    historico: [],
    demandas: [],
    retirada: null,
    entrega: null,
    ...alteracoes,
  };
}
export function listaFretesSintetica(): ListaFretesDTO {
  return {
    resultados: [freteSintetico()],
    paginacao: { pagina: 1, tamanho_pagina: 10, total: 1, total_paginas: 1 },
    indicadores: {
      aguardando_classificacao: 1,
      aguardando_cotacao: 0,
      em_andamento: 0,
      divergentes: 0,
      concluidos: 0,
      cancelados: 0,
    },
  };
}
