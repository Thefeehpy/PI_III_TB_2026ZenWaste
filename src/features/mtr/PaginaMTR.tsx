import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EstadoConsulta } from "@/components/EstadoConsulta";
import { SeletorResiduo } from "./SeletorResiduo";
import { PainelMTROperacional } from "./PainelMTROperacional";
import { lerIntencao, lerRascunho, novaChaveMTR, resultadoIncerto, servicoMTR as api, type CampoMTR, type CatalogosMTR, type DadosAmbientais, type IntencaoMTR, type OperacaoMTR, type RascunhoMTR } from "./servico";

const etapas = ["Operação", "Pré-preenchimento", "Dados ambientais", "Revisão e simulação"];
const situacoes: Record<string, string> = { PREPARADA: "Intenção persistida; aguardando execução MOCK", CONFIRMADA_SIMULADA: "Confirmação apenas simulada", REJEITADA_SIMULADA: "Rejeição SIGOR simulada", INDETERMINADA: "Resultado indeterminado — novo envio bloqueado", EM_ENVIO: "Envio simulado em andamento" };
const nomes: Record<string, string> = { gerador_cnpj: "CNPJ da vendedora / geradora presumida", gerador_unidade: "Unidade geradora (MOCK)", transportador_cnpj: "CPF/CNPJ da transportadora", transportador_unidade: "Unidade transportadora (MOCK)", destinador_cnpj: "CPF/CNPJ do destinador · seleção independente da compradora", destinador_unidade: "Unidade destinadora (MOCK)", marQuantidade: "Quantidade expedida · confirme a medição", dataExpedicao: "Expedição ISO com fuso (opcional neste MOCK)", nomeMotorista: "Motorista (opcional)", placaVeiculo: "Placa sem hífen (opcional)", observacoes: "Observações ambientais (opcional)" };
Object.assign(nomes, { uniCodigo: "Unidade de medida (MOCK)", traCodigo: "Tratamento (MOCK)", tieCodigo: "Estado físico (MOCK)", tiaCodigo: "Acondicionamento (MOCK)", claCodigo: "Classe (MOCK)", resCodigoIbama: "Código do resíduo", origem_codigo: "Procedência do código selecionado" });

export default function PaginaMTR() {
  const { user, sessionVersion } = useAuth();
  return <EntradaMTR key={`${user?.id}:${sessionVersion}`} empresaId={user?.id || ""} />;
}

function EntradaMTR({ empresaId }: { empresaId: string }) {
  const [legado, setLegado] = useState(false);
  return legado ? <><div className="px-4 pt-4"><Button variant="outline" onClick={() => setLegado(false)}>Voltar aos manifestos de homologação</Button></div><JornadaMTR /></> : <PainelMTROperacional empresaId={empresaId} abrirLegado={() => setLegado(true)} />;
}

