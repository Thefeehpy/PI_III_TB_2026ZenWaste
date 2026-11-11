import type { FreteDTO, SituacaoAuditoriaFrete } from "./tipos-api";

export const rotulosSituacao: Record<SituacaoAuditoriaFrete, string> = {
  aguardando_classificacao: "Aguardando classificação",
  em_cotacao: "Em cotação",
  aguardando_conferencia: "Aguardando conferência",
  com_divergencia: "Com divergência",
  aguardando_entrega: "Aguardando entrega",
  concluido: "Auditoria concluída",
  cancelado: "Cancelado",
};
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export function apresentarMoeda(valor: string | null) {
  return valor === null
    ? "Não informado ou restrito"
    : moeda.format(Number(valor));
}
export function apresentarMedida(valor: string | null, unidade: string) {
  return valor === null ? "Não informada" : `${valor.replace(".", ",")} ${unidade}`;
}
export function apresentarDiferenca(valor: string | null) {
  if (valor === null) return "Não informada ou restrita";
  return `${Number(valor) > 0 ? "+" : ""}${apresentarMoeda(valor)}`;
}
export function apresentarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "Data não disponibilizada" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short",
  }).format(data);
}
export function apresentarTitulo(frete: FreteDTO) {
  return frete.pedido_id
    ? `Pedido #${frete.numero_pedido}`
    : `Frete avulso ${frete.numero_pedido}`;
}
