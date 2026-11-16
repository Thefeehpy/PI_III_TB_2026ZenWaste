import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeletorResiduo } from "./SeletorResiduo";
import { novaChaveMTR, resultadoIncerto, type DadosAmbientais, type ItemCatalogo } from "./servico";
import { operacionalMTR as api, lerManifestoOperacional, rotuloProcessamento, type ContextoOperacional, type ManifestoOperacional, type PreparacaoControlada } from "./operacional-api";

type Pendente = { chave: string; tipo: string; rascunhoId: string | null; despachoId?: string | null };
const tipos = [["uniCodigo", "Unidade de medida"], ["claCodigo", "Classe"], ["tieCodigo", "Estado físico"], ["tiaCodigo", "Acondicionamento"], ["traCodigo", "Tratamento"]] as const;
const confirma = ["Participantes e unidade conferidos", "Quantidade e medida conferidas", "Classificação ambiental revisada", "Tratamento compatível com a destinadora revisado", "Sem armazenador temporário e sem condicionais pendentes", "Ciência do ambiente de homologação e da natureza dos dados"];
const mascara = (cnpj: string) => cnpj.length === 14 ? `${cnpj.slice(0, 2)}.***.***/****-${cnpj.slice(-2)}` : "Documento empresarial não confirmado";
const motivos: Record<string,string> = {
  CADASTRO_PRIVADO_PENDENTE:"Cadastro de vínculo ainda não configurado no servidor.",
  CNPJ_COMPLETO_NAO_CONFIRMADO:"Confirmar o CNPJ completo de 14 dígitos na CETESB, sem completar zeros automaticamente.",
  EMPRESA_NAO_IDENTIFICADA:"Empresa correspondente ainda não identificada no ambiente isolado.",
  CNPJ_CADASTRAL_DIVERGENTE:"CNPJ empresarial não corresponde ao documento informado para a unidade.",
  PESSOA_INDIVIDUAL_NAO_IDENTIFICADA:"Identificar a pessoa física e seu usuário individual ZenWaste.",
  PERMISSOES_INDIVIDUAIS_NAO_VERIFICADAS:"Conferir permissões individuais e representação para homologação.",
  REPRESENTACAO_NAO_COMPROVADA:"Registrar evidência de poderes de representação.",
  REVISAO_AMBIENTAL_PENDENTE:"Confirmar classificação, tratamento e aptidão ambiental para esta nova operação.",
  REFERENCIA_CONTA_PENDENTE:"Preparar a referência privada da conta no servidor.",
  EXECUTOR_PENDENTE:"Identificar o executor do backend.",
};
const mensagemPendencia=(codigo:string) => motivos[codigo] || "Conferir pendência de preparação com o responsável.";

