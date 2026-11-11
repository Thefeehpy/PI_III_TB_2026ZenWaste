import type { FreteDetalheDTO } from "./tipos-api";

/** Exibe somente ações compatíveis com flags/estado retornados; o servidor revalida. */
export function acoesFrete(frete: FreteDetalheDTO | null) {
  const gestao = Boolean(frete?.permissoes.gerenciar);
  const encerrado = !frete || ["concluido", "cancelado"].includes(frete.situacao);
  return {
    classificar: gestao && frete?.situacao === "aguardando_classificacao",
    cotacao: gestao && frete?.situacao === "em_cotacao",
    documento: gestao && Boolean(frete && frete.modalidade !== "retirada_cliente" && frete.valor_referencia !== null &&
      ["aguardando_conferencia", "com_divergencia", "aguardando_entrega"].includes(frete.situacao)),
    aceitar: gestao && frete?.situacao === "com_divergencia" && Boolean(frete.divergencia_aberta),
    cancelar: gestao && !encerrado && !frete?.retirada && !frete?.entrega,
    tratativa: gestao,
    demanda: gestao && !encerrado,
    retirada: Boolean(frete?.permissoes.registrar_retirada && !frete.retirada && !frete.entrega),
    recebimento: Boolean(frete?.permissoes.confirmar_entrega && !frete.entrega),
  };
}
