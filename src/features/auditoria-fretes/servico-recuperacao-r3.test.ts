import { createElement } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { AuditoriaIntegrada } from "./AuditoriaIntegrada";
import { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ErroApi, requisitar } from "@/services/cliente-http";
import { freteSintetico, listaFretesSintetica } from "@/test/fixtures/fretes";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import { assinaturaSinteticaR3 } from "./dados-teste-r3";
import { ErroProtecaoFrete, lerIntencoesFrete } from "./intencoes-frete";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"1",roles:["vendedora"]},retrySession:vi.fn()})}));
const auth = vi.hoisted(()=>({token:"token-sintetico-r3"}));
vi.mock("@/services/cliente-http",async original=>({...await original<typeof import("@/services/cliente-http")>(),obterTokenAutenticacao:()=>auth.token,requisitar:vi.fn()}));
beforeEach(()=>{
  localStorage.clear();auth.token="token-sintetico-r3";vi.stubGlobal("crypto",webcrypto);vi.mocked(requisitar).mockReset();
  Object.defineProperty(navigator,"locks",{configurable:true,value:{request:async(_nome: string,_opcoes: unknown,acao:(lock:object)=>Promise<unknown>)=>acao({})}});
});
afterEach(()=>{vi.unstubAllGlobals();Object.defineProperty(navigator,"locks",{configurable:true,value:undefined});});
const cadastro={empresa_compradora_id:2,material:"Material sintético",unidade:"kg",quantidade:"1.000",origem:"Coleta",destino:"Entrega",peso_toneladas:"0",cubagem_m3:"0",quantidade_volumes:0,previsao_entrega:""};
it("HTTP de cadastro incerto conserva chave em retry e confirma o mesmo UUID",async()=>{
  vi.mocked(requisitar).mockRejectedValueOnce(new ErroApi("Resposta perdida",0)).mockResolvedValue(freteSintetico());
  const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});
  await expect(s.cadastrar(cadastro)).rejects.toThrow("perdida");
  const resposta=await s.cadastrar(cadastro);expect(resposta.id).toBe(freteSintetico().id);
  const chamadas=vi.mocked(requisitar).mock.calls;
  expect(chamadas[0][1].headers).toEqual(chamadas[1][1].headers);expect(lerIntencoesFrete("1")).toEqual([]);
});
it("nova instância depois de reload não faz POST de criação equivalente",async()=>{
  vi.mocked(requisitar).mockRejectedValue(new ErroApi("503",503));
  await expect(criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"}).cadastrar(cadastro)).rejects.toThrow();
  await expect(criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"}).cadastrar(cadastro)).rejects.toThrow("bloqueada");
  expect(requisitar).toHaveBeenCalledTimes(1);
});
it("nova instância com dados alterados não reutiliza chave de outra intenção",async()=>{
  vi.mocked(requisitar).mockRejectedValue(new ErroApi("503",503));const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});
  await expect(s.cadastrar(cadastro)).rejects.toThrow();await expect(s.cadastrar({...cadastro,quantidade:"2.000"})).rejects.toThrow("bloqueada");expect(requisitar).toHaveBeenCalledTimes(1);
});
it("comando confirmado remove pendência e não persiste assinatura",async()=>{
  vi.mocked(requisitar).mockResolvedValue(freteSintetico());const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});
  await s.confirmarEntrega(freteSintetico().id,{nome_recebedor:"Recebedor sintético",tipo_recebimento:"completo",ressalva:"",dados_assinatura:assinaturaSinteticaR3});
  expect(localStorage.length).toBe(0);
});
it("troca de token antes do envio bloqueia o POST e não mistura empresas",async()=>{
  const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});auth.token="outra-sessao";
  await expect(s.cadastrar(cadastro)).rejects.toThrow("sessão mudou");expect(requisitar).not.toHaveBeenCalled();expect(lerIntencoesFrete("1")).toEqual([]);
});
it.each([null,{}, {id:"id-inválido"}, {...freteSintetico(),historico:null}])("resposta 2xx incompatível permanece incerta e conserva a mesma chave",async invalida=>{
  vi.mocked(requisitar).mockResolvedValueOnce(invalida).mockResolvedValueOnce(freteSintetico());
  const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});
  await expect(s.cadastrar(cadastro)).rejects.toMatchObject({tipo:"resposta_invalida"});
  expect(lerIntencoesFrete("1")[0].estado).toBe("incerta");
  await s.cadastrar(cadastro);
  expect(vi.mocked(requisitar).mock.calls[0][1].headers).toEqual(vi.mocked(requisitar).mock.calls[1][1].headers);
});

