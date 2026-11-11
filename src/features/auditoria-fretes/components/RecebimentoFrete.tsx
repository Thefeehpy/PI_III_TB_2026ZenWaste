import { SignaturePad } from "@/components/SignaturePad";
import { CampoAuditoria } from "./CampoAuditoria";
import { classeCampo } from "./ControlesAuditoriaIntegrada";
import type { FormularioRecebimentoFrete } from "../use-operacoes-frete";
import type { ErrosFrete } from "../validacoes";

export function RecebimentoFrete({ formulario: f, alterar, erros, empresa, identificacao }: {
  formulario: FormularioRecebimentoFrete; alterar: (f: FormularioRecebimentoFrete) => void;
  erros: ErrosFrete; empresa: string; identificacao: string;
}) {
  return <div className="space-y-4">
    <div className="rounded-xl border bg-muted/20 p-3 text-sm"><p>Frete: {identificacao}</p><p>Empresa compradora: {empresa}</p>
      <p>Confirmação comercial de recebimento. Não representa confirmação ambiental de MTR/SIGOR.</p></div>
    <CampoAuditoria rotulo="Nome do recebedor" limite={120} valor={f.nome} erro={erros.nomeRecebedor} aoAlterar={nome => alterar({ ...f, nome, revisado: false })} />
    <label className="block space-y-2"><span>Tipo de recebimento</span>
      <select className={classeCampo} value={f.tipo} aria-invalid={Boolean(erros.tipo)} onChange={e => alterar({ ...f, tipo: e.target.value as typeof f.tipo, ressalva: "", revisado: false })}>
        <option value="complete">Completo</option><option value="with_reservation">Com ressalva</option>
      </select>
    </label>
    {f.tipo === "with_reservation" && <CampoAuditoria rotulo="Ressalva" valor={f.ressalva} limite={1000} erro={erros.textoRessalva} aoAlterar={ressalva => alterar({ ...f, ressalva, revisado: false })} />}
    <div role="group" aria-label="Assinatura manuscrita do recebedor" tabIndex={-1} aria-invalid={Boolean(erros.dadosAssinatura)} aria-describedby="instrucao-assinatura-frete erro-assinatura-frete">
      <p className="mb-2 font-medium">Assinatura manuscrita obrigatória</p>
      <p id="instrucao-assinatura-frete" className="mb-3 text-xs text-muted-foreground">Use mouse, dedo ou caneta. Este método depende de ponteiro; ainda não há alternativa operacional de aceite por teclado. O aceite eletrônico está pendente de evolução aprovada do backend. A imagem permanece somente neste rascunho até o envio.</p>
      <SignaturePad value={f.assinatura} onChange={assinatura => alterar({ ...f, assinatura, revisado: false })} />
      <p id="erro-assinatura-frete" className="text-sm text-destructive">{erros.dadosAssinatura}</p>
    </div>
    <div className="rounded-xl border p-3 text-sm"><p>Revise: {f.nome || "Recebedor a informar"} · {f.tipo === "with_reservation" ? "Com ressalva" : "Completo"} · assinatura {f.assinatura ? "capturada no rascunho" : "não registrada"}.</p>
      <p>O recebimento não resolve uma divergência financeira aberta.</p></div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.revisado} aria-invalid={Boolean(erros.revisado)} aria-describedby={erros.revisado ? "erro-revisao-recebimento" : undefined}
      onChange={e => alterar({ ...f, revisado: e.target.checked })} /><span>Revisei os dados desta confirmação comercial e a assinatura manuscrita.</span></label>
    {erros.revisado && <p id="erro-revisao-recebimento" className="text-sm text-destructive">{erros.revisado}</p>}
  </div>;
}
