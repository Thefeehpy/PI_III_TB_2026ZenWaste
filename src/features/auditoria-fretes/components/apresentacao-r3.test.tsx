import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { freteSintetico } from "@/test/fixtures/fretes";
import { FinanceiroFrete, DivergenciasFrete } from "./FinanceiroFrete";
import { DocumentosFrete } from "./DocumentosFrete";
import { HistoricoFrete } from "./HistoricoFrete";
import { CotacoesFrete } from "./CotacoesFrete";
import { EstadoOperacoesFrete } from "./EstadoOperacoesFrete";
import { RecebimentoFrete } from "./RecebimentoFrete";
import { acoesFrete } from "../permissoes-interface";
import type { DivergenciaFreteDTO, DocumentoFreteDTO, EventoHistoricoFreteDTO } from "../tipos-api";

const doc1: DocumentoFreteDTO={id:"doc-1",numero:"CTE-FICTICIO-1",valor:"105.01",nome_arquivo:"cte-1.pdf",arquivo_nfe:"nfe-ficticia.xml",recebido_em:"2026-11-10T12:00:00Z",versao:1};
const doc2: DocumentoFreteDTO={...doc1,id:"doc-2",numero:"CTE-FICTICIO-2",valor:"106.00",versao:2};
const analise: DivergenciaFreteDTO={id:"div-1",documento_id:doc1.id,valor_referencia:"100.00",valor_cobrado:"105.01",diferenca:"5.01",tipo_resolucao:"",documento_correcao_id:null,justificativa:"",empresa_resolvedora:null,resolvida_em:null};
const evento: EventoHistoricoFreteDTO={id:"evento-1",tipo:"registrar-cte",situacao_anterior:"aguardando_conferencia",situacao_nova:"com_divergencia",autor:{id:1,razao_social:"Vendedora sintética"},registrado_em:"2026-11-10T12:00:00Z",detalhes:{documento_id:doc1.id,versao:1,nova_divergencia:true}};
it.each([["4.99",false],["5.00",false],["5.01",true],["-4.99",false],["-5.00",false],["-5.01",true]] as const)("apresenta diferença %s e flags fornecidas pelo servidor",(diferenca,aberta)=>{
  render(<FinanceiroFrete frete={freteSintetico({valor_referencia:"100.00",valor_cte:"105.01",diferenca,divergente:aberta,divergencia_aberta:aberta})} />);
  expect(screen.getByText(aberta?"Pendência financeira aberta — exige tratamento.":"Sem pendência financeira aberta informada pelo servidor.")).toBeInTheDocument();
  expect(screen.getByText(new RegExp(diferenca.startsWith("-")?"-R\\$":"\\+R\\$"))).toBeInTheDocument();
});
it("não reconstrói nem reclassifica diferença ocultada ou contraditória",()=>{
  render(<FinanceiroFrete frete={freteSintetico({valor_referencia:null,valor_cte:null,diferenca:null,divergente:false,divergencia_aberta:false})} />);
  expect(screen.getByText("Não informada ou restrita")).toBeInTheDocument();expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();
});
it("diferença permanece após aceite justificado",()=>{
  render(<DivergenciasFrete frete={freteSintetico({diferenca:"5.01",divergente:true,divergencia_aberta:false,documentos:[doc1],divergencias:[{...analise,tipo_resolucao:"aceite_justificado",justificativa:"Condição comercial aceita",empresa_resolvedora:{id:1,razao_social:"Vendedora sintética"},resolvida_em:"2026-11-10T13:00:00Z"}]})} />);
  expect(screen.getByText("Diferença factual mantida; sem pendência financeira aberta.")).toBeInTheDocument();expect(screen.getByText(/Condição comercial aceita/)).toBeInTheDocument();expect(screen.getByText(/Resolvida em/)).toBeInTheDocument();
});
it("correção ainda divergente preserva pendência anterior substituída e nova aberta",()=>{
  render(<DivergenciasFrete frete={freteSintetico({documentos:[doc1,doc2],documento:doc2,diferenca:"6.00",divergente:true,divergencia_aberta:true,divergencias:[{...analise,tipo_resolucao:"cte_corrigido",documento_correcao_id:doc2.id,resolvida_em:"2026-11-10T13:00:00Z"},{...analise,id:"div-2",documento_id:doc2.id,diferenca:"6.00",valor_cobrado:"106.00"}]})} />);
  expect(screen.getByText("Pendência substituída por CT-e corrigido")).toBeInTheDocument();expect(screen.getByText("Divergência aberta")).toBeInTheDocument();expect(screen.getByText(/Documento de correção: CTE-FICTICIO-2/)).toBeInTheDocument();
});
it("receber com pendência não significa auditoria concluída",()=>{
  render(<FinanceiroFrete frete={freteSintetico({divergencia_aberta:true,recebimento_confirmado:true,situacao:"com_divergencia"})} />);
  expect(screen.getByText("Recebimento comercial confirmado; a auditoria permanece pendente.")).toBeInTheDocument();expect(screen.queryByText("Auditoria concluída")).toBeNull();
});
it("CT-e atual e anteriores preservam metadados sem simular upload ou download",()=>{
  render(<DocumentosFrete documentos={[doc1,doc2]} documento={doc2} historico={[evento]} />);
  expect(screen.getByRole("heading",{name:/Versão 1.*anterior/})).toBeInTheDocument();expect(screen.getByRole("heading",{name:/Versão 2.*atual/})).toBeInTheDocument();
  expect(screen.getAllByText(/Nome do arquivo CT-e \(metadado\)/)).toHaveLength(2);expect(screen.getByText(/Empresa autora, conforme histórico/)).toBeInTheDocument();expect(screen.queryByRole("link")).toBeNull();
});
it("histórico mantém ordem/autoria do DTO e não inventa evento financeiro",()=>{
  const {container}=render(<HistoricoFrete eventos={[{...evento,id:"b",tipo:"tratativas",detalhes:{observacao:"Somente registro interno"}},evento]} />);
  expect(container.querySelectorAll("li")[0]).toHaveTextContent("Tratativa interna registrada");expect(container.querySelectorAll("li")[1]).toHaveTextContent("Versão de CT-e registrada");
  expect(screen.queryByText("Divergência identificada automaticamente")).toBeNull();
});
it("aprovação exige confirmação e somente resposta real destaca proposta",async()=>{
  const c={id:"cot-1",transportadora:{id:3,razao_social:"Transportadora sintética"},valor:"80.00",prazo_dias:2,observacao:"Proposta registrada pela vendedora",aprovada:false};
  const aprovar=vi.fn().mockResolvedValue(freteSintetico());const {rerender}=render(<CotacoesFrete cotacoes={[c]} podeGerenciar executando={false} erro={null} registrar={()=>{}} aprovar={aprovar} atualizar={()=>{}} />);
  fireEvent.click(screen.getByRole("button",{name:"Revisar aprovação"}));expect(aprovar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar aprovação"}));await waitFor(()=>expect(aprovar).toHaveBeenCalledWith("cot-1"));
  rerender(<CotacoesFrete cotacoes={[{...c,aprovada:true}]} podeGerenciar={false} executando={false} erro={null} registrar={()=>{}} aprovar={aprovar} atualizar={()=>{}} />);
  expect(screen.getByText("Proposta aprovada")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Revisar aprovação"})).toBeNull();
});
it("participante sem gestão não vê aprovação nem propostas ausentes no DTO",()=>{
  render(<CotacoesFrete cotacoes={[{id:"cot-propria",transportadora:{id:3,razao_social:"Minha transportadora"},valor:"80.00",prazo_dias:2,observacao:"",aprovada:false}]} podeGerenciar={false} executando={false} erro={null} registrar={()=>{}} aprovar={vi.fn()} atualizar={()=>{}} />);
  expect(screen.getByText("Minha transportadora")).toBeInTheDocument();expect(screen.queryByRole("button")).toBeNull();expect(screen.queryByText("Concorrente não fornecido")).toBeNull();
});
it("gestão, retirada e recebimento dependem das flags; divergência não cria bloqueio",()=>{
  const f=freteSintetico({situacao:"com_divergencia",divergencia_aberta:true,permissoes:{gerenciar:false,registrar_retirada:false,confirmar_entrega:true}});
  expect(acoesFrete(f)).toMatchObject({recebimento:true,retirada:false,cotacao:false,documento:false,cancelar:false});
});
it.each(["nao_iniciada","em_andamento","confirmada","rejeitada","incerta","bloqueada"] as const)("estado %s tem feedback distinto",estado=>{
  render(<EstadoOperacoesFrete operacao={{estado,descricao:"Teste",freteId:null}} erroConsulta={null} pendentes={[]} erroProtecao={null} atualizar={()=>{}} />);
  if(estado==="nao_iniciada")expect(screen.queryByRole("status")).toBeNull();else expect(screen.getByRole(estado==="incerta"?"alert":"status")).not.toBeEmptyDOMElement();
});
it("sucesso com releitura falha explica atualização sem novo comando",()=>{
  render(<EstadoOperacoesFrete operacao={{estado:"confirmada",descricao:"Teste",freteId:"1"}} erroConsulta="Falha" pendentes={[]} erroProtecao={null} atualizar={()=>{}} />);
  expect(screen.getByRole("status")).toHaveTextContent("não repetirá o comando");
});
it("recebimento informa barreira de teclado e não oferece PNG por nome",()=>{
  render(<RecebimentoFrete formulario={{nome:"",assinatura:"",tipo:"with_reservation",ressalva:"",revisado:false}} alterar={()=>{}} erros={{dadosAssinatura:"Registre a assinatura"}} empresa="Compradora sintética" identificacao="FRETE-1" />);
  expect(screen.getByText(/ainda não há alternativa operacional de aceite por teclado/)).toBeInTheDocument();expect(screen.getByRole("group",{name:"Assinatura manuscrita do recebedor"})).toHaveAttribute("aria-invalid","true");expect(screen.getByLabelText("Ressalva *")).toBeInTheDocument();expect(screen.queryByRole("button",{name:/gerar assinatura/i})).toBeNull();
});
