import { useEffect, useId, useState, type ReactNode } from "react";
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
      className="mt-4 flex items-center justify-between gap-3 text-sm"
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
}: {
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
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
  useEffect(() => {
    const controle = new AbortController();
    definirCarregando(true);
    const temporizador = setTimeout(() => {
      consultar(busca, controle.signal, pagina)
        .then((resposta) => {
          if (!controle.signal.aborted) {
            definirDados(resposta);
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
        required
        disabled={carregando || Boolean(erro)}
        onChange={(evento) => aoAlterar(evento.target.value)}
      >
        <option value="">Selecione uma empresa cadastrada</option>
        {valor &&
          !dados?.resultados.some(
            (empresa) => String(empresa.id) === valor,
          ) && <option value={valor}>Empresa selecionada (ID {valor})</option>}
        {dados?.resultados.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.razao_social}
          </option>
        ))}
      </select>
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
}: {
  aberto: boolean;
  aoAbrir: (aberto: boolean) => void;
  titulo: string;
  descricao: string;
  executando: boolean;
  erro: string | null;
  aoConfirmar: () => Promise<unknown>;
  filhos: ReactNode;
}) {
  return (
    <Dialog
      open={aberto}
      onOpenChange={(valor) => {
        if (!executando) aoAbrir(valor);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[30px] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void aoConfirmar();
          }}
        >
          <fieldset disabled={executando} className="space-y-4">
            {filhos}
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <Button type="submit" className="w-full rounded-2xl">
              {executando ? "Salvando…" : "Confirmar"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
