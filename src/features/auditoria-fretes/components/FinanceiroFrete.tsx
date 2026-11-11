import type { FreteDetalheDTO } from "../tipos-api";
import { apresentarMoeda, apresentarDiferenca, apresentarData } from "../apresentacao-api";

export function FinanceiroFrete({ frete }: { frete: FreteDetalheDTO }) {
  return <section aria-label="Conferência financeira" className="space-y-3 rounded-2xl border p-4">
    <h3 className="font-semibold">Conferência financeira</h3>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      {[["Valor de referência", apresentarMoeda(frete.valor_referencia)], ["Valor informado no CT-e", apresentarMoeda(frete.valor_cte)],
        ["Diferença identificada", apresentarDiferenca(frete.diferenca)]].map(([nome, valor]) => <div key={nome}><dt className="text-muted-foreground">{nome}</dt><dd className="font-semibold">{valor}</dd></div>)}
    </dl>
    <p className="text-sm font-medium">{frete.divergencia_aberta ? "Pendência financeira aberta — exige tratamento." :
      frete.divergente ? "Diferença factual mantida; sem pendência financeira aberta." :
        frete.diferenca === null ? "Conferência financeira ainda não disponível para este participante." : "Sem pendência financeira aberta informada pelo servidor."}</p>
    <p className="text-xs text-muted-foreground">Tolerância absoluta: somente diferenças acima de R$ 5,00, em qualquer sinal, exigem análise. A situação e os valores exibidos são os retornados pelo servidor.</p>
    {frete.recebimento_confirmado && frete.divergencia_aberta && <p className="text-sm">Recebimento comercial confirmado; a auditoria permanece pendente.</p>}
  </section>;
}
export function DivergenciasFrete({ frete }: { frete: FreteDetalheDTO }) {
  return <div className="space-y-3">
    <FinanceiroFrete frete={frete} />
    {!frete.divergencias.length && <p className="text-sm">Nenhuma análise disponibilizada para este participante.</p>}
    {frete.divergencias.map(d => <article key={d.id} className="space-y-2 rounded-2xl border p-4 text-sm">
      <h3 className="font-semibold">{d.tipo_resolucao === "cte_corrigido" ? "Pendência substituída por CT-e corrigido" :
        d.tipo_resolucao === "aceite_justificado" ? "Pendência resolvida por aceite justificado" : "Divergência aberta"}</h3>
      <p>Referência: {apresentarMoeda(d.valor_referencia)} · Cobrado: {apresentarMoeda(d.valor_cobrado)} · Diferença: {apresentarDiferenca(d.diferenca)}</p>
      <p>Documento analisado: {frete.documentos.find(doc => doc.id === d.documento_id)?.numero ?? "Identificação não disponibilizada"}</p>
      {d.documento_correcao_id && <p>Documento de correção: {frete.documentos.find(doc => doc.id === d.documento_correcao_id)?.numero ?? "Identificação não disponibilizada"}. Uma correção ainda fora da tolerância pode ter originado outra pendência, listada separadamente.</p>}
      {d.justificativa && <p className="break-words">Justificativa: {d.justificativa}</p>}
      {d.empresa_resolvedora && <p>Empresa responsável: {d.empresa_resolvedora.razao_social}</p>}
      {d.resolvida_em && <p>Resolvida em {apresentarData(d.resolvida_em)}</p>}
    </article>)}
  </div>;
}