export function PainelMTROperacional({ empresaId, abrirLegado }: { empresaId: string; abrirLegado: () => void }) {
  const bucket = `zenwaste.mtr.pendente.${empresaId}`;
  const [lista, setLista] = useState<ManifestoOperacional[]>([]);
  const [proposta, setProposta] = useState<PreparacaoControlada | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [r, setR] = useState<ManifestoOperacional | null>(null);
  const [dados, setDados] = useState<DadosAmbientais>({});
  const [contexto, setContexto] = useState<ContextoOperacional | null>(null);
  const [etapa, setEtapa] = useState(0); const foco = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState(""); const [aviso, setAviso] = useState("");
  const [pendencias, setPendencias] = useState<Record<string, string>>({}); const [reload, setReload] = useState(0);
  const [itens, setItens] = useState<ItemCatalogo[]>([]); const [busca, setBusca] = useState(""); const [buscando, setBuscando] = useState(false);
  const [usuario, setUsuario] = useState(""); const [senha, setSenha] = useState("");
  const [pessoa, setPessoa] = useState<{ token: string; nome: string } | null>(null);
  const [checks, setChecks] = useState<boolean[]>(confirma.map(() => false));
  const [modo, setModo] = useState<"SIMULACAO" | "HOMOLOGACAO">("SIMULACAO"); const [cenario, setCenario] = useState("sucesso");
  const [pendente, setPendente] = useState<Pendente | null>(() => {
    try { const v = JSON.parse(sessionStorage.getItem(bucket) || "null"); return v && typeof v.chave === "string" && typeof v.tipo === "string" ? v : null; } catch { return null; }
  });
  const bloqueado = busy || !!pendente; const editavel = r?.estado === "RASCUNHO" && !r.despacho;
  const falha = (e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
  function receber(v: ManifestoOperacional) { setR(v); setDados(v.dados); setContexto(v.contexto); setChecks(confirma.map(() => false)); setPendencias({}); setReload(x => x + 1); }
  function guardar(v: Pendente | null) { setPendente(v); if (v) sessionStorage.setItem(bucket, JSON.stringify(v)); else sessionStorage.removeItem(bucket); }
  useEffect(() => { foco.current?.focus(); }, [etapa]);
  useEffect(() => {
    const c = new AbortController(); setCarregandoLista(true);
    void api.listar(c.signal).then(v => { if (!c.signal.aborted) setLista(v); }).catch(e => { if (!c.signal.aborted) falha(e); }).finally(() => { if (!c.signal.aborted) setCarregandoLista(false); });
    return () => c.abort();
  }, [reload]);
  useEffect(() => {
    const c = new AbortController(); setBuscando(true);
    const t = setTimeout(() => { void api.catalogos(busca, c.signal).then(v => { if (!c.signal.aborted) setItens(v.residuos); })
      .catch(e => { if (!c.signal.aborted) falha(e); }).finally(() => { if (!c.signal.aborted) setBuscando(false); }); }, 200);
    return () => { c.abort(); clearTimeout(t); };
  }, [busca]);
  async function executar(tipo: string, acao: (chave: string) => Promise<ManifestoOperacional | Record<string, unknown>>) {
    if (bloqueado) return; setBusy(true); setErro(""); setAviso(""); let p: Pendente | null = null;
    try {
      p = { chave: novaChaveMTR(), tipo, rascunhoId: r?.id || null, despachoId: r?.despacho?.id || null }; guardar(p);
      const v = await acao(p.chave);
      if (tipo === "solicitar") setAviso("Solicitação registrada. Não concede emissão nem executa POST governamental.");
      else { receber(lerManifestoOperacional(v)); if (tipo === "criar") setEtapa(1); setAviso("Operação persistida no ZenWaste. Nenhuma emissão governamental foi executada."); }
      guardar(null);
    } catch (e) {
      if (p && resultadoIncerto(e)) setErro("Resultado incerto. Consulte o comando original; não crie outra intenção.");
      else { guardar(null); falha(e); }
    } finally { setBusy(false); }
  }
  async function recuperar() {
    if (!pendente || busy) return; setBusy(true);
    try {
      const body = await api.recibo(pendente.chave);
      if (pendente.tipo === "simular" || pendente.tipo === "emitir" || pendente.tipo === "solicitar") {
        if (!body || typeof body !== "object" || !pendente.rascunhoId) throw new Error("Recibo incompatível.");
        const ack = body as Record<string, unknown>;
        if ((pendente.tipo === "simular" || pendente.tipo === "emitir") && (ack.id !== pendente.despachoId || ack.aceito !== true || ack.emissao_real_habilitada !== false)) throw new Error("Recibo não corresponde ao despacho.");
        if (pendente.tipo === "solicitar" && (ack.concedida !== false || ack.emissao_real_habilitada !== false || !ack.escopo || typeof ack.escopo !== "object" || (ack.escopo as Record<string, unknown>).intencao_id !== pendente.despachoId)) throw new Error("Recibo não corresponde à solicitação.");
        receber(await api.obter(pendente.rascunhoId));
      } else receber(lerManifestoOperacional(body));
      guardar(null); setErro(""); setAviso("Resposta recuperada do servidor sem repetir o comando.");
    } catch { setErro("Ainda não foi possível confirmar o comando. Ausência de recibo não libera novo envio."); }
    finally { setBusy(false); }
  }
  async function validar() {
    if (!r || bloqueado) return; setBusy(true); setErro("");
    try { const v = await api.validar(r.id); setPendencias(v.pendencias); setAviso(v.valido ? "Dados salvos aptos à revisão individual. Habilitação governamental não é automática." : "Há dados pendentes. Corrija e salve antes de revisar."); }
    catch (e) { falha(e); } finally { setBusy(false); }
  }
  async function identificar() {
    setBusy(true); setErro(""); try { setPessoa(await api.sessao(usuario, senha)); setAviso("Pessoa identificada no ZenWaste. Não é login SIGOR."); }
    catch (e) { setPessoa(null); falha(e); } finally { setSenha(""); setBusy(false); }
  }
  async function abrirProposta() {
    if(bloqueado)return;setBusy(true);setErro("");
    try {setProposta(await api.preparacao());} catch(e) {falha(e);} finally {setBusy(false);}
  }
  function exemplo() {
    if (!r || !contexto) return;
    setDados({ ...r.dados, gerador_unidade: "99001", transportador_unidade: "99001", destinador_unidade: "99001", resCodigoIbama: "000001", origem_codigo: "fixture_fase1a", marQuantidade: "2.000", uniCodigo: "9001", traCodigo: "9002", tieCodigo: "9003", tiaCodigo: "9004", claCodigo: "9005" });
    setContexto({ dados_simulados: true, fonte_catalogo: "FIXTURE FICTÍCIA LOCAL, SEM VALIDADE GOVERNAMENTAL", evidencia_participantes: "1".repeat(64), evidencia_classificacao: "2".repeat(64), licencas_ficticias_homologacao: true,
      descricoes: { uniCodigo: "FICTÍCIO · quilograma", traCodigo: "FICTÍCIO · tratamento", tieCodigo: "FICTÍCIO · sólido", tiaCodigo: "FICTÍCIO · embalagem", claCodigo: "FICTÍCIO · classe" } });
    setAviso("Exemplo fictício aplicado. Não é cadastro, licença ou classificação oficial. Salve antes de validar.");
  }
  function campo(nome: string, label: string) { return <label className="block text-sm" key={nome} htmlFor={`op-${nome}`}>{label}<Input id={`op-${nome}`} value={String(dados[nome] ?? "")} onChange={e => setDados(d => ({ ...d, [nome]: e.target.value }))} aria-invalid={!!pendencias[nome]} /></label>; }
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Preparação ambiental</p><h1 ref={foco} tabIndex={-1} className="text-2xl font-semibold outline-none">MTR inteligente</h1><p className="mt-2 text-sm text-muted-foreground">Prepare, revise e acompanhe os manifestos da sua empresa.</p></div><Button variant="outline" disabled={bloqueado} onClick={abrirLegado}>Operações vinculadas a frete</Button></header>
    <div role="note" className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"><strong>{r?.emissao_real_habilitada ? "SIGOR homologação · liberação específica da intenção selecionada." : "SIGOR homologação · envio governamental fechado."}</strong> Testes são identificados como simulação; a chave Q2 não autoriza emissão.</div>
    <Button variant="outline" disabled={bloqueado} onClick={() => void abrirProposta()}>Revisar cenário proposto</Button>
    {proposta && <Card><CardHeader><CardTitle>Candidato MTR-05B · revisão pendente</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
      <p>{proposta.aviso}</p><p>Unidade proposta: {proposta.unidade_proposta ?? "configuração pendente"}. Vínculo efetivado: {proposta.unidade_vinculada ?? "não disponível"}.</p>
      <p>Resíduo {proposta.dados.resCodigoIbama} · {proposta.dados.marQuantidade} toneladas, conforme declaração do operador.</p>
      <dl className="grid gap-2 md:grid-cols-2">{tipos.map(([k,nome]) => <div key={k}><dt className="font-medium">{nome} · {proposta.dados[k]}</dt><dd>{proposta.descricoes[k]}</dd></div>)}</dl>
      <p>Referência, snapshot e hash do payload: ainda não gerados. Responsável individual: {proposta.responsavel || "identificação e representação pendentes"}.</p>
      {proposta.pendencias.length>0 && <ul className="list-inside list-disc">{proposta.pendencias.map(p => <li key={p}>{mensagemPendencia(p)}</li>)}</ul>}
      <p>Uma proposta de cenário não é intenção aprovada nem autorização de emissão. A empresa demonstrativa não será usada como identidade da conta SIGOR.</p>
      <Button disabled={bloqueado || !proposta.pode_criar_candidato} onClick={() => void executar("criar",k => api.criarCandidato(k))}>Criar rascunho candidato</Button>
    </CardContent></Card>}
    {erro && <div role="alert" className="rounded-xl border border-destructive p-3 text-sm">{erro}{!pendente && <Button variant="outline" className="ml-2" onClick={() => setReload(x => x + 1)}>Atualizar dados</Button>}</div>}
    {aviso && <p role="status" className="rounded-xl bg-accent p-3 text-sm">{aviso}</p>}
    {(busy || carregandoLista) && <p role="status" className="text-sm text-muted-foreground">{busy ? "Processando a operação…" : "Carregando manifestos…"}</p>}
    {pendente && <div className="rounded-xl border p-4"><p className="break-all text-sm">Comando pendente: {pendente.chave}</p><Button disabled={busy} onClick={() => void recuperar()}>Consultar comando original</Button></div>}
    <nav aria-label="Jornada do manifesto" className="grid grid-cols-2 gap-2 md:grid-cols-4">{["Manifestos", "Dados e procedência", "Revisão individual", "Intenção e resultado"].map((t, i) => <Button key={t} variant={etapa === i ? "default" : "outline"} aria-current={etapa === i ? "step" : undefined} disabled={busy || (i > 0 && !r)} onClick={() => setEtapa(i)}>{i + 1}. {t}</Button>)}</nav>
    {etapa === 0 && <Card><CardHeader><CardTitle>Manifestos da empresa</CardTitle></CardHeader><CardContent className="space-y-4"><Button disabled={bloqueado} onClick={() => void executar("criar", k => api.criar(k))}>Novo MTR de homologação</Button>{!lista.length && <p className="text-sm">Nenhum manifesto independente cadastrado. O cenário não exige pedido, comprador ou frete fictício.</p>}<div className="grid gap-3 md:grid-cols-2">{lista.map(v => <button key={v.id} className="min-w-0 rounded-xl border p-4 text-left hover:bg-accent" disabled={bloqueado} onClick={() => { receber(v); setEtapa(1); }}>
      <strong className="block break-all">{v.despacho?.referencia || `Rascunho ${v.id.slice(0, 8)}`}</strong><small className="block break-all">ID interno: {v.id}</small>
      <span className="block text-sm">{v.dados.resCodigoIbama || "Resíduo pendente"} · {v.dados.marQuantidade || "Quantidade pendente"} · {v.contexto.descricoes.uniCodigo || "Medida pendente"}</span>
      <span className="block text-sm">Geradora / transportadora / destinadora: {v.empresa.razao_social} · unidade {v.dados.gerador_unidade || "pendente"}</span>
      <span className="block text-sm">{rotuloProcessamento(v)}</span><small className="block">Origem: {v.despacho?.simulado ? "resultado simulado" : v.despacho ? "preparação de homologação" : "dados declarados no ZenWaste"}</small>
      <small className="block">{new Date(v.criado_em).toLocaleString("pt-BR")}</small>{v.despacho?.emissao_oficial && <span>Número SIGOR: {v.despacho.numero_oficial}</span>}
    </button>)}</div></CardContent></Card>}
    {etapa === 1 && r && contexto && <Card><CardHeader><CardTitle>Dados e procedência do manifesto</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm"><strong>{r.empresa.razao_social}</strong> · {mascara(r.empresa.cnpj)} · fonte: cadastro da empresa autenticada.</p><p className="text-sm text-muted-foreground">Primeiro cenário independente: geradora, transportadora e destinadora são a mesma empresa/unidade, por escolha explícita. Isso não comprova habilitação SIGOR nem altera regras de frete.</p><fieldset disabled={bloqueado || !editavel} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">{["Geradora", "Transportadora", "Destinadora"].map(p => <label key={p} className="text-sm">{p}<select aria-label={p} className="mt-1 min-h-10 w-full rounded-lg border bg-background p-2"><option>{r.empresa.razao_social} · mesma empresa</option></select></label>)}</div>
      <label className="block text-sm">Unidade SIGOR dos três papéis<Input value={String(dados.gerador_unidade || "")} onChange={e => setDados(d => ({ ...d, gerador_unidade: e.target.value, transportador_unidade: e.target.value, destinador_unidade: e.target.value }))} /></label>
      <label className="block text-sm">Natureza dos dados<select className="mt-1 min-h-10 w-full rounded-lg border bg-background p-2" value={contexto.dados_simulados ? "teste" : "operador"} onChange={e => setContexto(c => c ? { ...c, dados_simulados: e.target.value === "teste" } : c)}><option value="teste">Dados fictícios para teste local</option><option value="operador">Dados de homologação declarados pelo operador</option></select></label>
      <Button type="button" variant="outline" onClick={exemplo}>Preencher exemplo fictício</Button>
      <SeletorResiduo valor={String(dados.resCodigoIbama || "")} itens={itens} carregando={buscando} buscar={setBusca} selecionar={v => setDados(d => ({ ...d, resCodigoIbama: String(v.codigo), origem_codigo: v.origem || "" }))} />
      {campo("marQuantidade", "Quantidade expedida · decimal, sem conversão automática")}
      <div className="grid gap-4 md:grid-cols-2">{tipos.map(([k, nome]) => <div key={k} className="space-y-2 rounded-xl border p-3">{campo(k, `${nome} · código`)}<label className="block text-sm">{nome} · descrição da fonte<Input value={contexto.descricoes[k] || ""} onChange={e => setContexto(c => c ? { ...c, descricoes: { ...c.descricoes, [k]: e.target.value } } : c)} /></label></div>)}</div>
      <p className="text-sm text-muted-foreground">Os 895 códigos fornecidos pelo operador são referência, não classificação aprovada. Descrições e relações dos demais códigos exigem fonte e revisão ambiental.</p>
      {([ ["fonte_catalogo", "Fonte/versão dos códigos e relações"], ["evidencia_participantes", "SHA-256 da evidência de participantes e habilitação"], ["evidencia_classificacao", "SHA-256 da evidência de classificação e compatibilidade"] ] as const).map(([k, nome]) => <label key={k} className="block text-sm">{nome}<Input value={contexto[k]} onChange={e => setContexto(c => c ? { ...c, [k]: e.target.value } : c)} /></label>)}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={contexto.licencas_ficticias_homologacao} onChange={e => setContexto(c => c ? { ...c, licencas_ficticias_homologacao: e.target.checked } : c)} />Licenças informadas são fictícias e exclusivas de homologação; não apresentá-las como licenças de produção.</label>
      <Button disabled={bloqueado} onClick={() => void executar("salvar", k => api.salvar(r, dados, contexto, k))}>Salvar dados</Button>
    </fieldset><Button variant="outline" disabled={bloqueado} onClick={() => void validar()}>Validar dados salvos</Button>{Object.entries(pendencias).map(([k, msg]) => <p key={k} className="text-sm text-destructive" role="alert">{k}: {msg}</p>)}{!editavel && <p className="text-sm">Snapshot aprovado: dados congelados. Consulte a intenção sem alterar a referência.</p>}</CardContent></Card>}
    {etapa === 2 && r && <Card><CardHeader><CardTitle>Revisão individual e ambiental</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm">Gerador, transportador e destinador: {r.empresa.razao_social} · {mascara(r.empresa.cnpj)} · unidade {r.dados.gerador_unidade || "pendente"}.</p><p className="text-sm">Resíduo {r.dados.resCodigoIbama || "pendente"} · quantidade {r.dados.marQuantidade || "pendente"}. Origem: {String(r.dados.origem_codigo || "não informada")}.</p><dl className="grid gap-2 text-sm md:grid-cols-2">{tipos.map(([k, nome]) => <div key={k}><dt className="font-medium">{nome}</dt><dd>{r.dados[k] || "pendente"} · {r.contexto.descricoes[k] || "descrição pendente"}</dd></div>)}</dl><p role="note" className="rounded-xl bg-warning/10 p-3 text-sm">Revise expressamente a compatibilidade entre classe e tratamento, inclusive Classe II B / Aterro Classe I. O sucesso histórico não aprova uma nova carga.</p>
      {!pessoa ? <fieldset disabled={busy} className="grid gap-3 md:grid-cols-3"><label className="text-sm">Usuário individual ZenWaste<Input autoComplete="username" value={usuario} onChange={e => setUsuario(e.target.value)} /></label><label className="text-sm">Senha individual ZenWaste<Input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label><Button disabled={busy || !usuario || !senha} onClick={() => void identificar()}>Identificar responsável</Button></fieldset> : <p className="text-sm">Pessoa identificada: <strong>{pessoa.nome}</strong>. Habilitação SIGOR é verificação separada.</p>}
      <fieldset disabled={bloqueado || !!r.revisao} className="space-y-2">{confirma.map((t, i) => <label key={t} className="flex gap-2 text-sm"><input type="checkbox" checked={checks[i]} onChange={e => setChecks(c => c.map((v, j) => j === i ? e.target.checked : v))} />{t}</label>)}</fieldset>
      {r.revisao ? <div className="text-sm"><p>Revisão aprovada por {r.revisao.responsavel}</p><code className="block break-all">SHA-256: {r.revisao.resumo}</code></div> : <Button disabled={bloqueado || !pessoa || !checks.every(Boolean)} onClick={() => pessoa && void executar("revisar", k => api.revisar(r, k, pessoa.token))}>Aprovar revisão do snapshot</Button>}
      <Button variant="outline" disabled={busy} onClick={() => setEtapa(3)}>Ver intenção e resultado</Button>
    </CardContent></Card>}
    {etapa === 3 && r && <Card><CardHeader><CardTitle>Intenção, autorização e resultado</CardTitle></CardHeader><CardContent className="space-y-4"><p className="font-medium">{rotuloProcessamento(r)}</p>{!pessoa && <p className="text-sm">Identifique a pessoa responsável na etapa de revisão para executar comandos.</p>}
      {!r.despacho && <><label className="block text-sm">Finalidade da preparação<select className="mt-1 min-h-10 w-full rounded-lg border bg-background p-2" value={modo} onChange={e => setModo(e.target.value as "SIMULACAO" | "HOMOLOGACAO")}><option value="SIMULACAO">Simulação local pelo contrato API10</option><option value="HOMOLOGACAO" disabled={r.contexto.dados_simulados}>Preparação de homologação · sem envio</option></select></label><Button disabled={bloqueado || !pessoa || !r.revisao} onClick={() => pessoa && void executar("preparar", k => api.preparar(r, modo, k, pessoa.token))}>Preparar intenção persistente</Button></>}
      {r.despacho && <><dl className="space-y-2 text-sm"><div><dt>Referência ZenWaste</dt><dd className="break-all font-mono">{r.despacho.referencia}</dd></div><div><dt>Origem do resultado</dt><dd>{r.despacho.simulado ? "TRANSPORTE FALSO · resultado simulado" : "HOMOLOGAÇÃO · aguarda autorização/resultado governamental"}</dd></div><div><dt>Iniciativas registradas</dt><dd>{r.despacho.tentativas} / 1</dd></div></dl>
      {r.despacho.simulado && <><label className="block text-sm">Cenário local<select className="mt-1 min-h-10 w-full rounded-lg border bg-background p-2" value={cenario} onChange={e => setCenario(e.target.value)} disabled={bloqueado || r.despacho.tentativas > 0}><option value="sucesso">Resposta positiva simulada</option><option value="rejeicao">Rejeição simulada</option><option value="timeout">Timeout simulado</option></select></label><Button disabled={bloqueado || !pessoa || r.despacho.tentativas > 0} onClick={() => pessoa && void executar("simular", k => api.simular(r, cenario, k, pessoa.token))}>Executar simulação API10</Button></>}
      {!r.despacho.simulado && <Button disabled={bloqueado || !pessoa || r.despacho.tentativas > 0} onClick={() => pessoa && void executar("solicitar", k => api.solicitar(r, k, pessoa.token))}>Solicitar autorização específica · sem envio</Button>}
      {r.emissao_real_habilitada && r.despacho.emissao_real_habilitada && !r.despacho.simulado && <Button disabled={bloqueado || !pessoa || r.despacho.tentativas!==0} onClick={() => pessoa && void executar("emitir", k => api.emitir(r,k,pessoa.token))}>Executar único envio autorizado</Button>}
      <p className="text-sm">{r.emissao_real_habilitada ? "Concessão específica vigente: confira referência e hashes antes de executar a única iniciativa autorizada." : "Envio governamental não liberado. Uma solicitação ou a chave Q2 não autorizam API10."}</p>{r.despacho.emissao_oficial && <p>Número SIGOR confirmado: {r.despacho.numero_oficial}</p>}
      <p className="text-sm text-muted-foreground">{r.documento.motivo} Não há PDF oficial disponível para esta intenção.</p></>}
      {r.despacho && <dl className="space-y-2 text-sm"><div><dt>Snapshot SHA-256 da intenção selecionada</dt><dd className="break-all font-mono">{r.revisao?.resumo || "Não disponível"}</dd></div><div><dt>Payload SHA-256 da intenção selecionada</dt><dd className="break-all font-mono">{r.despacho.payload_sha256 || "Não disponível neste contrato"}</dd></div></dl>}
      <Button variant="outline" disabled={busy} onClick={() => { setBusy(true); void api.obter(r.id).then(receber).catch(falha).finally(() => setBusy(false)); }}>Atualizar resultado e histórico</Button>
      <details><summary className="cursor-pointer text-sm font-medium">Histórico do manifesto</summary><ul className="mt-3 space-y-2 text-sm">{[...r.eventos, ...(r.despacho?.historico || [])].map(e => <li key={e.id}>{new Date(e.criado_em).toLocaleString("pt-BR")} · {e.acao}</li>)}</ul></details>
    </CardContent></Card>}
  </div>;
}
