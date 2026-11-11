import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ListaEmpresasFreteDTO, PaginacaoFretesDTO } from "../tipos-api";

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

export function SeletorEmpresaFrete({
  rotulo,
  valor,
  aoAlterar,
  consultar,
  obrigatorio = true,
  erroCampo,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  erroCampo?: string;
  valor: string;
  aoAlterar: (valor: string, nome?: string) => void;
  consultar: (
    busca?: string,
    sinal?: AbortSignal,
    pagina?: number,
  ) => Promise<ListaEmpresasFreteDTO>;
}) {
  const identificador = useId();
  const [busca, definirBusca] = useState("");
  const [pagina, definirPagina] = useState(1);
  const [dados, definirDados] = useState<ListaEmpresasFreteDTO | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [tentativa, definirTentativa] = useState(0);
  const [nomes, definirNomes] = useState<Record<string, string>>({});
  useEffect(() => { definirNomes({}); }, [consultar]);
  useEffect(() => {
    const controle = new AbortController();
    definirCarregando(true);
    definirDados(null);
    definirErro(null);
    const temporizador = setTimeout(() => {
      consultar(busca, controle.signal, pagina)
        .then((resposta) => {
          if (!controle.signal.aborted) {
            definirDados(resposta);
            definirNomes(anteriores => ({ ...anteriores, ...Object.fromEntries(resposta.resultados.map(empresa => [String(empresa.id), empresa.razao_social])) }));
            definirErro(null);
          }
        })
        .catch((falha) => {
          if (!controle.signal.aborted)
            definirErro(
              falha instanceof Error
                ? falha.message
                : "Não foi possível consultar as empresas.",
            );
        })
        .finally(() => {
          if (!controle.signal.aborted) definirCarregando(false);
        });
    }, 200);
    return () => {
      controle.abort();
      clearTimeout(temporizador);
    };
  }, [consultar, busca, pagina, tentativa]);
  return (
    <div className="space-y-2">
      <label htmlFor={`${identificador}-busca`} className="text-sm">
        Buscar {rotulo.toLowerCase()}
      </label>
      <input
        id={`${identificador}-busca`}
        className={classeCampo}
        value={busca}
        onChange={(evento) => {
          definirBusca(evento.target.value);
          definirPagina(1);
        }}
      />
      <label htmlFor={identificador} className="block text-sm font-medium">
        {rotulo}
      </label>
      <select
        id={identificador}
        className={classeCampo}
        value={valor}
        required={obrigatorio}
        aria-invalid={Boolean(erroCampo)}
        aria-describedby={erroCampo ? `${identificador}-erro` : undefined}
        disabled={carregando || Boolean(erro)}
        onChange={(evento) => aoAlterar(evento.target.value, nomes[evento.target.value])}
      >
        <option value="">{obrigatorio ? "Selecione uma empresa cadastrada" : "Todas as transportadoras"}</option>
        {valor &&
          !dados?.resultados.some(
            (empresa) => String(empresa.id) === valor,
          ) && <option value={valor}>{nomes[valor] ?? "Empresa selecionada — atualize a consulta para conferir"}</option>}
        {dados?.resultados.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.razao_social}
          </option>
        ))}
      </select>
      {erroCampo && <p id={`${identificador}-erro`} className="text-sm text-destructive">{erroCampo}</p>}
      {!carregando && !erro && dados?.resultados.length === 0 && <p role="status" className="text-sm text-muted-foreground">Nenhuma empresa encontrada nesta consulta.</p>}
      {carregando && (
        <p role="status" className="text-xs">
          Consultando empresas…
        </p>
      )}
      {erro && (
        <div role="alert">
          {erro}{" "}
          <Button
            type="button"
            variant="outline"
            onClick={() => definirTentativa((anterior) => anterior + 1)}
          >
            Tentar consulta novamente
          </Button>
        </div>
      )}
      <PaginacaoAuditoria
        dados={dados?.paginacao}
        aoMudar={definirPagina}
        desabilitada={carregando}
      />
    </div>
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
      <DialogContent className={`flex max-h-[90dvh] flex-col overflow-hidden rounded-[30px] ${amplo ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
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