// R3-C1: exercita o service e o hook reais; somente o transporte é simulado.
function retirarCapacidade(caso: string) {
  if(caso==="UUID")vi.stubGlobal("crypto",{subtle:webcrypto.subtle});
  if(caso==="digest")vi.stubGlobal("crypto",{randomUUID:()=>webcrypto.randomUUID()});
  if(caso==="Web Locks")Object.defineProperty(navigator,"locks",{configurable:true,value:undefined});
  if(caso==="HTTP inseguro")vi.stubGlobal("isSecureContext",false);
  if(caso==="storage indisponível")vi.stubGlobal("localStorage",undefined);
  if(caso==="storage corrompido")localStorage.setItem("zenwaste.fretes.pendentes.v1.1","{corrompido");
}
it.each(["UUID","digest","Web Locks","HTTP inseguro","storage indisponível","storage corrompido"])("R3-C1: falta de %s permite construção e GET mas bloqueia POST controladamente",async caso=>{
  retirarCapacidade(caso);vi.mocked(requisitar).mockResolvedValue(listaFretesSintetica());
  let s:ReturnType<typeof criarServicoHttpAuditoriaFretes>;
  expect(()=>{s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});}).not.toThrow();
  await expect(s!.listar()).resolves.toMatchObject({resultados:expect.any(Array)});
  let erro:unknown;try{await s!.cadastrar(cadastro);}catch(e){erro=e;}
  expect(erro).toBeInstanceOf(ErroProtecaoFrete);expect((erro as Error).message).toMatch(/Nenhuma.*operação.*enviada/i);
  expect(vi.mocked(requisitar).mock.calls.filter(([,o])=>o?.method==="POST")).toHaveLength(0);
});
it.each(["UUID lança erro","digest rejeita"])("R3-C1: %s antes do envio é bloqueio local",async caso=>{
  vi.stubGlobal("crypto",caso==="UUID lança erro"?{randomUUID:()=>{throw new Error("UUID indisponível");},subtle:webcrypto.subtle}:
    {randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:async()=>{throw new Error("Digest indisponível");}}});
  const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});
  await expect(s.cadastrar(cadastro)).rejects.toBeInstanceOf(ErroProtecaoFrete);expect(requisitar).not.toHaveBeenCalled();expect(lerIntencoesFrete("1")).toEqual([]);
});
it("R3-C1: Web Locks que rejeita acesso não produz envio nem resultado incerto",async()=>{
  Object.defineProperty(navigator,"locks",{configurable:true,value:{request:()=>Promise.reject(new DOMException("Acesso negado","SecurityError"))}});
  await expect(criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"}).cadastrar(cadastro)).rejects.toBeInstanceOf(ErroProtecaoFrete);
  expect(requisitar).not.toHaveBeenCalled();expect(lerIntencoesFrete("1")).toEqual([]);
});
it("R3-C1: storage sem escrita bloqueia antes de POST, preservando conteúdo anterior",async()=>{
  const spy=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Quota","QuotaExceededError");});
  try{await expect(criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"}).cadastrar(cadastro)).rejects.toBeInstanceOf(ErroProtecaoFrete);expect(requisitar).not.toHaveBeenCalled();}
  finally{spy.mockRestore();}
});
it("R3-C1: ambiente localhost compatível permite GET e POST com a chave persistida",async()=>{
  vi.stubGlobal("isSecureContext",true);
  vi.mocked(requisitar).mockImplementation(async(_c,o)=>{
    if(o?.method==="POST"){expect(o.headers).toEqual({"Idempotency-Key":lerIntencoesFrete("1")[0].chave});return freteSintetico();}
    return listaFretesSintetica();
  });
  const s=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});await s.listar();await s.cadastrar(cadastro);
  expect(requisitar).toHaveBeenCalledTimes(2);expect(lerIntencoesFrete("1")).toEqual([]);
});
function consultasSinteticas() {
  vi.mocked(requisitar).mockImplementation(async(c,o)=>{
    if(o?.method==="POST")throw new Error("POST não deve chegar ao transporte neste ensaio");
    if(c.startsWith("/fretes/?"))return listaFretesSintetica();
    if(c===`/fretes/${freteSintetico().id}/`)return freteSintetico();
    return {resultados:[],paginacao:{pagina:1,tamanho_pagina:6,total:0,total_paginas:1}};
  });
}
it.each(["UUID","digest","Web Locks","HTTP inseguro"])("R3-C1: tela ativa sem %s renderiza, consulta e explica bloqueio de comando",async caso=>{
  retirarCapacidade(caso);consultasSinteticas();render(createElement(AuditoriaIntegrada));
  fireEvent.click(await screen.findByRole("button",{name:"Detalhes"}));
  const tab=await screen.findByRole("tab",{name:"Histórico"});fireEvent.mouseDown(tab,{button:0,ctrlKey:false});fireEvent.click(tab);
  fireEvent.click(await screen.findByRole("button",{name:"Registrar tratativa interna"}));
  fireEvent.change(screen.getByLabelText("Observação da tratativa *"),{target:{value:"Nota fictícia C1"}});
  fireEvent.click(screen.getByRole("button",{name:"Confirmar registro interno"}));
  await waitFor(()=>expect(screen.getAllByText(/Nenhuma.*operação.*enviada/i).length).toBeGreaterThan(0));
  expect(screen.queryAllByText(/^Resultado incerto:/)).toHaveLength(0);
  expect(vi.mocked(requisitar).mock.calls.filter(([,o])=>o?.method==="POST")).toHaveLength(0);
});
it("R3-C1: hook classifica capacidade ausente como bloqueada, preservando consultas",async()=>{
  retirarCapacidade("digest");consultasSinteticas();
  const h=renderHook(()=>useConsultaAuditoriaApi("1",true));await waitFor(()=>expect(h.result.current.carregando).toBe(false));
  await act(async()=>h.result.current.executar(s=>s.registrarTratativa(freteSintetico().id,"Nota sintética")));
  expect(h.result.current.operacao.estado).toBe("bloqueada");expect(h.result.current.fretes.resultados).toHaveLength(1);
});
it("R3-C1: resposta antiga após trocar empresa limpa apenas o namespace da autora",async()=>{
  let concluirA!:(v:unknown)=>void,concluirB!:(v:unknown)=>void;
  vi.mocked(requisitar).mockImplementation((_c,o)=>new Promise(r=>{if((o.headers as Record<string,string>)["Idempotency-Key"]===lerIntencoesFrete("1")[0]?.chave)concluirA=r;else concluirB=r;}));
  const a=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"1"});const pa=a.registrarTratativa(freteSintetico().id,"A");
  await vi.waitFor(()=>expect(concluirA).toBeTypeOf("function"));auth.token="empresa-2";
  const b=criarServicoHttpAuditoriaFretes(auth.token,{empresaId:"2"});const pb=b.registrarTratativa(freteSintetico().id,"B");
  await vi.waitFor(()=>expect(concluirB).toBeTypeOf("function"));const registroB=lerIntencoesFrete("2");
  concluirA(freteSintetico());await pa;expect(lerIntencoesFrete("1")).toEqual([]);expect(lerIntencoesFrete("2")).toEqual(registroB);
  concluirB(freteSintetico());await pb;expect(lerIntencoesFrete("2")).toEqual([]);
});