export function JornadaMTR() {
  const [etapa, mudarEtapa] = useState(0); const titulo = useRef<HTMLHeadingElement>(null);
  const [operacoes, setOperacoes] = useState<OperacaoMTR[]>([]); const [pagina, setPagina] = useState(1); const [totalPaginas, setTotalPaginas] = useState(1);
  const [busca, setBusca] = useState(""); const [selecionada, selecionar] = useState("");
  const [campos, setCampos] = useState<CampoMTR[]>([]); const [cat, setCat] = useState<CatalogosMTR | null>(null);
  const [buscaCodigo, setBuscaCodigo] = useState(""); const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoMTR | null>(null); const [dados, setDados] = useState<DadosAmbientais>({});
  const [pendencias, setPendencias] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState(""); const [retry, setRetry] = useState(0);
  const [usuario, setUsuario] = useState(""); const [senha, setSenha] = useState(""); const [pessoa, setPessoa] = useState<{ token: string; nome: string } | null>(null);
  const [confirmou, confirmar] = useState(false); const [cenario, setCenario] = useState("sucesso");
  const [pendente, setPendente] = useState<{ chave: string; receber: (v: unknown) => void } | null>(null);
  const bloqueado = busy || loading || !!pendente;
  const falha = (e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
  const receber = (r: RascunhoMTR) => { setRascunho(r); setDados(r.dados); confirmar(false); setPendencias({}); };
  const receberIntencao = (i: IntencaoMTR) => { setRascunho(r => r ? { ...r, intencao: i, estado: i.estado } : r); };

  useEffect(() => { titulo.current?.focus(); }, [etapa]);
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setErro(null);
    void Promise.all([api.contexto(c.signal), api.operacoes(pagina, busca, c.signal)])
      .then(([, r]) => { if (!c.signal.aborted) { setOperacoes(r.resultados); setTotalPaginas(r.paginacao.total_paginas); } })
      .catch(e => { if (!c.signal.aborted) falha(e); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [pagina, busca, retry]);
  useEffect(() => {
    if (!selecionada) return;
    const c = new AbortController(); setLoading(true); setErro(null); setCampos([]); setRascunho(null); setDados({}); confirmar(false);
    void Promise.all([api.preenchimento(selecionada, c.signal), api.existentes(selecionada, c.signal)])
      .then(([p, r]) => { if (!c.signal.aborted) { setCampos(p); if (r[0]) receber(r[0]); } })
      .catch(e => { if (!c.signal.aborted) falha(e); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [selecionada, retry]);
  useEffect(() => {
    const c = new AbortController(); setBuscandoCodigo(true);
    const t = setTimeout(() => { void api.catalogos(buscaCodigo, c.signal).then(r => { if (!c.signal.aborted) setCat(r); })
      .catch(e => { if (!c.signal.aborted) { setCat(null); falha(e); } }).finally(() => { if (!c.signal.aborted) setBuscandoCodigo(false); }); }, 200);
    return () => { c.abort(); clearTimeout(t); };
  }, [buscaCodigo, retry]);

  async function acao<T>(enviar: (chave: string) => Promise<T>, normalizar: (v: unknown) => T, sucesso: (v: T) => void) {
    if (bloqueado) return;
    setBusy(true); setErro(null); setAviso(""); let chave = "";
    try { chave = novaChaveMTR(); sucesso(await enviar(chave)); setAviso("Operação local registrada. Emissão real permanece bloqueada."); }
    catch (e) {
      if (chave && resultadoIncerto(e)) { setPendente({ chave, receber: v => sucesso(normalizar(v)) }); setErro("Resultado ainda não confirmado. Consulte o comando original antes de tentar outra operação."); }
      else falha(e);
    } finally { setBusy(false); }
  }
  async function recuperar() {
    if (!pendente || busy) return;
    setBusy(true);
    try { pendente.receber(await api.recibo(pendente.chave)); setPendente(null); setErro(null); setAviso("Resposta positiva recuperada do registro do servidor."); }
    catch { setErro("Comando ainda não confirmado. A ausência de recibo não libera uma nova emissão. Preserve a referência e consulte novamente."); }
    finally { setBusy(false); }
  }
  async function identificar() {
    setBusy(true); setErro(null);
    try { setPessoa(await api.sessao(usuario, senha)); setAviso("Pessoa identificada no ZenWaste. Isso não comprova habilitação SIGOR."); }
    catch (e) { setPessoa(null); falha(e); } finally { setSenha(""); setBusy(false); }
  }
  async function validar() {
    if (!rascunho) return; setBusy(true); setErro(null);
    try { const v = await api.validar(rascunho.id); setPendencias(v.pendencias); setAviso(v.valido_para_mock ? "Dados salvos aptos apenas à revisão MOCK." : "Há pendências nos dados salvos. Corrija e salve antes de revisar."); }
    catch (e) { falha(e); } finally { setBusy(false); }
  }
  function exemplo() {
    const gerador = campos.find(c => c.campo === "cnpj_vendedora")?.valor;
    const transportador = campos.find(c => c.campo === "cnpj_transportadora")?.valor;
    setDados(d => ({ ...d, gerador_cnpj: String(gerador || ""), gerador_unidade: "99001", transportador_cnpj: String(transportador || "00000000000000"), transportador_unidade: "99002", destinador_cnpj: "00000000000000", destinador_unidade: "99003", resCodigoIbama: "000001", origem_codigo: "fixture_fase1a", uniCodigo: "9001", traCodigo: "9002", tieCodigo: "9003", tiaCodigo: "9004", claCodigo: "9005" }));
    setAviso("Exemplo inteiramente fictício aplicado ao formulário. Revise a quantidade e salve. Não é cadastro SIGOR.");
  }
  function input(campo: string) {
    return <div key={campo}><label htmlFor={`mtr-${campo}`} className="mb-1 block text-sm font-medium">{nomes[campo]}</label>
      <Input id={`mtr-${campo}`} value={String(dados[campo] ?? "")} onChange={e => { setDados(d => ({ ...d, [campo]: e.target.value })); confirmar(false); }} aria-invalid={!!pendencias[campo]} aria-describedby={pendencias[campo] ? `erro-${campo}` : undefined} />
      {pendencias[campo] && <p id={`erro-${campo}`} className="mt-1 text-xs text-destructive">{pendencias[campo]}</p>}</div>;
  }
  const intencao = rascunho?.intencao;
  const editavel = !intencao;
  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Preparação ambiental</p><h1 ref={titulo} tabIndex={-1} className="mt-2 text-2xl font-semibold outline-none">MTR inteligente</h1>
      <p className="mt-2 text-sm text-muted-foreground">Reutilize dados, confira a procedência e revise as informações ambientais.</p></header>
    <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm" role="note"><strong>Ambiente MOCK · sem emissão governamental.</strong> A autenticação e os catálogos reais não habilitam a emissão. Resultados desta jornada são exclusivamente simulados.</div>
    <nav aria-label="Etapas do MTR" className="grid grid-cols-2 gap-2 md:grid-cols-4">{etapas.map((e, i) => <Button key={e} variant={i === etapa ? "default" : "outline"} disabled={bloqueado || (i > 0 && !campos.length)} aria-current={i === etapa ? "step" : undefined} onClick={() => mudarEtapa(i)}>{i + 1}. {e}</Button>)}</nav>
    <EstadoConsulta carregando={loading} erro={erro} tentarNovamente={() => setRetry(v => v + 1)} />
    {aviso && <p role="status" className="rounded-xl bg-accent p-3 text-sm">{aviso}</p>}
    {pendente && <div className="rounded-xl border border-destructive p-4 text-sm"><p>Comando pendente: <code className="break-all">{pendente.chave}</code></p><Button disabled={busy} className="mt-2" variant="outline" onClick={() => void recuperar()}>Consultar comando original</Button></div>}
    {etapa === 0 && <Card><CardHeader><CardTitle>Selecione uma operação existente</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="block text-sm">Buscar referência do frete<Input value={busca} disabled={bloqueado} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>
      <div className="grid gap-3 md:grid-cols-2">{operacoes.map(o => <label key={o.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${selecionada === o.id ? "border-primary bg-accent" : ""}`}><input type="radio" name="operacao-mtr" disabled={bloqueado} checked={selecionada === o.id} onChange={() => selecionar(o.id)} /><span className="min-w-0"><strong className="block break-words">{o.referencia}</strong><span className="block text-sm">{o.material} · {o.quantidade} {o.unidade}</span><small className="text-muted-foreground">{o.origem_cadastro} · {o.situacao}</small></span></label>)}</div>
      {!loading && !operacoes.length && <p>Nenhum frete autorizado disponível nesta empresa.</p>}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={bloqueado || pagina === 1} onClick={() => setPagina(v => v - 1)}>Página anterior</Button><span className="text-sm">{pagina} / {totalPaginas}</span><Button variant="outline" disabled={bloqueado || pagina >= totalPaginas} onClick={() => setPagina(v => v + 1)}>Próxima página</Button></div>
    </CardContent></Card>}
    {etapa === 1 && <Card><CardHeader><CardTitle>Dados reutilizados e sua origem</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Vendedora é geradora presumida não validada. Compradora não é inferida como destinadora. Quantidade da remessa não comprova pesagem.</p>
      <div className="grid gap-3 md:grid-cols-2">{campos.map(c => <article key={c.campo} className="min-w-0 rounded-xl border p-3"><h2 className="text-sm font-semibold">{c.campo.replace(/_/g, " ")}</h2><p className="mt-1 break-words text-sm">{c.valor === null ? "Informação não disponível / não inferir" : c.valor}</p><p className="mt-1 break-words text-xs text-muted-foreground">{c.fonte || "Sem fonte ambiental validada"} · {c.identificador_origem || "sem vínculo"}</p>{c.pendencias.map(p => <p key={p.codigo} className="mt-1 text-xs text-muted-foreground">{p.mensagem}</p>)}</article>)}</div>
      {!rascunho && <Button disabled={bloqueado} onClick={() => void acao(k => api.criar(selecionada, k), lerRascunho, receber)}>Criar rascunho com os dados disponíveis</Button>}
      {rascunho && <p className="text-sm">Rascunho persistido · versão {rascunho.versao} · {rascunho.estado}</p>}
    </CardContent></Card>}
    {etapa === 2 && <Card><CardHeader><CardTitle>Complemente os dados ambientais</CardTitle></CardHeader><CardContent className="space-y-5">
      {!rascunho ? <p>Crie o rascunho na etapa de pré-preenchimento para continuar.</p> : <>
        <p className="text-sm text-muted-foreground">{cat ? `${cat.referencia_operador.registros} códigos de referência fornecidos pelo operador, separados das fixtures fictícias. Presença no catálogo não aprova classificação.` : "Carregando catálogos…"}</p>
        <fieldset disabled={bloqueado || !editavel} className="space-y-5">
          <Button type="button" variant="outline" onClick={exemplo}>Usar exemplo fictício para MOCK</Button>
          <div className="grid gap-4 md:grid-cols-2">{["gerador_cnpj", "gerador_unidade", "transportador_cnpj", "transportador_unidade", "destinador_cnpj", "destinador_unidade"].map(input)}</div>
          <SeletorResiduo valor={String(dados.resCodigoIbama || "")} itens={cat?.residuos || []} carregando={buscandoCodigo} buscar={setBuscaCodigo} selecionar={r => { setDados(d => ({ ...d, resCodigoIbama: String(r.codigo), origem_codigo: r.origem || "" })); confirmar(false); }} />
          {pendencias.resCodigoIbama && <p role="alert" className="text-sm text-destructive">{pendencias.resCodigoIbama}</p>}
          <div className="grid gap-4 md:grid-cols-2">{input("marQuantidade")}{([
            ["uniCodigo", "unidades", "Unidade de medida SIGOR (MOCK)"], ["traCodigo", "tratamentos", "Tratamento (MOCK)"], ["tieCodigo", "estados", "Estado físico (MOCK)"], ["tiaCodigo", "acondicionamentos", "Acondicionamento (MOCK)"], ["claCodigo", "classes", "Classe (MOCK)"],
          ] as const).map(([campo, tipo, nome]) => <label key={campo} className="block text-sm font-medium">{nome}<select className="mt-1 min-h-10 w-full rounded-lg border bg-background p-2" value={String(dados[campo] ?? "")} onChange={e => { setDados(d => ({ ...d, [campo]: e.target.value })); confirmar(false); }}><option value="">Selecione</option>{cat?.[tipo].map(r => <option key={r.codigo} value={r.codigo}>{r.descricao}</option>)}</select>{pendencias[campo] && <span className="block text-xs text-destructive">{pendencias[campo]}</span>}</label>)}</div>
          <details><summary className="cursor-pointer text-sm font-medium">Dados opcionais de expedição</summary><div className="mt-3 grid gap-4 md:grid-cols-2">{["dataExpedicao", "nomeMotorista", "placaVeiculo", "observacoes"].map(input)}</div></details>
          <Button onClick={() => void acao(k => api.salvar(rascunho, dados, k), lerRascunho, receber)}>Salvar dados do rascunho</Button>
        </fieldset>
        <Button variant="outline" disabled={bloqueado} onClick={() => void validar()}>Validar dados salvos</Button>
        {Object.keys(pendencias).length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">{Object.entries(pendencias).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>}
      </>}
    </CardContent></Card>}
    {etapa === 3 && <div className="space-y-4">
      <Card><CardHeader><CardTitle>Identificação individual no ZenWaste</CardTitle></CardHeader><CardContent>
        <p className="mb-3 text-sm text-muted-foreground">O login da empresa não identifica a pessoa. Use um usuário individual vinculado à geradora. Não informe CPF/senha SIGOR.</p>
        {pessoa ? <p role="status">Responsável: <strong>{pessoa.nome}</strong> · identidade local; habilitação SIGOR não comprovada.</p> : <form onSubmit={e => { e.preventDefault(); void identificar(); }} className="grid gap-3 md:grid-cols-3"><label className="text-sm">Usuário individual<Input value={usuario} autoComplete="username" onChange={e => setUsuario(e.target.value)} disabled={bloqueado} /></label><label className="text-sm">Senha individual ZenWaste<Input type="password" value={senha} autoComplete="current-password" onChange={e => setSenha(e.target.value)} disabled={bloqueado} /></label><Button className="self-end" disabled={bloqueado || !usuario || !senha}>Identificar responsável</Button></form>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Revisão e autorização exclusivamente MOCK</CardTitle></CardHeader><CardContent className="space-y-4">
        {!rascunho ? <p>Prepare e salve o rascunho antes de revisar.</p> : <>
          <dl className="grid gap-2 text-sm md:grid-cols-2">{Object.entries(rascunho.dados).map(([k, v]) => <div key={k} className="min-w-0 rounded-lg border p-2"><dt className="text-muted-foreground">{nomes[k] || k}</dt><dd className="break-words font-medium">{String(v ?? "Não informado")}</dd></div>)}</dl>
          <p className="text-sm">Snapshot da revisão: {rascunho.revisao ? `${rascunho.revisao.operador.nome} · ${rascunho.revisao.resumo.slice(0, 16)}…` : "Ainda não aprovado"}</p>
          {!intencao && <>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmou} disabled={bloqueado} onChange={e => confirmar(e.target.checked)} className="mt-1" /><span>Revisei participantes, quantidade e classificação para esta simulação. Estou ciente de que os dados não habilitam emissão oficial e não haverá chamada à CETESB.</span></label>
            <div className="flex flex-wrap gap-3"><Button disabled={bloqueado || !pessoa || !confirmou} onClick={() => pessoa && void acao(k => api.revisar(rascunho, k, pessoa.token), lerRascunho, receber)}>Registrar revisão MOCK</Button>
              <label className="text-sm">Cenário simulado<select className="ml-2 rounded-lg border bg-background p-2" value={cenario} disabled={bloqueado} onChange={e => setCenario(e.target.value)}><option value="sucesso">Sucesso MOCK</option><option value="rejeicao">Rejeição simulada</option><option value="timeout">Timeout / indeterminado</option></select></label>
              <Button variant="outline" disabled={bloqueado || !pessoa || rascunho.estado !== "APROVADO"} onClick={() => pessoa && void acao(k => api.preparar(rascunho, cenario, k, pessoa.token), lerRascunho, receber)}>Autorizar intenção MOCK</Button></div>
          </>}
          {intencao && <section aria-label="Resultado da emissão" className="space-y-3 rounded-xl border border-primary/30 bg-accent p-4"><h2 className="font-semibold">{situacoes[intencao.estado] || intencao.estado}</h2><p className="break-all text-sm">Referência própria: {intencao.referencia}</p><p className="text-sm">Sem número oficial · {intencao.quantidade_envios} envio(s) simulado(s). Nenhuma emissão governamental.</p>
            {intencao.estado === "PREPARADA" && <Button disabled={bloqueado || !pessoa} onClick={() => pessoa && void acao(k => api.enviar(intencao, k, pessoa.token), lerIntencao, receberIntencao)}>Executar emissão MOCK autorizada</Button>}
            <Button variant="outline" disabled={bloqueado || !pessoa} onClick={() => pessoa && void acao(k => api.consultar(intencao, k, pessoa.token), lerIntencao, receberIntencao)}>Consultar intenção persistida</Button>
            {intencao.estado === "INDETERMINADA" && <p role="alert" className="text-sm">A consulta não presume sucesso nem libera reenvio. É necessário reconciliar o resultado original; não criar outra intenção.</p>}
          </section>}
          <details><summary className="cursor-pointer text-sm">Histórico registrado ({rascunho.eventos.length})</summary><ul className="mt-2 space-y-1 text-xs">{rascunho.eventos.map(e => <li key={e.id}>{e.criado_em} · {e.acao}</li>)}</ul><Button variant="outline" disabled={bloqueado} onClick={() => { setBusy(true); void api.rascunho(rascunho.id).then(receber).catch(falha).finally(() => setBusy(false)); }}>Atualizar histórico</Button></details>
        </>}
      </CardContent></Card>
    </div>}
    <footer className="flex justify-between gap-3 border-t pt-4"><Button variant="outline" disabled={bloqueado || etapa === 0} onClick={() => mudarEtapa(v => v - 1)}>Voltar</Button><Button disabled={bloqueado || !campos.length || etapa === 3} onClick={() => mudarEtapa(v => v + 1)}>Continuar</Button></footer>
  </div>;
}
