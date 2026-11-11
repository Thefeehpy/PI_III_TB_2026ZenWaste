import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ErroApi } from "@/services/cliente-http";
import { freteSintetico, listaFretesSintetica } from "@/test/fixtures/fretes";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import { usePainelAuditoriaIntegrada } from "./use-painel-auditoria-integrada";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"1",roles:["vendedora"]},retrySession:vi.fn()})}));
async function iniciar(gerenciar=true){
  const s=criarServicoHttpAuditoriaFretes(),f=freteSintetico({situacao:"em_cotacao",modalidade:"cotar",permissoes:{gerenciar,registrar_retirada:false,confirmar_entrega:false}});
  vi.spyOn(s,"listar").mockResolvedValue(listaFretesSintetica());
  vi.spyOn(s,"listarPedidosDisponiveis").mockResolvedValue({resultados:[],paginacao:{pagina:1,tamanho_pagina:6,total:0,total_paginas:1}});
  vi.spyOn(s,"listarDemandas").mockResolvedValue({resultados:[],paginacao:{pagina:1,tamanho_pagina:6,total:0,total_paginas:1}});
  vi.spyOn(s,"obter").mockResolvedValue(f);vi.spyOn(s,"registrarCotacao").mockResolvedValue(f);
  vi.spyOn(s,"aprovarCotacao").mockResolvedValue({...f,situacao:"aguardando_conferencia",valor_referencia:"100.00"});
  const hook=renderHook(()=>usePainelAuditoriaIntegrada(s));await waitFor(()=>expect(hook.result.current.dados.carregando).toBe(false));
  await act(async()=>hook.result.current.abrirDetalhes(f.id));return {...hook,s,f};
}
it("cotação válida envia moeda textual, prazo inteiro e observação",async()=>{
  const {result,s,f}=await iniciar();act(()=>result.current.definirFormularioCotacao({transportadora:"3",valor:"100,25",prazoDias:"2",observacao:"Condição interna"}));
  await act(async()=>result.current.cadastrarCotacao());
  expect(s.registrarCotacao).toHaveBeenCalledWith(f.id,{transportadora_id:3,valor:"100.25",prazo_dias:2,observacao:"Condição interna"});
});
it("perfil textual de vendedora não supera flag de gestão falsa",async()=>{
  const {result,s}=await iniciar(false);act(()=>result.current.definirFormularioCotacao({transportadora:"3",valor:"100,25",prazoDias:"2",observacao:"Condição interna"}));
  await act(async()=>result.current.cadastrarCotacao());await act(async()=>result.current.aprovarCotacao("cot-sintetica"));
  expect(s.registrarCotacao).not.toHaveBeenCalled();expect(s.aprovarCotacao).not.toHaveBeenCalled();
});
it("estado alterado durante aprovação exige consulta e não repete aprovação proibida",async()=>{
  const {result,s,f}=await iniciar();vi.mocked(s.aprovarCotacao).mockRejectedValueOnce(new ErroApi("Estado alterado por outra operação",409));
  await act(async()=>result.current.aprovarCotacao("cot-sintetica"));expect(result.current.dados.operacao.estado).toBe("rejeitada");
  vi.mocked(s.obter).mockResolvedValue({...f,situacao:"aguardando_conferencia"});await act(async()=>result.current.dados.abrirDetalhe(f.id));
  await act(async()=>result.current.aprovarCotacao("cot-sintetica"));expect(s.aprovarCotacao).toHaveBeenCalledTimes(1);
});
