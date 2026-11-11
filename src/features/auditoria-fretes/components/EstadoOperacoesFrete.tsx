import { Button } from "@/components/ui/button";
import type { ResultadoOperacaoFrete } from "../use-consulta-auditoria-api";
import type { IntencaoFrete } from "../intencoes-frete";

export function EstadoOperacoesFrete({ operacao, erroConsulta, pendentes, erroProtecao, atualizar }: {
  operacao: ResultadoOperacaoFrete; erroConsulta: string | null;
  pendentes: IntencaoFrete[]; erroProtecao: string | null; atualizar: () => void;
}) {
  const incertas = pendentes.filter(i => i.estado !== "confirmada_localmente");
  const limpezaPendente = pendentes.some(i => i.estado === "confirmada_localmente");
  return <div className="space-y-3">
    {operacao.estado !== "nao_iniciada" && <div role={operacao.estado === "incerta" ? "alert" : "status"}
      className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
      {operacao.estado === "em_andamento" ? "Operação em andamento. Aguarde a resposta antes de reenviar." :
        operacao.estado === "confirmada" ? erroConsulta
          ? "Operação confirmada pelo servidor; a consulta não pôde ser atualizada. Atualizar a consulta não repetirá o comando."
          : "Operação confirmada pelo servidor." :
        operacao.estado === "rejeitada" ? "Esta tentativa foi rejeitada pelo backend. Revise a mensagem e os dados antes de tentar novamente." :
        operacao.estado === "bloqueada" ? "Envio bloqueado localmente. Nenhuma nova intenção foi iniciada." :
          "Resultado incerto: a operação pode ter sido gravada. Consulte o frete e o histórico; não inicie outro registro para substituir esta tentativa."}
    </div>}
    {erroProtecao && <p role="alert" className="rounded-xl border p-3 text-sm">{erroProtecao}</p>}
    {limpezaPendente && <p role="status" className="rounded-xl border p-3 text-sm">O servidor confirmou a operação, mas a proteção local não pôde ser limpa. Consulte o resultado; não reenvie por causa desse aviso. Após recarregar, a tentativa pode voltar a exigir verificação.</p>}
    {incertas.length > 0 && operacao.estado !== "em_andamento" && <section aria-label="Operações sem confirmação" className="space-y-2 rounded-2xl border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="font-semibold">Operação anterior sem confirmação</h3>
      <p>Existe uma tentativa pendente neste navegador. Após recarregar a página ou trocar de aba, um novo envio no mesmo contexto fica bloqueado. O histórico atual não permite reconciliar a chave automaticamente.</p>
      <p>Consulte o frete e o histórico. Não apague os dados do navegador para liberar o envio; solicite a verificação da operação. Nenhum payload ou assinatura foi guardado para reenvio.</p>
      <p>{incertas.length} contexto(s) pendente(s). A consulta, por si só, não confirma nem rejeita a tentativa.</p>
      <Button type="button" variant="outline" onClick={atualizar}>Consultar dados do servidor</Button>
    </section>}
  </div>;
}
