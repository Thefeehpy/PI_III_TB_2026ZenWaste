import { describe, expect, it } from "vitest";
import { ErroApi } from "@/services/cliente-http";
import { cadastroInicial, decimalFrete, inteiroFrete, textoFrete, dataFrete,
  validarCadastroFrete, validarClassificacaoFrete, errosCamposApi, mensagemErroFrete,
  type CadastroFrete } from "./validacoes";

const pedido = { id: "00000000-0000-0000-0000-000000000031", numero: "PED-31", cliente: "Compradora fictícia",
  material: "Resíduo fictício", origem: "Coleta", quantidade: "20.000", quantidade_restante: "12.345", unidade: "kg", data_pedido: "2026-11-10" };
const valido: CadastroFrete = { ...cadastroInicial, pedidoId: pedido.id, pedido, quantidade: "1,125", origem: "Coleta", destino: "Entrega",
  pesoToneladas: "0", metrosCubicos: "2,001", quantidadeVolumes: "0", previsaoEntrega: "" };

describe("decimais textuais da R2", () => {
  it.each([["1,23",2,"1.23"],["001.20",2,"1.20"],[".001",3,"0.001"],["999999999.999",3,"999999999.999"],["9999999999,99",2,"9999999999.99"],["0",3,"0"]] as const)("normaliza %s sem arredondar", (v,c,e) => expect(decimalFrete(v,c)).toBe(e));
  it.each(["NaN","Infinity","1e3","1.234,56","1,234.56","1 000","-1","+1","","1,2,3","12abc","0x10"])("recusa sintaxe %s", v => expect(() => decimalFrete(v,2)).toThrow());
  it.each(["1.234","1,230","10000000000"])("recusa precisão monetária %s", v => expect(() => decimalFrete(v,2)).toThrow());
  it.each(["0.0001","1000000000"])("recusa precisão de medida %s", v => expect(() => decimalFrete(v,3)).toThrow());
  it("aplica mínimo de quantidade separado do peso e cubagem", () => {
    expect(() => decimalFrete("0",3,"0.001")).toThrow("0,001");
    expect(decimalFrete("0.001",3,"0.001")).toBe("0.001");
    expect(decimalFrete("0",3)).toBe("0");
  });
});
describe("inteiros e datas", () => {
  it.each(["1.5","1,5","1e2","-1","Infinity","2147483648",""])("recusa inteiro inválido %s", v => expect(() => inteiroFrete(v,0)).toThrow());
  it("aceita volumes zero e exige prazo de um dia", () => {
    expect(inteiroFrete("0",0)).toBe(0); expect(inteiroFrete("01",1)).toBe(1);
    expect(() => inteiroFrete("0",1)).toThrow();
  });
  it.each(["2026-02-29","2026-04-31","0000-01-01","2026-13-01","10/11/2026"])("recusa data %s", v => expect(() => dataFrete(v)).toThrow());
  it("permite previsão vazia e ano bissexto válido", () => {
    expect(dataFrete("")).toBe(""); expect(dataFrete("2028-02-29")).toBe("2028-02-29");
  });
});
describe("cadastro e contrato preservado", () => {
  it("constrói remessa válida somente com campos comerciais autorizados", () => {
    const { entrada, erros } = validarCadastroFrete(valido);
    expect(erros).toEqual({}); expect(entrada).toMatchObject({ pedido_id: pedido.id, quantidade: "1.125", cubagem_m3: "2.001", peso_toneladas: "0", quantidade_volumes: 0, previsao_entrega: "" });
    expect(entrada).not.toHaveProperty("material"); expect(entrada).not.toHaveProperty("empresa_compradora_id");
  });
  it("constrói avulso válido", () => {
    expect(validarCadastroFrete({ ...valido, tipo: "avulso", pedido: null, pedidoId: "", compradoraId: "2", material: "Plástico", unidade: "kg" }).entrada)
      .toMatchObject({ empresa_compradora_id: 2, material: "Plástico", unidade: "kg" });
  });
  it("recusa pedido inexistente na seleção disponível", () => expect(validarCadastroFrete({ ...valido, pedido: null }).erros).toHaveProperty("pedidoId"));
  it("recusa pedido sem saldo", () => expect(validarCadastroFrete({ ...valido, pedido: { ...pedido, quantidade_restante: "0.000" } }).erros.pedidoId).toContain("sem saldo"));
  it.each([["0",true],["0.001",false],["12.345",false],["12.346",true],["1.2345",true]] as const)("quantidade %s respeita mínimo e restante", (quantidade, falha) => expect(Boolean(validarCadastroFrete({ ...valido, quantidade }).erros.quantidade)).toBe(falha));
  it("exige peso, cubagem e volumes; não inventa zero para campo vazio", () => {
    expect(Object.keys(validarCadastroFrete({ ...valido, pesoToneladas: "", metrosCubicos: "", quantidadeVolumes: "" }).erros)).toEqual(["pesoToneladas","metrosCubicos","quantidadeVolumes"]);
  });
  it("preserva valor de texto excedido para correção", () => {
    const origem = "A".repeat(256); expect(validarCadastroFrete({ ...valido, origem }).erros.origem).toContain("255"); expect(origem.length).toBe(256);
  });
  it.each([12,60,120,255,256,1000])("valida limite textual %i sem truncar", limite => {
    expect(textoFrete("á".repeat(limite),limite).length).toBe(limite);
    expect(() => textoFrete("á".repeat(limite+1),limite)).toThrow();
  });
});
describe("classificação independente", () => {
  it.each(["cotar","retirada_cliente"] as const)("%s omite contratação", modalidade => {
    expect(validarClassificacaoFrete({ modalidade, transportadoraId: "inválido", valorReferencia: "999.123" }).entrada).toEqual({ modalidade });
  });
  it("contratado exige transportadora e duas casas", () => {
    expect(validarClassificacaoFrete({ modalidade: "contratado", transportadoraId: "3", valorReferencia: "123,45" }).entrada)
      .toEqual({ modalidade: "contratado", transportadora_id: 3, valor_referencia: "123.45" });
    expect(validarClassificacaoFrete({ modalidade: "contratado", transportadoraId: "0", valorReferencia: "123.456" }).erros)
      .toEqual({ transportadoraId: expect.any(String), valorReferencia: expect.any(String) });
  });
});
describe("erros REST", () => {
  it("mapeia 400 por campo usando ErroApi da R1", () => {
    const erro = new ErroApi("Validação",400,{detalhes:{ quantidade:["Quantidade recusada"],origem:["Origem inválida"] }});
    expect(errosCamposApi(erro,{quantidade:"quantidade",origem:"origem"})).toEqual({quantidade:"Quantidade recusada",origem:"Origem inválida"});
  });
  it("não transforma 409 de idempotência em saldo", () => {
    const mensagem = mensagemErroFrete(new ErroApi("Chave de idempotência em conflito",409));
    expect(mensagem).toContain("idempotência"); expect(mensagem).not.toContain("saldo insuficiente");
  });
  it.each([500,503,0])("falha %i mantém resultado incerto", status => expect(mensagemErroFrete(new ErroApi("Falha",status))).toContain("idempotência"));
});
