import { useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ItemCatalogo } from "./servico";

export function SeletorResiduo({ valor, itens, carregando, buscar, selecionar }: {
  valor: string; itens: ItemCatalogo[]; carregando: boolean; buscar: (busca: string) => void; selecionar: (item: ItemCatalogo) => void;
}) {
  const id = useId(); const root = useRef<HTMLDivElement>(null);
  const [aberto, abrir] = useState(false); const [busca, definirBusca] = useState(""); const [ativo, definirAtivo] = useState(-1);
  const escolher = (item: ItemCatalogo) => { selecionar(item); abrir(false); };
  return <div ref={root} className="relative" onBlur={e => { if (!root.current?.contains(e.relatedTarget)) abrir(false); }}>
    <label htmlFor={id} className="text-sm font-medium">Código do resíduo · pesquisa por código ou descrição</label>
    <Input id={id} role="combobox" aria-expanded={aberto} aria-autocomplete="list" aria-controls={`${id}-lista`}
      aria-activedescendant={aberto && itens[ativo] ? `${id}-opcao-${ativo}` : undefined}
      value={aberto ? busca : valor} onFocus={() => { abrir(true); definirAtivo(-1); buscar(busca); }}
      onChange={e => { definirBusca(e.target.value); definirAtivo(-1); abrir(true); buscar(e.target.value); }}
      onKeyDown={e => {
        if (e.key === "Escape") { abrir(false); return; }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); abrir(true); definirAtivo(a => Math.max(0, Math.min(itens.length - 1, a + (e.key === "ArrowDown" ? 1 : -1)))); }
        if (e.key === "Enter" && aberto) { e.preventDefault(); if (itens[ativo] && !carregando) escolher(itens[ativo]); }
      }} />
    {aberto && <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
      <p role="status" className="px-2 py-1 text-xs text-muted-foreground">{carregando ? "Pesquisando referências…" : itens.length ? "Selecione um resultado. Presença no catálogo não aprova classificação." : "Nenhum código encontrado."}</p>
      <ul id={`${id}-lista`} role="listbox" aria-label="Resíduos encontrados">{!carregando && itens.map((r, i) => <li key={`${r.origem}:${r.codigo}`}>
        <button type="button" role="option" aria-selected={String(r.codigo) === valor} id={`${id}-opcao-${i}`} tabIndex={-1}
          onMouseDown={e => e.preventDefault()} onClick={() => escolher(r)} className={`w-full rounded-lg p-2 text-left text-sm ${i === ativo ? "bg-accent" : "hover:bg-accent/60"}`}>
          <strong>{r.codigo}</strong> <span>{r.descricao}</span><small className="block text-muted-foreground">{r.origem === "fixture_fase1a" ? "Fixture fictícia da Fase 1A" : "Referência de homologação fornecida pelo operador"}</small>
        </button>
      </li>)}</ul>
    </div>}
  </div>;
}
