import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { freteSintetico, listaFretesSintetica } from "@/test/fixtures/fretes";
import { ErroApi } from "@/services/cliente-http";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";
import { useOperacoesFrete } from "./use-operacoes-frete";
import { assinaturaSinteticaR3 } from "./dados-teste-r3";
import { validarAssinaturaFrete, validarRecebimentoFrete } from "./validacoes-operacionais";
import type { FreteDetalheDTO } from "./tipos-api";

async function iniciar(alteracoes: Partial<FreteDetalheDTO> = {}) {
  const frete = freteSintetico({situacao:"com_divergencia",modalidade:"contratado",valor_referencia:"100.00",valor_cte:"105.01",diferenca:"5.01",divergente:true,divergencia_aberta:true,
    permissoes:{gerenciar:true,registrar_retirada:true,confirmar_entrega:true},...alteracoes});
  const s=criarServicoHttpAuditoriaFretes();
  vi.spyOn(s,"listar").mockResolvedValue(listaFretesSintetica());
  vi.spyOn(s,"listarPedidosDisponiveis").mockResolvedValue({resultados:[],paginacao:{pagina:1,tamanho_pagina:6,total:0,total_paginas:1}});
  vi.spyOn(s,"listarDemandas").mockResolvedValue({resultados:[],paginacao:{pagina:1,tamanho_pagina:6,total:0,total_paginas:1}});
  vi.spyOn(s,"obter").mockResolvedValue(frete);
  vi.spyOn(s,"confirmarEntrega").mockResolvedValue({...frete,recebimento_confirmado:true,entrega:{nome_recebedor:"Recebedor sintético",confirmado_em:"2026-11-10T12:00:00Z",tipo_recebimento:"completo",ressalva:"",assinatura_registrada:true}});
  vi.spyOn(s,"registrarRetirada").mockResolvedValue({...frete,retirada:{nome_foto:"foto-ficticia.png",registrada_em:"2026-11-10T12:00:00Z"}});
  vi.spyOn(s,"resolverDivergencia").mockResolvedValue({...frete,divergencia_aberta:false,situacao:"aguardando_entrega"});
  vi.spyOn(s,"cancelar").mockResolvedValue({...frete,situacao:"cancelado"});
  vi.spyOn(s,"registrarTratativa").mockResolvedValue(frete);
  const contexto={};
  const hook=renderHook(()=>{
    const dados=useConsultaAuditoriaApi("1",true,s);
    const ops=useOperacoesFrete(contexto,dados.detalhe,dados,(_descricao,continuar)=>continuar());
    return {dados,ops};
  });
  await waitFor(()=>expect(hook.result.current.dados.carregando).toBe(false));
  await act(async()=>hook.result.current.dados.abrirDetalhe(frete.id));
  return {...hook,s,frete};
}
it("PNG de traço sintético válido é aceito apenas como envelope de teste",()=>expect(validarAssinaturaFrete(assinaturaSinteticaR3)).toBe(assinaturaSinteticaR3));
it.each(["","data:image/jpeg;base64,AAAA","data:image/png;base64,%%%","data:image/png;base64,AAAA"])("assinatura inválida %s não é substituída por imagem automática",valor=>expect(()=>validarAssinaturaFrete(valor)).toThrow());
it("payload de assinatura acima de 700000 caracteres é recusado",()=>expect(()=>validarAssinaturaFrete("data:image/png;base64,"+"A".repeat(700000))).toThrow("700000"));
it("ressalva obrigatória e limites do recebedor são validados",()=>{
  const r=validarRecebimentoFrete({nome:"X".repeat(121),assinatura:assinaturaSinteticaR3,tipo:"with_reservation",ressalva:""});
  expect(r.erros).toHaveProperty("nomeRecebedor");expect(r.erros).toHaveProperty("textoRessalva");
});
it.each(["complete","with_reservation"] as const)("confirma recebimento %s com divergência aberta e sem exigir retirada",async tipo=>{
  const {result,s}=await iniciar();
  act(()=>result.current.ops.recebimento.definir({nome:"Recebedor sintético",assinatura:assinaturaSinteticaR3,tipo,ressalva:tipo==="with_reservation"?"Conferir embalagem":"",revisado:true}));
  await act(async()=>result.current.ops.confirmarRecebimento());
  expect(s.confirmarEntrega).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({tipo_recebimento:tipo==="with_reservation"?"com_ressalva":"completo",dados_assinatura:assinaturaSinteticaR3}));
  expect(result.current.dados.detalhe.divergencia_aberta).toBe(true);
  expect(result.current.dados.detalhe.situacao).toBe("com_divergencia");
  expect(result.current.dados.operacao.estado).toBe("confirmada");
});
it("recebimento duplicado é bloqueado pelas flags/dados atualizados",async()=>{
  const {result,s}=await iniciar({entrega:{nome_recebedor:"Já recebeu",confirmado_em:"2026-11-10",tipo_recebimento:"completo",ressalva:"",assinatura_registrada:true},permissoes:{gerenciar:false,registrar_retirada:false,confirmar_entrega:false}});
  act(()=>result.current.ops.recebimento.definir({nome:"Pessoa",assinatura:assinaturaSinteticaR3,tipo:"complete",ressalva:"",revisado:true}));
  await act(async()=>result.current.ops.confirmarRecebimento());expect(s.confirmarEntrega).not.toHaveBeenCalled();
});
it("não participante sem detalhe não envia recebimento",async()=>{
  const {result,s}=await iniciar();vi.mocked(s.obter).mockRejectedValue(new ErroApi("Não encontrado",404));
  // Consulta de outro UUID limpa o detalhe conhecido antes da resposta 404.
  await act(async()=>result.current.dados.abrirDetalhe("outro"));
  act(()=>result.current.ops.recebimento.definir({nome:"Pessoa",assinatura:assinaturaSinteticaR3,tipo:"complete",ressalva:"",revisado:true}));
  await act(async()=>result.current.ops.confirmarRecebimento());expect(s.confirmarEntrega).not.toHaveBeenCalled();
});
it("revisão e assinatura são obrigatórias, sem preencher PNG por nome",async()=>{
  const {result,s}=await iniciar();
  act(()=>result.current.ops.recebimento.definir({nome:"Pessoa",assinatura:"",tipo:"complete",ressalva:"",revisado:false}));
  await act(async()=>result.current.ops.confirmarRecebimento());
  expect(s.confirmarEntrega).not.toHaveBeenCalled();expect(result.current.ops.recebimento.erros).toHaveProperty("dadosAssinatura");expect(result.current.ops.recebimento.erros).toHaveProperty("revisado");
});
it("retirada permitida mantém divergência e envia somente metadado",async()=>{
  const {result,s}=await iniciar();act(()=>result.current.ops.retirada.definir({texto:"foto-ficticia.png"}));
  await act(async()=>result.current.ops.registrarRetirada());
  expect(s.registrarRetirada).toHaveBeenCalledWith(expect.any(String),"foto-ficticia.png");
  expect(result.current.dados.detalhe.divergencia_aberta).toBe(true);
});
it.each(["repetida","sem autorização"])("retirada %s não envia efeito",async cenario=>{
  const {result,s}=await iniciar(cenario==="repetida"?{retirada:{nome_foto:"anterior",registrada_em:"2026-11-10"}}:{permissoes:{gerenciar:false,registrar_retirada:false,confirmar_entrega:false}});
  act(()=>result.current.ops.retirada.definir({texto:"foto-ficticia.png"}));await act(async()=>result.current.ops.registrarRetirada());expect(s.registrarRetirada).not.toHaveBeenCalled();
});
it("retirada com rede perdida fica incerta e preserva metadado",async()=>{
  const {result,s}=await iniciar();vi.mocked(s.registrarRetirada).mockRejectedValue(new ErroApi("Rede",0));
  act(()=>result.current.ops.abrirRetirada(true));act(()=>result.current.ops.retirada.definir({texto:"foto-ficticia.png"}));
  await act(async()=>result.current.ops.registrarRetirada());
  expect(result.current.dados.operacao.estado).toBe("incerta");expect(result.current.ops.retirada.formulario.texto).toBe("foto-ficticia.png");expect(result.current.ops.retirada.aberto).toBe(true);
});
it("aceite preserva diferença factual retornada pelo servidor",async()=>{
  const {result}=await iniciar();act(()=>result.current.ops.aceite.definir({texto:"Diferença comercial aceita"}));
  await act(async()=>result.current.ops.aceitarDiferenca());expect(result.current.dados.detalhe.diferenca).toBe("5.01");expect(result.current.dados.detalhe.divergencia_aberta).toBe(false);
});
it("cancelamento com retirada registrada não é autorizado",async()=>{
  const {result,s}=await iniciar({retirada:{nome_foto:"anterior",registrada_em:"2026-11-10"}});
  act(()=>result.current.ops.cancelamento.definir({texto:"Justificativa"}));await act(async()=>result.current.ops.cancelarFrete());expect(s.cancelar).not.toHaveBeenCalled();
});
it.each(["aceite","cancelamento","tratativa","retirada"] as const)("%s valida limite de texto antes do comando",async tipo=>{
  const {result,s}=await iniciar();act(()=>result.current.ops[tipo].definir({texto:"X".repeat(tipo==="retirada"?256:1001)}));
  await act(async()=>({aceite:result.current.ops.aceitarDiferenca,cancelamento:result.current.ops.cancelarFrete,tratativa:result.current.ops.registrarTratativa,retirada:result.current.ops.registrarRetirada}[tipo])());
  expect(Object.keys(result.current.ops[tipo].erros)).toHaveLength(1);
  expect(s.cancelar).not.toHaveBeenCalled();expect(s.registrarTratativa).not.toHaveBeenCalled();expect(s.registrarRetirada).not.toHaveBeenCalled();expect(s.resolverDivergencia).not.toHaveBeenCalled();
});
it("tratativa permanece interna e permitida à gestão em frete encerrado",async()=>{
  const {result,s}=await iniciar({situacao:"concluido"});act(()=>result.current.ops.tratativa.definir({texto:"Nota interna"}));await act(async()=>result.current.ops.registrarTratativa());
  expect(s.registrarTratativa).toHaveBeenCalledWith(expect.any(String),"Nota interna");
});
it("400 associa ressalva sem descartar assinatura; 409 identifica estado alterado",async()=>{
  const {result,s}=await iniciar();vi.mocked(s.confirmarEntrega).mockRejectedValueOnce(new ErroApi("Revise",400,{detalhes:{ressalva:["Descreva a avaria"]}})).mockRejectedValueOnce(new ErroApi("Recebimento já realizado",409));
  act(()=>result.current.ops.recebimento.definir({nome:"Pessoa",assinatura:assinaturaSinteticaR3,tipo:"with_reservation",ressalva:"Avaria",revisado:true}));
  await act(async()=>result.current.ops.confirmarRecebimento());expect(result.current.ops.recebimento.erros.textoRessalva).toBe("Descreva a avaria");expect(result.current.ops.recebimento.formulario.assinatura).toBe(assinaturaSinteticaR3);
  await act(async()=>result.current.ops.confirmarRecebimento());expect(result.current.dados.operacao.estado).toBe("rejeitada");expect(result.current.dados.erroComando).toContain("já realizado");
});
it("recebimento confirmado seguido de releitura falha mantém confirmação",async()=>{
  const {result,s}=await iniciar();vi.mocked(s.listar).mockRejectedValue(new ErroApi("Releitura",503));
  act(()=>result.current.ops.recebimento.definir({nome:"Pessoa",assinatura:assinaturaSinteticaR3,tipo:"complete",ressalva:"",revisado:true}));
  await act(async()=>result.current.ops.confirmarRecebimento());
  await waitFor(()=>expect(result.current.dados.erro).toContain("Releitura"));expect(result.current.dados.operacao.estado).toBe("confirmada");expect(result.current.dados.detalhe.recebimento_confirmado).toBe(true);
});
it.todo("FE-04: conclusão integral por teclado exige aceite eletrônico com autoria individual e contrato backend aprovado");
