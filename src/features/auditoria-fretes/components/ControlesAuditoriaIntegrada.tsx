import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaginacaoFretesDTO } from "../tipos-api";
export { SeletorEmpresaFrete } from "./SeletorEmpresaFrete";

export const classeCampo =
  "h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm";

export function PaginacaoAuditoria({
  dados,
  aoMudar,
  desabilitada = false,
}: {
  dados: PaginacaoFretesDTO | undefined;
  aoMudar: (pagina: number) => void;
  desabilitada?: boolean;
}) {
  if (!dados) return null;
  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <Button
        type="button"
        variant="outline"
        disabled={desabilitada || dados.pagina <= 1}
        onClick={() => aoMudar(dados.pagina - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {dados.pagina} de {dados.total_paginas} · {dados.total}{" "}
        registro(s)
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={desabilitada || dados.pagina >= dados.total_paginas}
        onClick={() => aoMudar(dados.pagina + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

export function DialogoOperacaoFrete({
  aberto,
  aoAbrir,
  titulo,
  descricao,
  executando,
  erro,
  aoConfirmar,
  filhos,
  erros = {},
  rotuloConfirmar = "Confirmar",
  amplo = false,
  validarLocalmente = false,
  aoAtualizar,
  destrutiva = false,
}: {
  aberto: boolean;
  aoAbrir: (aberto: boolean) => void;
  titulo: string;
  descricao: string;
  executando: boolean;
  erro: string | null;
  aoConfirmar: () => Promise<unknown>;
  filhos: ReactNode;
  erros?: Record<string, string>;
  rotuloConfirmar?: string;
  amplo?: boolean;
  validarLocalmente?: boolean;
  aoAtualizar?: () => void;
  destrutiva?: boolean;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const mensagemErro = useRef<HTMLParagraphElement>(null);
  const gatilho = useRef<HTMLElement | null>(null);
  const enviando = useRef(false);
  useLayoutEffect(() => {
    if (aberto && Object.keys(erros).length)
      formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [erros, aberto]);
  useLayoutEffect(() => {
    if (aberto && erro) mensagemErro.current?.focus();
  }, [aberto, erro]);
  return (
    <Dialog
      open={aberto}
      onOpenChange={(valor) => {
        if (!executando) aoAbrir(valor);
      }}
    >
      <DialogContent className={`flex max-h-[90dvh] flex-col overflow-hidden rounded-[30px] ${amplo ? "sm:max-w-3xl" : "sm:max-w-xl"}`}
        onOpenAutoFocus={() => {
          gatilho.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={evento => {
          if (gatilho.current?.isConnected && !gatilho.current.matches(":disabled")) {
            evento.preventDefault();
            gatilho.current.focus();
          }
        }}
        onEscapeKeyDown={evento => {
          // O primeiro Escape fecha a lista; o próximo mantém o fechamento
          // normal do diálogo Radix, que escuta a tecla no document.
          if (evento.target instanceof HTMLElement && evento.target.closest("[data-seletor-empresa-frete]")
            ?.querySelector('[role="combobox"][aria-expanded="true"]')) evento.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form ref={formulario} noValidate={validarLocalmente} className="flex min-h-0 flex-1 flex-col" aria-busy={executando}
          onSubmit={async (evento) => {
            evento.preventDefault();
            if (executando || enviando.current) return;
            enviando.current = true;
            try { await aoConfirmar(); } finally { enviando.current = false; }
          }}>
          <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <fieldset disabled={executando} className="min-w-0 space-y-4 pb-4">
            {Object.keys(erros).length > 0 && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm">Revise os {Object.keys(erros).length} campo(s) indicados antes de confirmar.</p>}

            {filhos}
            {erro && (
              <p ref={mensagemErro} tabIndex={-1} role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </fieldset>
          </div>
          <div className="shrink-0 space-y-2 border-t bg-background pt-3">
            {erro && aoAtualizar && <Button type="button" variant="outline" disabled={executando} onClick={aoAtualizar}>Atualizar dados do servidor</Button>}
            <Button disabled={executando} variant={destrutiva ? "destructive" : "default"} type="submit" className="w-full rounded-2xl">
              {executando ? "Salvando…" : rotuloConfirmar}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
