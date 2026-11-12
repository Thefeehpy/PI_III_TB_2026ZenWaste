import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmpresaFreteDTO, ListaEmpresasFreteDTO } from "../tipos-api";

interface Props {
  rotulo: string;
  obrigatorio?: boolean;
  erroCampo?: string;
  valor: string;
  nomeSelecionado?: string;
  aoAlterar: (valor: string, nome?: string) => void;
  consultar: (busca?: string, sinal?: AbortSignal, pagina?: number) => Promise<ListaEmpresasFreteDTO>;
}

export function SeletorEmpresaFrete(props: Props) {
  const [contexto, definirContexto] = useState({ consultar: props.consultar, versao: 0 });
  // A consulta é vinculada à sessão pelo hook existente. Uma nova fonte não
  // pode reutilizar nomes, páginas ou respostas do contexto empresarial anterior.
  if (contexto.consultar !== props.consultar) {
    definirContexto({ consultar: props.consultar, versao: contexto.versao + 1 });
  }
  return <ComboboxEmpresaFrete key={contexto.versao} {...props} />;
}

function ComboboxEmpresaFrete({
  rotulo, valor, nomeSelecionado, aoAlterar, consultar, obrigatorio = true, erroCampo,
}: Props) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const acaoConsulta = useRef<HTMLButtonElement>(null);
  const devolverFocoConsulta = useRef(false);
  const sequencia = useRef(0);
  const [aberto, definirAberto] = useState(false);
  const [editando, definirEditando] = useState(false);
  const [busca, definirBusca] = useState("");
  const [pagina, definirPagina] = useState(1);
  const [tentativa, definirTentativa] = useState(0);
  const [dados, definirDados] = useState<(ListaEmpresasFreteDTO & { busca: string }) | null>(null);
  const [nomes, definirNomes] = useState<Record<string, string>>({});
  const [erro, definirErro] = useState<string | null>(null);
  const [carregando, definirCarregando] = useState(false);
  const [ativo, definirAtivo] = useState<string | null>(null);
  const resultados = dados?.busca === busca ? dados.resultados : [];
  const paginacao = dados?.busca === busca ? dados.paginacao : undefined;
  const nome = valor ? nomeSelecionado || nomes[valor] || "Empresa selecionada — confira o nome" : "";
  const opcaoAtiva = resultados.find(empresa => String(empresa.id) === ativo);
  const idAtivo = aberto && opcaoAtiva ? `${id}-opcao-${opcaoAtiva.id}` : undefined;

  useEffect(() => {
    entrada.current?.setCustomValidity(obrigatorio && !valor ? "Selecione uma empresa cadastrada na lista." : "");
  }, [obrigatorio, valor]);

  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController();
    const numero = ++sequencia.current;
    const atual = () => !controle.signal.aborted && numero === sequencia.current;
    definirCarregando(true);
    definirErro(null);
    const temporizador = setTimeout(() => {
      void Promise.resolve().then(() => consultar(busca, controle.signal, pagina))
        .then(resposta => {
          if (!atual()) return;
          devolverFocoConsulta.current = document.activeElement === acaoConsulta.current;
          definirDados(anteriores => {
            const anterioresDaBusca = pagina > 1 && anteriores?.busca === busca ? anteriores.resultados : [];
            const empresas = new Map<string, EmpresaFreteDTO>();
            for (const empresa of [...anterioresDaBusca, ...resposta.resultados]) {
              empresas.set(String(empresa.id), empresa);
            }
            return { ...resposta, busca, resultados: [...empresas.values()] };
          });
          definirNomes(anteriores => ({
            ...anteriores,
            ...Object.fromEntries(resposta.resultados.map(empresa => [String(empresa.id), empresa.razao_social])),
          }));
        })
        .catch(falha => {
          if (atual()) {
            devolverFocoConsulta.current = document.activeElement === acaoConsulta.current;
            definirErro(falha instanceof Error ? falha.message : "Não foi possível consultar as empresas.");
          }
        })
        .finally(() => { if (atual()) definirCarregando(false); });
    }, pagina === 1 ? 200 : 0);
    return () => {
      controle.abort();
      clearTimeout(temporizador);
    };
  }, [aberto, busca, consultar, pagina, tentativa]);

  useEffect(() => {
    if (idAtivo) document.getElementById(idAtivo)?.scrollIntoView?.({ block: "nearest" });
  }, [idAtivo]);

  useEffect(() => {
    if (!carregando && devolverFocoConsulta.current) {
      devolverFocoConsulta.current = false;
      (acaoConsulta.current ?? entrada.current)?.focus();
    }
  }, [carregando, dados, erro]);

  function fechar() {
    definirAberto(false);
    definirEditando(false);
    definirBusca("");
    definirPagina(1);
    definirAtivo(null);
    definirErro(null);
  }

  function selecionar(empresa: EmpresaFreteDTO) {
    aoAlterar(String(empresa.id), empresa.razao_social);
    entrada.current?.focus();
    fechar();
  }

  function limpar() {
    aoAlterar("", "");
    definirBusca("");
    definirPagina(1);
    definirAtivo(null);
    definirEditando(false);
    entrada.current?.focus();
    definirAberto(true);
  }

  return (
    <div data-seletor-empresa-frete="" className="min-w-0 space-y-2"
      onBlur={evento => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) fechar();
      }}
      onKeyDownCapture={evento => {
        if (evento.key === "Escape" && aberto) {
          evento.preventDefault();
          evento.stopPropagation();
          entrada.current?.focus();
          fechar();
        }
      }}>
      <label htmlFor={id} className="block text-sm font-medium">
        {rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        <Input ref={entrada} id={id} role="combobox" type="text" autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-2xl text-sm"
          value={editando ? busca : nome}
          placeholder={obrigatorio ? "Pesquise pelo nome da empresa" : "Todas as transportadoras"}
          required={obrigatorio} aria-required={obrigatorio}
          aria-autocomplete="list" aria-expanded={aberto}
          aria-controls={aberto ? `${id}-lista` : undefined}
          aria-activedescendant={idAtivo}
          aria-invalid={Boolean(erroCampo)}
          aria-describedby={[`${id}-ajuda`, valor ? `${id}-selecionada` : "", erroCampo ? `${id}-erro` : ""].filter(Boolean).join(" ")}
          onFocus={() => definirAberto(true)}
          onClick={() => definirAberto(true)}
          onChange={evento => {
            definirBusca(evento.target.value);
            definirEditando(true);
            definirPagina(1);
            definirAtivo(null);
            definirAberto(true);
          }}
          onKeyDown={evento => {
            if (evento.nativeEvent.isComposing) return;
            if (evento.key === "Enter") {
              evento.preventDefault();
              if (aberto && opcaoAtiva) selecionar(opcaoAtiva);
            } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
              evento.preventDefault();
              definirAberto(true);
              const indice = resultados.findIndex(empresa => String(empresa.id) === ativo);
              const proximo = evento.key === "ArrowDown" ? Math.min(indice + 1, resultados.length - 1)
                : indice < 0 ? resultados.length - 1 : Math.max(indice - 1, 0);
              definirAtivo(resultados[proximo] ? String(resultados[proximo].id) : null);
            } else if (aberto && (evento.key === "Home" || evento.key === "End") && !evento.ctrlKey && !evento.metaKey) {
              evento.preventDefault();
              const empresa = evento.key === "Home" ? resultados[0] : resultados[resultados.length - 1];
              definirAtivo(empresa ? String(empresa.id) : null);
            }
          }} />
        <Button type="button" variant="outline" className="h-11 shrink-0 rounded-2xl"
          aria-label={`Limpar ${rotulo.toLowerCase()}`} onClick={limpar}>Limpar</Button>
      </div>
      <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
        Pesquise pelo nome e selecione um resultado. Use as setas e Enter, ou toque na empresa.
      </p>
      {valor && <p id={`${id}-selecionada`} className="break-words text-xs text-muted-foreground">
        Selecionada: {nome} · ID {valor}
      </p>}
      {erroCampo && <p id={`${id}-erro`} className="text-sm text-destructive">{erroCampo}</p>}
      {aberto && <div className="min-w-0 space-y-2 rounded-2xl border border-input bg-background p-2">
        <ul id={`${id}-lista`} role="listbox" aria-label={`Resultados de ${rotulo.toLowerCase()}`}
          aria-busy={carregando} className="max-h-52 overflow-y-auto overscroll-contain">
          {resultados.map(empresa => <li key={empresa.id} id={`${id}-opcao-${empresa.id}`} role="option"
            aria-selected={String(empresa.id) === valor}
            className={`min-h-11 cursor-pointer break-words rounded-xl px-3 py-2 text-sm hover:bg-accent ${String(empresa.id) === ativo ? "bg-accent text-accent-foreground" : ""}`}
            onMouseDown={evento => evento.preventDefault()}
            onClick={() => selecionar(empresa)}>
            <span className="block">{empresa.razao_social}</span>
            <span className="block text-xs text-muted-foreground">ID {empresa.id}</span>
          </li>)}
        </ul>
        <p role="status" className="text-xs text-muted-foreground">
          {carregando ? "Consultando empresas…" : erro ? "Consulta não concluída. A seleção foi mantida."
            : resultados.length ? `${resultados.length} resultado(s) carregado(s).`
              : "Nenhuma empresa encontrada nesta consulta."}
        </p>
        {erro && <p role="alert" className="break-words text-sm">{erro}</p>}
        {(erro || carregando || paginacao && paginacao.pagina < paginacao.total_paginas) && <Button
          ref={acaoConsulta} type="button" variant="outline"
          className="min-h-11 h-auto w-full whitespace-normal" aria-disabled={carregando}
          onClick={() => {
            if (carregando) return;
            if (erro) definirTentativa(anterior => anterior + 1);
            else if (paginacao) definirPagina(paginacao.pagina + 1);
          }}>
          {carregando ? "Carregando empresas…" : erro ? "Tentar consulta novamente" : "Carregar mais empresas"}
        </Button>}
      </div>}
    </div>
  );
}
