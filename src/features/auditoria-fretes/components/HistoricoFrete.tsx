import type { EventoHistoricoFreteDTO } from "../tipos-api";
import { apresentarData, rotulosSituacao } from "../apresentacao-api";
const rotulos: Record<string, string> = { criar: "Cadastro de frete", classificar: "Modalidade definida", cotacoes: "Cotação registrada pela vendedora",
  "aprovar-cotacao": "Cotação aprovada", "registrar-cte": "Versão de CT-e registrada", "resolver-divergencia": "Diferença aceita com justificativa",
  retirada: "Retirada registrada", "confirmar-entrega": "Recebimento comercial confirmado", cancelar: "Frete cancelado", tratativas: "Tratativa interna registrada", "publicar-demanda": "Demanda interna registrada" };
export function HistoricoFrete({ eventos }: { eventos: EventoHistoricoFreteDTO[] }) {
  return <section aria-label="Linha do tempo do frete" className="space-y-3">
    <p className="text-xs text-muted-foreground">Eventos e ordem disponibilizados pelo servidor para este participante. Nenhum evento é criado a partir de suposição de status.</p>
    {!eventos.length && <p>Nenhum evento disponibilizado.</p>}
    <ol className="space-y-3 border-l-2 border-primary/30 pl-4">{eventos.map(e => <li key={e.id} className="space-y-2 rounded-xl border p-4 text-sm">
      <h3 className="font-semibold">{rotulos[e.tipo] ?? "Evento registrado"}</h3>
      <p>Empresa autora: {e.autor.razao_social} · {apresentarData(e.registrado_em)}</p>
      <p>{e.situacao_anterior ? `${rotulosSituacao[e.situacao_anterior]} → ` : ""}{rotulosSituacao[e.situacao_nova]}</p>
      {typeof e.detalhes.versao === "number" && <p>Versão do CT-e: {e.detalhes.versao}</p>}
      {e.detalhes.nova_divergencia === true && <p>O servidor registrou nova divergência nesta conferência.</p>}
      {typeof e.detalhes.observacao === "string" && <p className="break-words">Registro interno: {e.detalhes.observacao}</p>}
      {typeof e.detalhes.justificativa === "string" && <p className="break-words">Justificativa: {e.detalhes.justificativa}</p>}
    </li>)}</ol>
  </section>;
}
