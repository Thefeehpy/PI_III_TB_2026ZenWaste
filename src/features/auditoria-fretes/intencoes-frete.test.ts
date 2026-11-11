import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { ErroApi } from "@/services/cliente-http";
import { criarProtecaoIntencoes, lerIntencoesFrete } from "./intencoes-frete";
const caminho = "/fretes/00000000-0000-0000-0000-000000000001/tratativas/";
const hash = "a".repeat(64), outroHash = "b".repeat(64);
const chave = "00000000-0000-4000-8000-000000000001";
function coordenacao() {
  const filas = new Map<string, Promise<void>>();
  return { request: async (nome: string, opcoes: {ifAvailable?: boolean}, acao: (lock: object | null) => unknown) => {
    if (opcoes.ifAvailable && filas.has(nome)) return acao(null);
    const anterior = filas.get(nome) ?? Promise.resolve();
    let liberar!: () => void;
    const atual = new Promise<void>(r => { liberar = r; }); filas.set(nome, atual);
    await anterior;
    try { return await acao({ name: nome }); }
    finally { liberar(); if (filas.get(nome) === atual) filas.delete(nome); }
  } } as unknown as LockManager;
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("persiste somente metadados mínimos antes do envio e limpa ao confirmar", async () => {
  const protecao = criarProtecaoIntencoes("1", localStorage, coordenacao());
  const enviar = vi.fn(async () => {
    const dados = lerIntencoesFrete("1");
    expect(dados).toHaveLength(1); expect(dados[0]).toMatchObject({ caminho, resumo: hash, chave, estado: "em_andamento" });
    expect(Object.keys(dados[0]).sort()).toEqual(["empresaId","escopo","caminho","resumo","chave","instancia","iniciadaEm","estado"].sort());
    expect(JSON.stringify(dados)).not.toMatch(/assinatura|nome_recebedor|password|token|valor_sugerido/);
    return { confirmado: true };
  });
  expect(await protecao.executar(caminho, hash, chave, () => {}, enviar)).toEqual({confirmado:true});
  expect(lerIntencoesFrete("1")).toEqual([]);
});
it.each([0,500,503])("mantém chave após falha %i e repete somente a mesma intenção na instância", async status => {
  const protecao = criarProtecaoIntencoes("1", localStorage, coordenacao());
  const enviar = vi.fn().mockRejectedValueOnce(new ErroApi("Incerto",status)).mockResolvedValue("confirmado");
  await expect(protecao.executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow("Incerto");
  expect(lerIntencoesFrete("1")[0].estado).toBe("incerta");
  expect(await protecao.executar(caminho,hash,crypto.randomUUID(),()=>{},enviar)).toBe("confirmado");
  expect(enviar.mock.calls[0][0]).toBe(enviar.mock.calls[1][0]);
});
it("simula efeito persistido e resposta perdida: mesma chave não duplica o efeito", async () => {
  const protecao = criarProtecaoIntencoes("1",localStorage,coordenacao());
  const efeitos = new Set<string>(); let perder = true;
  const enviar = vi.fn(async (k: string) => { efeitos.add(k); if (perder) { perder = false; throw new ErroApi("Resposta perdida",0); } return "resultado simulado"; });
  await expect(protecao.executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow();
  await protecao.executar(caminho,hash,crypto.randomUUID(),()=>{},enviar);
  expect(efeitos.size).toBe(1);
});
it("payload alterado após incerteza não recebe nova chave nem novo POST", async () => {
  const p = criarProtecaoIntencoes("1",localStorage,coordenacao());
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",503);})).rejects.toThrow();
  const enviar = vi.fn();
  await expect(p.executar(caminho,outroHash,crypto.randomUUID(),()=>{},enviar)).rejects.toThrow("nova intenção está bloqueada");
  expect(enviar).not.toHaveBeenCalled(); expect(lerIntencoesFrete("1")[0].chave).toBe(chave);
});
it.each(["reload","nova aba"])("%s: outra instância bloqueia POST sem presumir rejeição", async () => {
  const locks = coordenacao(), p = criarProtecaoIntencoes("1",localStorage,locks);
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",0);})).rejects.toThrow();
  const nova = criarProtecaoIntencoes("1",localStorage,locks), enviar = vi.fn();
  await expect(nova.executar(caminho,hash,crypto.randomUUID(),()=>{},enviar)).rejects.toThrow("reconciliação");
  expect(enviar).not.toHaveBeenCalled();
});
it("duas abas simultâneas não iniciam dois envios sob o mesmo lock empresarial", async () => {
  const locks = coordenacao(), primeira = criarProtecaoIntencoes("1",localStorage,locks), segunda = criarProtecaoIntencoes("1",localStorage,locks);
  let concluir: (v: string) => void;
  const envio = primeira.executar(caminho,hash,chave,()=>{},()=>new Promise<string>(r=>{concluir=r;}));
  const enviar = vi.fn();
  await expect(segunda.executar(caminho,hash,crypto.randomUUID(),()=>{},enviar)).rejects.toThrow("outra aba");
  expect(enviar).not.toHaveBeenCalled(); concluir("confirmado"); await envio;
});
it("empresa diferente não lê nem substitui a pendência anterior", async () => {
  const locks = coordenacao(), p = criarProtecaoIntencoes("1",localStorage,locks);
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",0);})).rejects.toThrow();
  expect(lerIntencoesFrete("2")).toEqual([]); expect(lerIntencoesFrete(null)).toEqual([]);
  await criarProtecaoIntencoes("2",localStorage,locks).executar(caminho,hash,crypto.randomUUID(),()=>{},async()=>"ok");
  expect(lerIntencoesFrete("1")).toHaveLength(1);
});
it.each(["logout","sessão expirada","troca de empresa"])("%s antes do POST impede efeito", async () => {
  const p = criarProtecaoIntencoes("1",localStorage,coordenacao()), enviar = vi.fn();
  await expect(p.executar(caminho,hash,chave,()=>{throw new ErroApi("Sessão mudou",401);},enviar)).rejects.toThrow("Sessão mudou");
  expect(enviar).not.toHaveBeenCalled(); expect(lerIntencoesFrete("1")).toEqual([]);
});
it.each([400,401,403,404,409])("rejeição inicial %i remove apenas a intenção sem efeito confirmado", async status => {
  const p = criarProtecaoIntencoes("1",localStorage,coordenacao());
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Rejeitada",status);})).rejects.toThrow();
  expect(lerIntencoesFrete("1")).toEqual([]);
});
it("409 em retry não prova rejeição da tentativa anterior incerta", async () => {
  const p = criarProtecaoIntencoes("1",localStorage,coordenacao());
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",0);})).rejects.toThrow();
  await expect(p.executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Conflito",409);})).rejects.toThrow();
  expect(lerIntencoesFrete("1")[0].estado).toBe("incerta");
});
it("cadastro incerto bloqueia nova criação de outro conteúdo após reload", async () => {
  const locks = coordenacao();
  await expect(criarProtecaoIntencoes("1",localStorage,locks).executar("/fretes/",hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",503);})).rejects.toThrow();
  const enviar = vi.fn();
  await expect(criarProtecaoIntencoes("1",localStorage,locks).executar("/fretes/",outroHash,crypto.randomUUID(),()=>{},enviar)).rejects.toThrow("bloqueada");
  expect(enviar).not.toHaveBeenCalled();
});
it("registro local corrompido impede novo POST", async () => {
  localStorage.setItem("zenwaste.fretes.pendentes.v1.1","{corrompido");
  const enviar = vi.fn();
  await expect(criarProtecaoIntencoes("1",localStorage,coordenacao()).executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow("ler a proteção");
  expect(enviar).not.toHaveBeenCalled();
});
it("storage sem escrita não inicia efeito", async () => {
  const storage = {getItem:()=>null,setItem:()=>{throw new Error("Quota");}} as unknown as Storage;
  const enviar = vi.fn();
  await expect(criarProtecaoIntencoes("1",storage,coordenacao()).executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow("preparar a proteção");
  expect(enviar).not.toHaveBeenCalled();
});
it("ausência de Web Locks não usa fallback inseguro entre abas", async () => {
  const enviar = vi.fn();
  await expect(criarProtecaoIntencoes("1",localStorage,undefined).executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow("coordenação segura");
  expect(enviar).not.toHaveBeenCalled();
});
it("falha ao limpar proteção não reclassifica sucesso confirmado como falha", async () => {
  const storage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{throw new Error("Bloqueado");}} as unknown as Storage;
  expect(await criarProtecaoIntencoes("1",storage,coordenacao()).executar(caminho,hash,chave,()=>{},async()=>"confirmado")).toBe("confirmado");
});
it("limpeza local falha é distinguida de resultado não confirmado na página atual", async () => {
  let texto: string | null = null;
  const storage = {getItem:()=>texto,setItem:(_k:string,v:string)=>{texto=v;},removeItem:()=>{throw new Error("Bloqueado");}} as unknown as Storage;
  await criarProtecaoIntencoes("1",storage,coordenacao()).executar(caminho,hash,chave,()=>{},async()=>"confirmado");
  expect(lerIntencoesFrete("1",storage)[0].estado).toBe("confirmada_localmente");
  expect(texto).not.toContain("confirmada_localmente");
});
it.todo("FE-05: reconciliação automática confiável por intenção após reload exige contrato backend aprovado");

// R3-C1: as respostas são retidas por promessas controladas, sem timeout para liberá-las.
const caminhoB = caminho.replace("000001/", "000002/");
function respostaControlada() {
  let resolver!: (v: string) => void, rejeitar!: (e: unknown) => void;
  const promessa = new Promise<string>((r,j) => { resolver=r; rejeitar=j; });
  return {promessa,resolver,rejeitar};
}
it.each(["A", "B"])("R3-C1: fretes independentes preservam registros com conclusão de %s primeiro", async primeiro => {
  const locks=coordenacao(),a=respostaControlada(),b=respostaControlada();
  const enviarA=vi.fn(()=>a.promessa),enviarB=vi.fn(()=>b.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,crypto.randomUUID(),()=>{},enviarA);
  await vi.waitFor(()=>expect(enviarA).toHaveBeenCalledOnce());
  const pb=criarProtecaoIntencoes("1",localStorage,locks).executar(caminhoB,outroHash,crypto.randomUUID(),()=>{},enviarB);
  try {
    await vi.waitFor(()=>expect(enviarB).toHaveBeenCalledOnce()); // A ainda não recebeu resposta.
    expect(lerIntencoesFrete("1")).toHaveLength(2);
    const inicial=lerIntencoesFrete("1");
    if(primeiro==="A"){a.resolver("A");await pa;}else{b.resolver("B");await pb;}
    const restante=lerIntencoesFrete("1");expect(restante).toHaveLength(1);
    expect(restante[0]).toEqual(inicial.find(i=>i.caminho===(primeiro==="A"?caminhoB:caminho)));
  } finally {a.resolver("A");b.resolver("B");await Promise.all([pa,pb]);}
  expect(lerIntencoesFrete("1")).toEqual([]);
});
it.each([
  [true,false,"A"],[false,true,"B"],[true,true,"A"],[true,true,"B"],
] as const)("R3-C1: falhaA=%s falhaB=%s, termina %s primeiro sem perder intenções",async(falhaA,falhaB,primeiro)=>{
  const locks=coordenacao(),a=respostaControlada(),b=respostaControlada();
  const enviarA=vi.fn(()=>a.promessa),enviarB=vi.fn(()=>b.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,crypto.randomUUID(),()=>{},enviarA).catch(e=>e);
  const pb=criarProtecaoIntencoes("1",localStorage,locks).executar(caminhoB,outroHash,crypto.randomUUID(),()=>{},enviarB).catch(e=>e);
  await vi.waitFor(()=>{expect(enviarA).toHaveBeenCalledOnce();expect(enviarB).toHaveBeenCalledOnce();});
  expect(lerIntencoesFrete("1")).toHaveLength(2);
  const terminarA=()=>falhaA?a.rejeitar(new ErroApi("Resposta A perdida",0)):a.resolver("A");
  const terminarB=()=>falhaB?b.rejeitar(new ErroApi("Resposta B perdida",503)):b.resolver("B");
  if(primeiro==="A"){terminarA();await pa;terminarB();}else{terminarB();await pb;terminarA();}
  await Promise.all([pa,pb]);
  const pendentes=lerIntencoesFrete("1");
  expect(pendentes.map(i=>i.caminho).sort()).toEqual([...(falhaA?[caminho]:[]),...(falhaB?[caminhoB]:[])].sort());
  expect(pendentes.every(i=>i.estado==="incerta")).toBe(true);
});
it("R3-C1: cadastro tem escopo próprio e não bloqueia frete existente",async()=>{
  const locks=coordenacao(),a=respostaControlada(),enviar=vi.fn(()=>a.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,locks).executar("/fretes/",hash,crypto.randomUUID(),()=>{},enviar);
  await vi.waitFor(()=>expect(enviar).toHaveBeenCalledOnce());
  try{await expect(criarProtecaoIntencoes("1",localStorage,locks).executar(caminhoB,outroHash,crypto.randomUUID(),()=>{},async()=>"B")).resolves.toBe("B");
    expect(lerIntencoesFrete("1").map(i=>i.escopo)).toEqual(["cadastro"]);
  }finally{a.resolver("A");await pa;}
});
it("R3-C1: outra ação sobre o mesmo frete é bloqueada enquanto o envio está retido",async()=>{
  const locks=coordenacao(),a=respostaControlada(),enviarA=vi.fn(()=>a.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,chave,()=>{},enviarA);
  await vi.waitFor(()=>expect(enviarA).toHaveBeenCalledOnce());
  const enviarB=vi.fn();
  try{await expect(criarProtecaoIntencoes("1",localStorage,locks).executar(caminho.replace("tratativas/","cancelar/"),outroHash,crypto.randomUUID(),()=>{},enviarB)).rejects.toThrow("outra aba");expect(enviarB).not.toHaveBeenCalled();}
  finally{a.resolver("A");await pa;}
});
it.each(["chave","resumo","instancia","caminho"] as const)("R3-C1: conclusão não apaga registro cuja identidade mudou em %s",async campo=>{
  const a=respostaControlada(),enviar=vi.fn(()=>a.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,coordenacao()).executar(caminho,hash,chave,()=>{},enviar);
  await vi.waitFor(()=>expect(enviar).toHaveBeenCalledOnce());
  const registros=JSON.parse(localStorage.getItem("zenwaste.fretes.pendentes.v1.1")!);
  registros[0][campo]=campo==="chave"?crypto.randomUUID():campo==="resumo"?outroHash:campo==="caminho"?caminho.replace("tratativas/","cancelar/"):"outra-instancia";
  const alterado=JSON.stringify(registros);localStorage.setItem("zenwaste.fretes.pendentes.v1.1",alterado);
  a.resolver("confirmada");expect(await pa).toBe("confirmada");
  expect(localStorage.getItem("zenwaste.fretes.pendentes.v1.1")).toBe(alterado);
  expect(lerIntencoesFrete("1")[0].estado).toBe("em_andamento");
});
it("R3-C1: rejeição inicial de A preserva B incerto",async()=>{
  const locks=coordenacao(),a=respostaControlada(),enviar=vi.fn(()=>a.promessa);
  const pa=criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,chave,()=>{},enviar).catch(e=>e);
  await vi.waitFor(()=>expect(enviar).toHaveBeenCalledOnce());
  await expect(criarProtecaoIntencoes("1",localStorage,locks).executar(caminhoB,outroHash,crypto.randomUUID(),()=>{},async()=>{throw new ErroApi("B incerto",503);})).rejects.toThrow();
  const b=lerIntencoesFrete("1").find(i=>i.caminho===caminhoB);
  a.rejeitar(new ErroApi("A rejeitado",400));await pa;
  expect(lerIntencoesFrete("1")).toEqual([b]);
});
it("R3-C1: pendência antiga não expira após reload",async()=>{
  const locks=coordenacao();await expect(criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,chave,()=>{},async()=>{throw new ErroApi("Incerto",0);})).rejects.toThrow();
  const dados=JSON.parse(localStorage.getItem("zenwaste.fretes.pendentes.v1.1")!);dados[0].iniciadaEm="2000-01-01T00:00:00Z";localStorage.setItem("zenwaste.fretes.pendentes.v1.1",JSON.stringify(dados));
  const enviar=vi.fn();await expect(criarProtecaoIntencoes("1",localStorage,locks).executar(caminho,hash,chave,()=>{},enviar)).rejects.toThrow("reconciliação");expect(enviar).not.toHaveBeenCalled();
});
it("R3-C1: construção não usa UUID nem acessa capacidades de escrita",()=>{
  const gerar=vi.fn(()=>{throw new Error("Não deveria gerar agora");});vi.stubGlobal("crypto",{randomUUID:gerar});
  expect(()=>criarProtecaoIntencoes("1")).not.toThrow();expect(gerar).not.toHaveBeenCalled();
});
