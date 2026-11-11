import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogoOperacaoFrete } from "./ControlesAuditoriaIntegrada";
import { apresentarMoeda } from "../apresentacao-api";
import type { CotacaoFreteDTO, FreteDetalheDTO } from "../tipos-api";

export function CotacoesFrete({ cotacoes, podeGerenciar, executando, erro, registrar, aprovar, atualizar, aoRevisar }: {
  cotacoes: CotacaoFreteDTO[]; podeGerenciar: boolean; executando: boolean; erro: string | null;
  registrar: () => void; aprovar: (id: string) => Promise<FreteDetalheDTO | null>; atualizar: () => void;
  aoRevisar?: () => void;
}) {
  const [selecionada, selecionar] = useState<CotacaoFreteDTO | null>(null);
  return <section aria-label="Propostas de transporte" className="space-y-4">
    <p className="text-xs text-muted-foreground">Cotações cadastradas pela empresa vendedora. São exibidas somente as propostas disponibilizadas para este participante.</p>
    {podeGerenciar && <Button disabled={executando} onClick={registrar}>Registrar cotação</Button>}
    {!cotacoes.length && <p>Nenhuma cotação disponível para este participante.</p>}
    {cotacoes.map(c => <article key={c.id} className={`space-y-3 rounded-2xl border p-4 text-sm ${c.aprovada ? "border-primary bg-primary/5" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{c.transportadora.razao_social}</h3>
        <span className="rounded-full border px-3 py-1 text-xs">{c.aprovada ? "Proposta aprovada" : "Proposta não aprovada"}</span></div>
      <p>Valor proposto: {apresentarMoeda(c.valor)} · Prazo: {c.prazo_dias} dia(s)</p>
      {c.observacao && <p className="break-words">Observação: {c.observacao}</p>}
      {podeGerenciar && !c.aprovada && <Button disabled={executando} variant="outline" onClick={() => { aoRevisar?.(); selecionar(c); }}>Revisar aprovação</Button>}
    </article>)}
    <DialogoOperacaoFrete aberto={Boolean(selecionada)} aoAbrir={aberto => { if (!aberto) selecionar(null); }} titulo="Aprovar cotação"
      descricao="A aprovação define a transportadora e o valor de referência do frete. A proposta só será identificada como aprovada após confirmação do servidor."
      executando={executando} erro={erro} aoAtualizar={atualizar} rotuloConfirmar="Confirmar aprovação"
      aoConfirmar={async () => { if (selecionada && await aprovar(selecionada.id)) selecionar(null); }}
      filhos={<div className="space-y-2 text-sm"><p>{selecionada?.transportadora.razao_social}</p><p>{selecionada && apresentarMoeda(selecionada.valor)} · {selecionada?.prazo_dias} dia(s)</p></div>} />
  </section>;
}
