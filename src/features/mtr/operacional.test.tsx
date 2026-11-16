import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PainelMTROperacional } from "./PainelMTROperacional";
import { lerManifestoOperacional, operacionalMTR, rotuloProcessamento } from "./operacional-api";
import { ErroApi } from "@/services/cliente-http";
import { resultadoIncerto } from "./servico";

const raw = { id: "r1", tipo: "HOMOLOGACAO_INDEPENDENTE", ambiente: "HOMOLOGACAO", frete_id: null, empresa: { id: 1, cnpj: "00000000000001", razao_social: "Empresa FICTÍCIA" }, versao: 1, estado: "RASCUNHO", criado_em: "2026-11-16T12:00:00Z", dados: { gerador_cnpj: "00000000000001" }, contexto: { dados_simulados: true, descricoes: {}, fonte_catalogo: "", evidencia_participantes: "", evidencia_classificacao: "", licencas_ficticias_homologacao: false }, revisao: null, despacho: null, eventos: [], documento: { disponivel: false, motivo: "Documento não recuperado." }, emissao_real_habilitada: false };
const despacho = { id: "d1", referencia: "ZWM2-REFERENCIA-DE-TESTE", estado: "CONFIRMADA", simulado: true, tentativas: 1, numero_oficial: null, emissao_oficial: false, emissao_real_habilitada: false, resultado: { codigo: "API10_CONFIRMADA" }, historico: [] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe("Projeções operacionais", () => {
  it("preserva contexto de homologacao e dados textuais", () => {
    expect(lerManifestoOperacional(raw).frete_id).toBeNull();
    expect(lerManifestoOperacional(raw).empresa.cnpj).toBe("00000000000001");
  });
  it.each(["PRODUCAO", "MOCK", null])("recusa ambiente inesperado %s", ambiente => {
    expect(() => lerManifestoOperacional({ ...raw, ambiente })).toThrow();
  });
  it("nao transforma simulacao confirmada em numero oficial", () => {
    const r = lerManifestoOperacional({ ...raw, despacho });
    expect(rotuloProcessamento(r)).toContain("Simulação confirmada");
    for (const adulteracao of [{ numero_oficial: "900000000001" }, { emissao_oficial: true }, { tentativas: 2 }]) {
      expect(() => lerManifestoOperacional({ ...raw, despacho: { ...despacho, ...adulteracao } })).toThrow();
    }
  });
  it("rotula indeterminacao, revisao e autorizacao pendente", () => {
    expect(rotuloProcessamento(lerManifestoOperacional({ ...raw, despacho: { ...despacho, estado: "INDETERMINADA" } }))).toContain("novo envio bloqueado");
    expect(rotuloProcessamento(lerManifestoOperacional({ ...raw, despacho: { ...despacho, estado: "PREPARADA", simulado: false, tentativas: 0 } }))).toContain("autorização específica");
  });
  it("recusa PDF improvisado e dados aninhados", () => {
    expect(() => lerManifestoOperacional({ ...raw, documento: { disponivel: true, url: "historico.pdf" } })).toThrow();
    expect(() => lerManifestoOperacional({ ...raw, dados: { segredo: [] } })).toThrow();
  });
  it("só aceita capacidade de envio coerente com uma intenção não simulada ainda sem tentativa",()=>{
    const d={...despacho,estado:"PREPARADA",simulado:false,tentativas:0,emissao_real_habilitada:true};
    expect(lerManifestoOperacional({...raw,despacho:d,emissao_real_habilitada:true}).emissao_real_habilitada).toBe(true);
    for(const adulteracao of [{simulado:true},{tentativas:1},{estado:"CONFIRMADA"}]){
      expect(()=>lerManifestoOperacional({...raw,despacho:{...d,...adulteracao},emissao_real_habilitada:true})).toThrow();
    }
    expect(()=>lerManifestoOperacional({...raw,despacho:d,emissao_real_habilitada:false})).toThrow();
  });
  it("cliente não inicia emissão quando o servidor mantém o gate fechado",async()=>{
    const fetch=vi.spyOn(globalThis,"fetch");
    await expect(operacionalMTR.emitir(lerManifestoOperacional({...raw,despacho}),"chave","PESSOA-FICTICIA")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("GET perdido após aceite não libera outra iniciativa, mesmo com 404", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: "d1", aceito: true, emissao_real_habilitada: false }), { status: 202 }));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Não localizado" }), { status: 404 }));
    const erro = await operacionalMTR.simular(lerManifestoOperacional({ ...raw, despacho }), "sucesso", "chave", "PESSOA-FICTICIA").catch(e => e);
    expect(erro).toBeInstanceOf(Error); expect(resultadoIncerto(erro)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(fetch.mock.calls[1][1]?.method).toBeUndefined();
  });
});

describe("Tela operacional com cliente simulado", () => {
  function leituras() {
    vi.spyOn(operacionalMTR, "listar").mockResolvedValue([]);
    vi.spyOn(operacionalMTR, "catalogos").mockResolvedValue({ residuos: [] } as never);
  }
  it("cria pelo endpoint existente e mostra origem empresarial sem exigir frete", async () => {
    leituras(); const criar = vi.spyOn(operacionalMTR, "criar").mockResolvedValue(lerManifestoOperacional(raw));
    render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo MTR de homologação" }));
    expect(await screen.findByText(/cadastro da empresa autenticada/)).toBeInTheDocument();
    expect(criar).toHaveBeenCalledOnce(); expect(screen.getByText(/mesma empresa\/unidade/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha SIGOR")).not.toBeInTheDocument();
  });
  it("resultado incerto fica bloqueado mesmo apos remount e 404 do recibo", async () => {
    leituras(); const criar = vi.spyOn(operacionalMTR, "criar").mockRejectedValue(new ErroApi("rede", 0));
    vi.spyOn(operacionalMTR, "recibo").mockRejectedValue(new ErroApi("não localizado", 404));
    const mounted = render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo MTR de homologação" }));
    expect(await screen.findByText(/Resultado incerto/)).toBeInTheDocument();
    mounted.unmount(); render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Novo MTR de homologação" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar comando original" }));
    expect(await screen.findByText(/Ausência de recibo não libera/)).toBeInTheDocument();
    expect(criar).toHaveBeenCalledOnce();
  });
  it("recupera resposta positiva sem criar outra intencao", async () => {
    leituras(); sessionStorage.setItem("zenwaste.mtr.pendente.1", JSON.stringify({ chave: "key", tipo: "criar", rascunhoId: null }));
    const criar = vi.spyOn(operacionalMTR, "criar"); vi.spyOn(operacionalMTR, "recibo").mockResolvedValue(raw);
    render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar comando original" }));
    expect(await screen.findByText(/Resposta recuperada/)).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled(); expect(sessionStorage.getItem("zenwaste.mtr.pendente.1")).toBeNull();
  });
  it("mantem pendencia isolada por empresa", async () => {
    leituras(); sessionStorage.setItem("zenwaste.mtr.pendente.2", JSON.stringify({ chave: "outra", tipo: "criar", rascunhoId: null }));
    render(<PainelMTROperacional empresaId="1" abrirLegado={vi.fn()} />);
    await waitFor(() => expect(operacionalMTR.listar).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Novo MTR de homologação" })).not.toBeDisabled();
    expect(screen.queryByText(/outra/)).not.toBeInTheDocument();
  });
});
