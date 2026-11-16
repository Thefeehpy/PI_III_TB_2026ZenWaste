import { requisitar, ErroApi } from "@/services/cliente-http";

export type DadosAmbientais = Record<string, string | number | null>;
export interface CampoMTR { campo: string; valor: string | number | null; fonte: string | null; identificador_origem: string | null; situacao: string; pendencias: { codigo: string; mensagem: string; tipo: string }[]; requer_validacao_humana: boolean }
export interface OperacaoMTR { id: string; referencia: string; material: string; quantidade: string; unidade: string; situacao: string; origem_cadastro: string }
export interface ItemCatalogo { codigo: string | number; descricao: string; origem?: string; perigoso?: boolean | null }
export interface CatalogosMTR { residuos: ItemCatalogo[]; unidades: ItemCatalogo[]; tratamentos: ItemCatalogo[]; estados: ItemCatalogo[]; acondicionamentos: ItemCatalogo[]; classes: ItemCatalogo[]; fonte: string; referencia_operador: { registros: number; origem: string; sha256: string }; simulado: true }
export interface IntencaoMTR { id: string; rascunho_id: string; revisao_id: string; estado: string; referencia: string; cenario: string; quantidade_envios: number; resultado: Record<string, unknown>; simulado: true; emissao_oficial: false; ambiente: "MOCK" }
export interface RascunhoMTR { id: string; frete_id: string; versao: number; estado: string; ambiente: "MOCK"; dados: DadosAmbientais; revisao: { id: string; versao: number; resumo: string; operador: { nome: string }; simulado: true } | null; intencao: IntencaoMTR | null; eventos: { id: string; acao: string; criado_em: string; detalhes: Record<string, unknown> }[]; emissao_real_habilitada: false }
const estados = new Set(["RASCUNHO", "APROVADO", "PREPARADA", "EM_ENVIO", "CONFIRMADA_SIMULADA", "REJEITADA_SIMULADA", "INDETERMINADA"]);
const erroContrato = () => new Error("O backend retornou dados MTR incompatíveis. A operação não foi confirmada nesta tela.");
function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) throw erroContrato(); return v as Record<string, unknown>; }
function texto(v: unknown): string { if (typeof v !== "string") throw erroContrato(); return v; }
function numero(v: unknown): number { if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw erroContrato(); return v; }
function lista(v: unknown): unknown[] { if (!Array.isArray(v)) throw erroContrato(); return v; }
function mock(v: Record<string, unknown>) { if (v.ambiente !== "MOCK" || v.emissao_real_habilitada !== false) throw erroContrato(); }
export function lerIntencao(raw: unknown): IntencaoMTR {
  const v = obj(raw);
  if (v.ambiente !== "MOCK" || v.simulado !== true || v.emissao_oficial !== false || !estados.has(texto(v.estado))) throw erroContrato();
  for (const k of ["id", "rascunho_id", "revisao_id", "referencia", "cenario"]) texto(v[k]);
  numero(v.quantidade_envios); const resultado = obj(v.resultado);
  if (resultado.numero_oficial != null || resultado.emissao_oficial === true) throw erroContrato();
  return v as unknown as IntencaoMTR;
}
export function lerRascunho(raw: unknown): RascunhoMTR {
  const v = obj(raw); mock(v); texto(v.id); texto(v.frete_id); if (numero(v.versao) < 1 || !estados.has(texto(v.estado))) throw erroContrato();
  for (const value of Object.values(obj(v.dados))) if (value !== null && typeof value !== "string" && typeof value !== "number") throw erroContrato();
  if (v.intencao !== null) lerIntencao(v.intencao);
  if (v.revisao !== null) { const r = obj(v.revisao); texto(r.id); numero(r.versao); texto(r.resumo); texto(obj(r.operador).nome); if (r.simulado !== true) throw erroContrato(); }
  for (const e of lista(v.eventos)) { const ev = obj(e); texto(ev.id); texto(ev.acao); texto(ev.criado_em); obj(ev.detalhes); }
  return v as unknown as RascunhoMTR;
}
export function lerCatalogos(raw: unknown): CatalogosMTR {
  const v = obj(raw); if (v.simulado !== true || v.ambiente !== "MOCK" || v.aprovado_ambientalmente !== false) throw erroContrato();
  for (const key of ["residuos", "unidades", "tratamentos", "estados", "acondicionamentos", "classes"]) {
    for (const item of lista(v[key])) { const r = obj(item); if (typeof r.codigo !== "string" && typeof r.codigo !== "number") throw erroContrato(); texto(r.descricao); }
  }
  texto(v.fonte); const ref = obj(v.referencia_operador); numero(ref.registros); texto(ref.origem); texto(ref.sha256);
  return v as unknown as CatalogosMTR;
}
export function novaChaveMTR(): string { if (!globalThis.crypto?.randomUUID) throw new Error("Identificação segura do comando indisponível."); return crypto.randomUUID(); }
const base = "/mtr";
const get = (path: string, signal?: AbortSignal) => requisitar<unknown>(base + path, { signal });
function comando(path: string, method: "POST" | "PATCH", body: unknown, key: string, token?: string) {
  return requisitar<unknown>(base + path, { method, headers: { "Idempotency-Key": key, ...(token ? { "X-MTR-Actor-Token": token } : {}) }, body: JSON.stringify(body) });
}
export const servicoMTR = {
  async contexto(signal?: AbortSignal) { const v = obj(await get("/contexto/", signal)); mock(v); return v; },
  async operacoes(pagina: number, busca: string, signal?: AbortSignal) {
    const v = obj(await get(`/operacoes/?pagina=${pagina}&busca=${encodeURIComponent(busca)}`, signal));
    const resultados = lista(v.resultados).map(r => { const o = obj(r); for (const key of ["id", "referencia", "material", "quantidade", "unidade", "situacao", "origem_cadastro"]) texto(o[key]); return o as unknown as OperacaoMTR; });
    const p = obj(v.paginacao); numero(p.pagina); numero(p.total_paginas); numero(p.total);
    return { resultados, paginacao: p as { pagina: number; total_paginas: number; total: number } };
  },
  async preenchimento(id: string, signal?: AbortSignal) {
    const v = obj(await get(`/fretes/${encodeURIComponent(id)}/preenchimento/`, signal)); const d = obj(v.dados);
    const campos = lista(d.campos).map(c => { const f = obj(c); texto(f.campo); texto(f.situacao); lista(f.pendencias); if (f.valor !== null && typeof f.valor !== "number" && typeof f.valor !== "string") throw erroContrato(); return f as unknown as CampoMTR; });
    return campos;
  },
  async catalogos(busca = "", signal?: AbortSignal) { return lerCatalogos(await get(`/catalogos/?busca=${encodeURIComponent(busca)}`, signal)); },
  async existentes(frete: string, signal?: AbortSignal) { const r = obj(await get(`/rascunhos/?frete_id=${encodeURIComponent(frete)}`, signal)); return lista(r.resultados).map(lerRascunho); },
  async rascunho(id: string) { return lerRascunho(await get(`/rascunhos/${encodeURIComponent(id)}/`)); },
  async sessao(usuario: string, senha: string) {
    const r = obj(await requisitar<unknown>(base + "/sessoes-operador/", { method: "POST", body: JSON.stringify({ usuario, senha }) }));
    texto(r.token_operador); texto(obj(r.operador).nome); if (r.emissao_real_habilitada !== false) throw erroContrato();
    return { token: r.token_operador as string, nome: obj(r.operador).nome as string };
  },
  criar(frete: string, key: string) { return comando("/rascunhos/", "POST", { frete_id: frete }, key).then(lerRascunho); },
  salvar(r: RascunhoMTR, dados: DadosAmbientais, key: string) { return comando(`/rascunhos/${r.id}/`, "PATCH", { versao: r.versao, dados }, key).then(lerRascunho); },
  async validar(id: string) {
    const r = obj(await get(`/rascunhos/${id}/validacao/`));
    if (typeof r.valido_para_mock !== "boolean" || r.emissao_real_habilitada !== false) throw erroContrato();
    const p = obj(r.pendencias); Object.values(p).forEach(texto);
    return { valido_para_mock: r.valido_para_mock, pendencias: p as Record<string, string> };
  },
  revisar(r: RascunhoMTR, key: string, token: string) { return comando(`/rascunhos/${r.id}/revisoes/`, "POST", { versao: r.versao, confirmacoes: { participantes: true, quantidade: true, classificacao: true, ciencia_mock: true } }, key, token).then(lerRascunho); },
  preparar(r: RascunhoMTR, cenario: string, key: string, token: string) { return comando(`/rascunhos/${r.id}/intencoes/`, "POST", { versao: r.versao, cenario, confirmar_mock: true }, key, token).then(lerRascunho); },
  enviar(i: IntencaoMTR, key: string, token: string) { return comando(`/intencoes/${i.id}/enviar/`, "POST", {}, key, token).then(lerIntencao); },
  consultar(i: IntencaoMTR, key: string, token: string) { return comando(`/intencoes/${i.id}/reconciliacoes/`, "POST", {}, key, token).then(lerIntencao); },
  async recibo(key: string) { const r = obj(await get(`/comandos/${encodeURIComponent(key)}/`)); texto(r.chave); return r.resposta; },
};
export function resultadoIncerto(erro: unknown): boolean { return !(erro instanceof ErroApi) || erro.status === 0 || erro.status >= 500 || erro.tipo === "resposta_invalida"; }
