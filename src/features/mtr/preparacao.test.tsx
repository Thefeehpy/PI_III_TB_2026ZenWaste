import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { PainelMTROperacional } from "./PainelMTROperacional";
import { lerPreparacaoControlada,operacionalMTR } from "./operacional-api";

const candidato={estado:"CANDIDATO_PENDENTE",unidade_proposta:99001,unidade_vinculada:null,
  dados:{resCodigoIbama:"010101",marQuantidade:"5.5",uniCodigo:"3",traCodigo:"4",tieCodigo:"4",tiaCodigo:"26",claCodigo:"42"},
  descricoes:{uniCodigo:"Tonelada — declaração do operador",traCodigo:"Revisão ambiental pendente"},origem:"CENARIO_DECLARADO_OPERADOR_MTR05B",
  pendencias:["CNPJ_COMPLETO_NAO_CONFIRMADO","REPRESENTACAO_NAO_COMPROVADA"],pode_criar_candidato:false,revisao_individual_aprovada:false,
  referencia:null,snapshot_sha256:null,payload_sha256:null,responsavel:null,emissao_real_habilitada:false,aviso:"Cenário ainda não aprovado."};

afterEach(()=>{cleanup();vi.restoreAllMocks();sessionStorage.clear();});

it("mantém candidato sem referência, hashes ou vínculo inventados",()=>{
  const v=lerPreparacaoControlada(candidato);expect(v.unidade_vinculada).toBeNull();expect(v.referencia).toBeNull();
  expect(()=>lerPreparacaoControlada({...candidato,pode_criar_candidato:true})).toThrow();
  expect(()=>lerPreparacaoControlada({...candidato,referencia:"REF-FICTICIA-ANTERIOR"})).toThrow();
});

it("não aceita uma aprovação ou liberação implícita na projeção",()=>{
  expect(()=>lerPreparacaoControlada({...candidato,revisao_individual_aprovada:true})).toThrow();
  expect(()=>lerPreparacaoControlada({...candidato,emissao_real_habilitada:true})).toThrow();
});

it("exibe proposta do servidor e bloqueia criação enquanto CNPJ/representação estão pendentes",async()=>{
  vi.spyOn(operacionalMTR,"listar").mockResolvedValue([]);
  vi.spyOn(operacionalMTR,"catalogos").mockResolvedValue({residuos:[]} as never);
  vi.spyOn(operacionalMTR,"preparacao").mockResolvedValue(lerPreparacaoControlada(candidato));
  const criar=vi.spyOn(operacionalMTR,"criarCandidato");
  render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"Revisar cenário proposto"}));
  expect(await screen.findByText(/Confirmar o CNPJ completo de 14 dígitos/)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Criar rascunho candidato"})).toBeDisabled();
  expect(screen.getByText(/5.5 toneladas/)).toBeInTheDocument();expect(criar).not.toHaveBeenCalled();
});
