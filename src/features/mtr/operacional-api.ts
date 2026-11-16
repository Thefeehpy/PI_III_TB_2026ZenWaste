import { requisitar } from "@/services/cliente-http";
import { servicoMTR, type DadosAmbientais } from "./servico";

export interface ContextoOperacional {
  dados_simulados: boolean; descricoes: Record<string, string>; fonte_catalogo: string;
  evidencia_participantes: string; evidencia_classificacao: string; licencas_ficticias_homologacao: boolean;
}
export interface DespachoOperacional {
  id: string; referencia: string; estado: string; simulado: boolean; tentativas: number;
  numero_oficial: string | null; emissao_oficial: boolean; emissao_real_habilitada: boolean;
  resultado: Record<string, unknown>; historico: { id: string; acao: string; criado_em: string }[];
  payload_sha256?: string;
}
export interface PreparacaoControlada {
  estado: string; unidade_proposta: number | null; unidade_vinculada: number | null;
  dados: DadosAmbientais; descricoes: Record<string,string>; origem: string; pendencias: string[];
  pode_criar_candidato: boolean; revisao_individual_aprovada: false; referencia: null;
  snapshot_sha256: null; payload_sha256: null; responsavel: string | null; emissao_real_habilitada: false; aviso: string;
}
export function lerPreparacaoControlada(raw: unknown): PreparacaoControlada {
  const v=objeto(raw);texto(v.estado);texto(v.origem);texto(v.aviso);
  if((v.unidade_proposta!==null && (!Number.isSafeInteger(v.unidade_proposta) || Number(v.unidade_proposta)<1 || Number(v.unidade_proposta)>2147483647)) || (v.unidade_vinculada!==null && v.unidade_vinculada!==v.unidade_proposta) || v.revisao_individual_aprovada!==false || v.referencia!==null || v.snapshot_sha256!==null || v.payload_sha256!==null || v.emissao_real_habilitada!==false || typeof v.pode_criar_candidato!=="boolean" || !Array.isArray(v.pendencias)) throw contrato();
  v.pendencias.forEach(texto);Object.values(objeto(v.dados)).forEach(texto);Object.values(objeto(v.descricoes)).forEach(texto);
  if(v.responsavel!==null)texto(v.responsavel);
  if(v.pode_criar_candidato && (v.pendencias.length>0 || v.unidade_proposta===null || v.unidade_vinculada!==v.unidade_proposta || !v.responsavel))throw contrato();
  return v as unknown as PreparacaoControlada;
}
export interface ManifestoOperacional {
  id: string; tipo: "HOMOLOGACAO_INDEPENDENTE"; ambiente: "HOMOLOGACAO"; frete_id: null;
  empresa: { id: number; cnpj: string; razao_social: string }; versao: number; estado: string;
  dados: DadosAmbientais; contexto: ContextoOperacional; criado_em: string;
  revisao: { id: string; resumo: string; responsavel: string } | null; despacho: DespachoOperacional | null;
  eventos: { id: string; acao: string; criado_em: string }[];
  documento: { disponivel: false; motivo: string }; emissao_real_habilitada: boolean;
}
const contrato = () => new Error("Resposta MTR incompatível. Consulte o comando original antes de criar outra intenção.");
function objeto(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) throw contrato(); return v as Record<string, unknown>; }
function texto(v: unknown) { if (typeof v !== "string") throw contrato(); return v; }
export function lerManifestoOperacional(raw: unknown): ManifestoOperacional {
  const v = objeto(raw);
  if (v.tipo !== "HOMOLOGACAO_INDEPENDENTE" || v.ambiente !== "HOMOLOGACAO" || v.frete_id !== null || typeof v.emissao_real_habilitada !== "boolean") throw contrato();
  texto(v.id); texto(v.estado); texto(v.criado_em);
  if (!Number.isSafeInteger(v.versao) || Number(v.versao) < 1) throw contrato();
  const empresa = objeto(v.empresa); texto(empresa.cnpj); texto(empresa.razao_social);
  if (!Number.isSafeInteger(empresa.id)) throw contrato();
  Object.values(objeto(v.dados)).forEach(x => { if (x !== null && typeof x !== "string" && typeof x !== "number") throw contrato(); });
  const c = objeto(v.contexto); if (typeof c.dados_simulados !== "boolean" || typeof c.licencas_ficticias_homologacao !== "boolean") throw contrato();
  for (const k of ["fonte_catalogo", "evidencia_participantes", "evidencia_classificacao"]) texto(c[k]);
  Object.values(objeto(c.descricoes)).forEach(texto);
  if (v.revisao !== null) { const r = objeto(v.revisao); texto(r.id); texto(r.resumo); texto(r.responsavel); }
  if (v.despacho !== null) {
    const d = objeto(v.despacho); texto(d.id); texto(d.referencia); texto(d.estado); objeto(d.resultado);
    if(d.payload_sha256!==undefined && (typeof d.payload_sha256!=="string" || !/^[0-9a-f]{64}$/.test(d.payload_sha256)))throw contrato();
    if (typeof d.simulado !== "boolean" || typeof d.emissao_oficial !== "boolean" || typeof d.emissao_real_habilitada !== "boolean" || !Number.isSafeInteger(d.tentativas) || Number(d.tentativas) > 1 || Number(d.tentativas) < 0) throw contrato();
    if(d.emissao_real_habilitada && (d.simulado || d.estado!=="PREPARADA" || d.tentativas!==0))throw contrato();
    if (d.simulado && (d.numero_oficial !== null || d.emissao_oficial)) throw contrato();
    if (!d.simulado && d.emissao_oficial && (d.estado !== "CONFIRMADA" || typeof d.numero_oficial !== "string" || !/^\d{1,32}$/.test(d.numero_oficial))) throw contrato();
    if (!d.emissao_oficial && d.numero_oficial !== null) throw contrato();
    if (!Array.isArray(d.historico)) throw contrato();
  }
  if(v.emissao_real_habilitada!==Boolean(v.despacho && objeto(v.despacho).emissao_real_habilitada))throw contrato();
  if (!Array.isArray(v.eventos)) throw contrato();
  const doc = objeto(v.documento); if (doc.disponivel !== false) throw contrato(); texto(doc.motivo);
  return v as unknown as ManifestoOperacional;
}
const base = "/mtr";
function enviar(path: string, method: "POST" | "PATCH", body: unknown, key: string, token?: string) {
  return requisitar<unknown>(base + path, { method, headers: { "Idempotency-Key": key, ...(token ? { "X-MTR-Actor-Token": token } : {}) }, body: JSON.stringify(body) });
}
export const operacionalMTR = {
  async preparacao() {
    const v=objeto(await requisitar<unknown>(base+"/sigor/contratos/"));
    return lerPreparacaoControlada(v.preparacao_controlada);
  },
  criarCandidato(key: string) { return enviar("/rascunhos/", "POST", {tipo:"HOMOLOGACAO_INDEPENDENTE",cenario:"MTR05B_HOMOLOGACAO"}, key).then(lerManifestoOperacional); },
  async listar(signal?: AbortSignal) {
    const v = objeto(await requisitar<unknown>(base + "/rascunhos/?tipo=HOMOLOGACAO_INDEPENDENTE", { signal }));
    if (!Array.isArray(v.resultados)) throw contrato(); return v.resultados.map(lerManifestoOperacional);
  },
  obter(id: string) { return requisitar<unknown>(base + `/rascunhos/${encodeURIComponent(id)}/`).then(lerManifestoOperacional); },
  criar(key: string) { return enviar("/rascunhos/", "POST", { tipo: "HOMOLOGACAO_INDEPENDENTE" }, key).then(lerManifestoOperacional); },
  salvar(r: ManifestoOperacional, dados: DadosAmbientais, contexto: ContextoOperacional, key: string) { return enviar(`/rascunhos/${r.id}/`, "PATCH", { versao: r.versao, dados, contexto }, key).then(lerManifestoOperacional); },
  async validar(id: string) {
    const v = objeto(await requisitar<unknown>(base + `/rascunhos/${id}/validacao/`));
    if (typeof v.valido_para_preparacao !== "boolean" || v.emissao_real_habilitada !== false) throw contrato();
    const p = objeto(v.pendencias); Object.values(p).forEach(texto);
    return { valido: v.valido_para_preparacao, pendencias: p as Record<string, string> };
  },
  revisar(r: ManifestoOperacional, key: string, token: string) { return enviar(`/rascunhos/${r.id}/revisoes/`, "POST", { versao: r.versao, confirmacoes: Object.fromEntries(["participantes", "quantidade", "classificacao", "tratamento_destinador", "sem_condicionais", "ciencia_homologacao"].map(x => [x, true])) }, key, token).then(lerManifestoOperacional); },
  preparar(r: ManifestoOperacional, modo: "SIMULACAO" | "HOMOLOGACAO", key: string, token: string) { return enviar(`/rascunhos/${r.id}/intencoes/`, "POST", { versao: r.versao, modo, confirmar_preparacao: true }, key, token).then(lerManifestoOperacional); },
  async simular(r: ManifestoOperacional, cenario: string, key: string, token: string) {
    if (!r.despacho) throw contrato();
    const ack = objeto(await enviar(`/sigor/despachos/${r.despacho.id}/executar-simulacao/`, "POST", { cenario }, key, token));
    if (ack.id !== r.despacho.id || ack.aceito !== true || ack.emissao_real_habilitada !== false) throw contrato();
    // O comando já foi aceito; falha no GET seguinte nunca autoriza uma nova iniciativa.
    try { return await this.obter(r.id); } catch { throw contrato(); }
  },
  async solicitar(r: ManifestoOperacional, key: string, token: string) {
    if (!r.despacho) throw contrato();
    const v = objeto(await enviar(`/sigor/despachos/${r.despacho.id}/solicitacoes-emissao/`, "POST", {}, key, token));
    if (v.concedida !== false || v.emissao_real_habilitada !== false || objeto(v.escopo).intencao_id !== r.despacho.id) throw contrato(); return v;
  },
  async emitir(r: ManifestoOperacional, key: string, token: string) {
    if(!r.despacho || !r.emissao_real_habilitada || !r.despacho.emissao_real_habilitada || r.despacho.simulado)throw contrato();
    const ack=objeto(await enviar(`/sigor/despachos/${r.despacho.id}/emitir/`,"POST",{},key,token));
    if(ack.id!==r.despacho.id || ack.aceito!==true || ack.emissao_real_habilitada!==false)throw contrato();
    try{return await this.obter(r.id);}catch{throw contrato();}
  },
  recibo: servicoMTR.recibo,
  sessao: servicoMTR.sessao,
  catalogos: servicoMTR.catalogos,
};
export function rotuloProcessamento(r: ManifestoOperacional): string {
  const d = r.despacho;
  if (d?.estado === "INDETERMINADA") return "Indeterminado · novo envio bloqueado";
  if (d?.estado === "EM_DESPACHO") return "Em processamento";
  if (d?.estado === "CONFIRMADA") return d.simulado ? "Simulação confirmada · sem emissão oficial" : d.emissao_oficial ? "Emitido e confirmado" : "Confirmação pendente de evidência";
  if (d?.estado === "REJEITADA") return d.simulado ? "Rejeição simulada" : "Rejeitado";
  if (d) return d.simulado ? "Preparado para simulação" : "Aguardando autorização específica";
  return r.revisao ? "Revisão aprovada" : "Rascunho · pendente de dados/revisão";
}
