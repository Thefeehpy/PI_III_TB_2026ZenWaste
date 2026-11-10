import { useId, type HTMLInputTypeAttribute } from "react";
import { classeCampo } from "./ControlesAuditoriaIntegrada";

export function CampoAuditoria({ rotulo, valor, aoAlterar, tipo = "text", obrigatorio = true,
  formato, limite, erro, instrucao, nome,
}: {
  rotulo: string; valor: string; aoAlterar: (valor: string) => void;
  tipo?: HTMLInputTypeAttribute; obrigatorio?: boolean;
  formato?: "moeda" | "medida" | "inteiro";
  limite?: number; erro?: string; instrucao?: string; nome?: string;
}) {
  const id = useId();
  const ajuda = instrucao ?? (formato === "moeda" ? "R$ · até 2 casas decimais; use vírgula ou ponto, sem separador de milhar."
    : formato === "medida" ? "Até 3 casas decimais; use vírgula ou ponto, sem separador de milhar."
    : formato === "inteiro" ? "Somente números inteiros." : undefined);
  const excedido = limite !== undefined && Array.from(valor.trim()).length > limite;
  const mensagem = erro ?? (excedido ? `Use até ${limite} caracteres.` : undefined);
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="text-sm font-medium">{rotulo}{obrigatorio ? " *" : " (opcional)"}</label>
    <input id={id} name={nome} className={classeCampo} type={formato ? "text" : tipo}
      inputMode={formato === "inteiro" ? "numeric" : formato ? "decimal" : undefined}
      value={valor} required={obrigatorio} aria-invalid={Boolean(mensagem)}
      aria-describedby={[ajuda || limite ? `${id}-ajuda` : "", mensagem ? `${id}-erro` : ""].filter(Boolean).join(" ") || undefined}
      onChange={evento => aoAlterar(evento.target.value)} />
    {(ajuda || limite) && <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
      {ajuda} {limite !== undefined && `${Array.from(valor.trim()).length}/${limite} caracteres`}
    </p>}
    {mensagem && <p id={`${id}-erro`} className="text-sm text-destructive">{mensagem}</p>}
  </div>;
}
