/** Contratos HTTP de fretes. Valores decimais chegam como texto para preservar precisão. */
export type SituacaoAuditoriaFrete =
  | "aguardando_classificacao"
  | "em_cotacao"
  | "aguardando_conferencia"
  | "com_divergencia"
  | "aguardando_entrega"
  | "concluido"
  | "cancelado";

export type ModalidadeAuditoriaFrete = "cotar" | "contratado" | "retirada_cliente";

export interface EmpresaFreteDTO {
  id: number;
  razao_social: string;
}

export interface PermissoesFreteDTO {
  gerenciar: boolean;
  confirmar_entrega: boolean;
  registrar_retirada: boolean;
}

export interface PaginacaoFretesDTO {
  pagina: number;
  tamanho_pagina: number;
  total: number;
  total_paginas: number;
}

export interface IndicadoresFretesDTO {
  aguardando_classificacao: number;
  aguardando_cotacao: number;
  em_andamento: number;
  divergentes: number;
  concluidos: number;
  cancelados: number;
}

export interface FreteDTO {
  id: string;
  pedido_id: string | null;
  numero_pedido: string;
  cliente: string;
  material: string;
  quantidade: string;
  unidade: string;
  origem: string;
  destino: string;
  empresa_vendedora: EmpresaFreteDTO;
  empresa_compradora: EmpresaFreteDTO;
  transportadora: EmpresaFreteDTO | null;
  peso_toneladas: string | null;
  cubagem_m3: string | null;
  quantidade_volumes: number | null;
  data_pedido: string;
  previsao_entrega: string | null;
  situacao: SituacaoAuditoriaFrete;
  modalidade: ModalidadeAuditoriaFrete | null;
  valor_referencia: string | null;
  valor_cte: string | null;
  diferenca: string | null;
  divergente: boolean;
  divergencia_aberta: boolean;
  permissoes: PermissoesFreteDTO;
  recebimento_confirmado: boolean;
}

export interface CotacaoFreteDTO {
  id: string;
  transportadora: EmpresaFreteDTO;
  valor: string;
  prazo_dias: number;
  observacao: string;
  aprovada: boolean;
}

export interface DocumentoFreteDTO {
  id: string;
  numero: string;
  valor: string;
  nome_arquivo: string;
  arquivo_nfe: string;
  recebido_em: string;
  versao: number;
}

export interface DivergenciaFreteDTO {
  id: string;
  documento_id: string;
  valor_referencia: string;
  valor_cobrado: string;
  diferenca: string;
  tipo_resolucao: "" | "aceite_justificado" | "cte_corrigido";
  documento_correcao_id: string | null;
  justificativa: string;
  empresa_resolvedora: EmpresaFreteDTO | null;
  resolvida_em: string | null;
}

export interface TratativaFreteDTO {
  id: string;
  observacao: string;
  autor: EmpresaFreteDTO;
  registrado_em: string;
}

export interface EventoHistoricoFreteDTO {
  id: string;
  tipo: string;
  situacao_anterior: SituacaoAuditoriaFrete | null;
  situacao_nova: SituacaoAuditoriaFrete;
  autor: EmpresaFreteDTO;
  registrado_em: string;
  detalhes: Record<string, unknown>;
}

export interface FreteDetalheDTO extends FreteDTO {
  cotacoes: CotacaoFreteDTO[];
  documento: DocumentoFreteDTO | null;
  documentos: DocumentoFreteDTO[];
  divergencias: DivergenciaFreteDTO[];
  tratativas: TratativaFreteDTO[];
  historico: EventoHistoricoFreteDTO[];
  demandas: DemandaFreteDTO[];
  retirada: { nome_foto: string; registrada_em: string } | null;
  entrega: {
    nome_recebedor: string;
    confirmado_em: string;
    tipo_recebimento: "completo" | "com_ressalva";
    ressalva: string;
    assinatura_registrada: boolean;
  } | null;
}

export interface DemandaFreteDTO {
  id: string;
  frete_id: string;
  numero_pedido: string;
  material: string;
  origem: string;
  destino: string;
  peso_toneladas: string | null;
  cubagem_m3: string | null;
  valor_sugerido: string;
  janela_coleta: string;
  tipo_veiculo: string;
  observacoes: string;
  publicado_em: string;
  propostas: number;
}

export interface ListaDemandasFreteDTO {
  resultados: DemandaFreteDTO[];
  paginacao: PaginacaoFretesDTO;
}

export interface ListaEmpresasFreteDTO {
  resultados: EmpresaFreteDTO[];
  paginacao: PaginacaoFretesDTO;
}

export interface ListaFretesDTO {
  resultados: FreteDTO[];
  paginacao: PaginacaoFretesDTO;
  indicadores: IndicadoresFretesDTO;
}

export interface PedidoDisponivelFreteDTO {
  id: string;
  numero: string;
  material: string;
  cliente: string;
  origem: string;
  data_pedido: string;
  quantidade: string;
  quantidade_restante: string;
  unidade: string;
}

export interface ListaPedidosFreteDTO {
  resultados: PedidoDisponivelFreteDTO[];
  paginacao: PaginacaoFretesDTO;
}

export interface ConsultaFretes {
  pagina?: number;
  tamanho_pagina?: number;
  situacao?: SituacaoAuditoriaFrete;
  transportadora_id?: number;
  data_inicio?: string;
  data_fim?: string;
  busca?: string;
}

export interface CadastroFreteDTO {
  pedido_id?: string;
  empresa_compradora_id?: number;
  material?: string;
  unidade?: string;
  quantidade: string;
  origem: string;
  destino: string;
  peso_toneladas: string;
  cubagem_m3: string;
  quantidade_volumes: number;
  previsao_entrega: string;
}

export interface ClassificacaoFreteDTO {
  modalidade: ModalidadeAuditoriaFrete;
  transportadora_id?: number;
  valor_referencia?: string;
}

export interface CadastroCotacaoFreteDTO {
  transportadora_id: number;
  valor: string;
  prazo_dias: number;
  observacao: string;
}

export interface RegistroCTeDTO {
  numero: string;
  valor: string;
  nome_arquivo?: string;
  arquivo_nfe?: string;
}

export interface ConfirmacaoEntregaFreteDTO {
  nome_recebedor: string;
  dados_assinatura: string;
  tipo_recebimento: "completo" | "com_ressalva";
  ressalva: string;
}

export interface PublicacaoDemandaFreteDTO {
  valor_sugerido: string;
  janela_coleta: string;
  tipo_veiculo: string;
  observacoes: string;
}
