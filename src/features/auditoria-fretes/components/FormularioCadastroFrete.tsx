import type { ReactNode } from "react";
import type { CadastroFrete, ErrosFrete } from "../validacoes";
import type { ListaPedidosFreteDTO, PedidoDisponivelFreteDTO } from "../tipos-api";
import { CampoAuditoria } from "./CampoAuditoria";
import { classeCampo, PaginacaoAuditoria, SeletorEmpresaFrete } from "./ControlesAuditoriaIntegrada";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-border/80 p-4">
    <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">{titulo}</h3>{children}
  </section>;
}
export function FormularioCadastroFrete({ formulario: f, alterar, trocarTipo, selecionarPedido,
  pedidos, carregando, erroConsulta, aoRecarregar, aoPaginar, consultarCompradoras, erros,
}: {
  formulario: CadastroFrete; alterar: (valor: CadastroFrete) => void;
  trocarTipo: (tipo: CadastroFrete["tipo"]) => void;
  selecionarPedido: (pedido: PedidoDisponivelFreteDTO | null) => void;
  pedidos: ListaPedidosFreteDTO | null; carregando: boolean; erroConsulta: string | null;
  aoRecarregar: () => void; aoPaginar: (pagina: number) => void;
  consultarCompradoras: Parameters<typeof SeletorEmpresaFrete>[0]["consultar"];
  erros: ErrosFrete;
}) {
  const pedido = pedidos?.resultados.find(p => p.id === f.pedidoId) ?? f.pedido;
  const apresentarDecimal = (valor: string) => valor.replace(".", ",");
  const campo = (nome: keyof CadastroFrete, rotulo: string, extras: Partial<Parameters<typeof CampoAuditoria>[0]> = {}) =>
    <CampoAuditoria nome={nome} rotulo={rotulo} valor={String(f[nome] ?? "")} erro={erros[nome]}
      aoAlterar={valor => alterar({ ...f, [nome]: valor })} {...extras} />;
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">* Campos obrigatórios. Selecione também a compradora no frete avulso. A classificação será feita depois que o cadastro for confirmado.</p>
    <Secao titulo="1. Origem do cadastro">
      <label className="block space-y-2"><span className="text-sm font-medium">Tipo de cadastro</span>
        <select className={classeCampo} value={f.tipo} onChange={e => trocarTipo(e.target.value as CadastroFrete["tipo"])}>
          <option value="pedido">Vinculado a pedido</option><option value="avulso">Frete avulso</option>
        </select>
      </label>
      {f.tipo === "pedido" && <div className="space-y-3">
        <label className="block space-y-2"><span className="text-sm font-medium">Pedido *</span>
          <select className={classeCampo} required value={f.pedidoId} disabled={carregando}
            aria-invalid={Boolean(erros.pedidoId)} aria-describedby={erros.pedidoId ? "erro-pedido-frete" : undefined}
            onChange={e => selecionarPedido(pedidos?.resultados.find(p => p.id === e.target.value) ?? null)}>
            <option value="">Selecione um pedido disponível</option>
            {pedido && !pedidos?.resultados.some(p => p.id === pedido.id) && <option value={pedido.id}>{pedido.numero} — {pedido.material}</option>}
            {pedidos?.resultados.map(p => <option key={p.id} value={p.id}>{p.numero} — {p.material}</option>)}
          </select>
        </label>
        {erros.pedidoId && <p id="erro-pedido-frete" className="text-sm text-destructive">{erros.pedidoId}</p>}
        {carregando && <p role="status">Consultando pedidos…</p>}
        {erroConsulta && <p role="alert">{erroConsulta} <button type="button" className="underline" onClick={aoRecarregar}>Atualizar pedidos</button></p>}
        {!carregando && !erroConsulta && !pedidos?.resultados.length && <p role="status" className="text-sm">Nenhum pedido disponível nesta consulta. Pedidos cancelados, expirados ou sem saldo não são oferecidos pelo servidor.</p>}
        <PaginacaoAuditoria dados={pedidos?.paginacao} aoMudar={aoPaginar} desabilitada={carregando} />
      </div>}
    </Secao>
    <Secao titulo="2. Informações comerciais">
      {f.tipo === "pedido" ? pedido ? <div className="space-y-3">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[["Pedido", pedido.numero], ["Compradora", pedido.cliente], ["Material", pedido.material], ["Unidade", pedido.unidade],
            ["Quantidade negociada", `${apresentarDecimal(pedido.quantidade)} ${pedido.unidade}`], ["Restante para remessa", `${apresentarDecimal(pedido.quantidade_restante)} ${pedido.unidade}`]].map(([titulo, valor]) =>
            <div key={titulo} className="min-w-0"><dt className="text-muted-foreground">{titulo}</dt><dd className="break-words font-medium">{valor}</dd></div>)}
        </dl>
        <p className="text-xs text-muted-foreground">Dados comerciais do pedido, somente leitura. O restante consultado não representa estoque físico e será validado novamente pelo servidor.</p>
      </div> : <p className="text-sm text-muted-foreground">Selecione um pedido para consultar seus dados comerciais.</p> : <>
        <SeletorEmpresaFrete rotulo="Compradora" valor={f.compradoraId} nomeSelecionado={f.compradoraNome} erroCampo={erros.compradoraId} aoAlterar={(compradoraId, compradoraNome) => alterar({ ...f, compradoraId, compradoraNome })} consultar={consultarCompradoras} />
        {campo("material", "Material", { limite: 256 })}
        {campo("unidade", "Unidade", { limite: 12, instrucao: "Unidade comercial da carga. Não há conversão automática." })}
      </>}
    </Secao>
    <Secao titulo="3. Trajeto">
      {campo("origem", "Origem da coleta", { limite: 255, instrucao: "Confira o endereço operacional de coleta." })}
      {campo("destino", "Destino da entrega", { limite: 255, instrucao: "Informe o endereço operacional de entrega." })}
      {campo("previsaoEntrega", "Previsão de entrega", { tipo: "date", obrigatorio: false })}
    </Secao>
    <Secao titulo="4. Características da carga">
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("quantidade", `Quantidade da remessa${f.unidade ? ` (${f.unidade})` : ""}`, { formato: "medida", instrucao: `Mínimo 0,001; até 3 casas decimais. Use vírgula ou ponto, sem separador de milhar.${pedido && f.tipo === "pedido" ? ` Restante consultado: ${apresentarDecimal(pedido.quantidade_restante)} ${pedido.unidade}.` : ""}` })}
        {campo("pesoToneladas", "Peso (t)", { formato: "medida", instrucao: "Toneladas · mínimo 0; até 3 casas decimais." })}
        {campo("metrosCubicos", "Cubagem (m³)", { formato: "medida", instrucao: "Metros cúbicos · mínimo 0; até 3 casas decimais." })}
        {campo("quantidadeVolumes", "Volumes", { formato: "inteiro", instrucao: "Quantidade inteira de volumes · mínimo 0." })}
      </div>
    </Secao>
    <Secao titulo="5. Revise antes de cadastrar">
      <p className="text-sm break-words">{f.tipo === "pedido" ? `Pedido: ${pedido?.numero ?? "não selecionado"}` : "Frete avulso"} · {f.material || "Material a informar"} · {apresentarDecimal(f.quantidade) || "—"} {f.unidade}</p>
      <p className="text-sm break-words">Compradora: {f.tipo === "pedido" ? pedido?.cliente ?? "não selecionada" : f.compradoraNome || "não selecionada"}</p>
      <p className="break-words text-sm">{f.origem || "Origem a informar"} → {f.destino || "Destino a informar"}</p>
      <p className="text-sm">Peso: {apresentarDecimal(f.pesoToneladas) || "—"} t · Cubagem: {apresentarDecimal(f.metrosCubicos) || "—"} m³ · Volumes: {f.quantidadeVolumes || "—"}</p>
      <p className="text-sm">Previsão de entrega: {f.previsaoEntrega ? f.previsaoEntrega.split("-").reverse().join("/") : "não informada"}</p>
      <p className="text-xs text-muted-foreground">Resumo do preenchimento, ainda não confirmado. Após criar o frete, escolha a modalidade em uma operação separada.</p>
    </Secao>
  </div>;
}
