import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DialogoOperacaoFrete, SeletorEmpresaFrete } from "./ControlesAuditoriaIntegrada";
import type { EmpresaFreteDTO, ListaEmpresasFreteDTO } from "../tipos-api";

type Consultar = Parameters<typeof SeletorEmpresaFrete>[0]["consultar"];
const empresas: EmpresaFreteDTO[] = [
  { id: 3, razao_social: "Circular Fictícia" },
  { id: 4, razao_social: "Circular Fictícia" },
];
function lista(resultados = empresas, pagina = 1, totalPaginas = 1): ListaEmpresasFreteDTO {
  return { resultados, paginacao: { pagina, tamanho_pagina: 2, total: 4, total_paginas: totalPaginas } };
}
function pendente() {
  let resolver: (resposta: ListaEmpresasFreteDTO) => void;
  let rejeitar: (falha: Error) => void;
  const promessa = new Promise<ListaEmpresasFreteDTO>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promessa, resolver: (resposta: ListaEmpresasFreteDTO) => resolver(resposta), rejeitar: (falha: Error) => rejeitar(falha) };
}
function Controle({ consultar, inicial = "", nomeInicial = "", obrigatorio = true, aoAlterar = () => {} }: {
  consultar: Consultar; inicial?: string; nomeInicial?: string; obrigatorio?: boolean;
  aoAlterar?: (valor: string, nome?: string) => void;
}) {
  const [valor, alterar] = useState(inicial);
  const [nome, alterarNome] = useState(nomeInicial);
  return <SeletorEmpresaFrete rotulo="Compradora" valor={valor} nomeSelecionado={nome}
    consultar={consultar} obrigatorio={obrigatorio} aoAlterar={(id, razao) => {
      alterar(id); alterarNome(razao ?? ""); aoAlterar(id, razao);
    }} />;
}
function entrada() { return screen.getByRole("combobox", { name: "Compradora" }) as HTMLInputElement; }
function focar(elemento = entrada()) { act(() => elemento.focus()); }
async function opcoes() { return screen.findAllByRole("option"); }

it("FR01-U01: um campo com label, sem busca separada, consulta somente ao abrir e valida ID", async () => {
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} />);
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
  expect(screen.queryByLabelText("Buscar compradora")).toBeNull();
  expect(consultar).not.toHaveBeenCalled();
  expect(entrada()).toHaveAttribute("aria-expanded", "false");
  expect(entrada().validationMessage).toMatch(/Selecione uma empresa/);
  focar();
  await opcoes();
  expect(consultar).toHaveBeenLastCalledWith("", expect.any(AbortSignal), 1);
  expect(entrada()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
});

it("FR01-U02: nomes iguais permanecem opções distintas; emite ID e nome da opção escolhida", async () => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} aoAlterar={alterar} />);
  focar();
  const resultados = await opcoes();
  expect(resultados).toHaveLength(2);
  expect(resultados[0]).toHaveAccessibleName("Circular Fictícia ID 3");
  expect(resultados[1]).toHaveAccessibleName("Circular Fictícia ID 4");
  fireEvent.click(resultados[1]);
  expect(alterar).toHaveBeenLastCalledWith("4", "Circular Fictícia");
  expect(entrada()).toHaveValue("Circular Fictícia");
  expect(entrada().validationMessage).toBe("");
  expect(screen.getByText(/Selecionada: Circular Fictícia · ID 4/)).toBeInTheDocument();
  expect(entrada()).toHaveAttribute("aria-expanded", "false");
});

it("FR01-U03: digitar não substitui o ID; Escape restaura o nome já conhecido fora da página", async () => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} inicial="90" nomeInicial="Compradora já escolhida" aoAlterar={alterar} />);
  expect(entrada()).toHaveValue("Compradora já escolhida");
  focar();
  fireEvent.change(entrada(), { target: { value: "Outra" } });
  await opcoes();
  expect(alterar).not.toHaveBeenCalled();
  expect(screen.getByText(/Selecionada: Compradora já escolhida · ID 90/)).toBeInTheDocument();
  fireEvent.keyDown(entrada(), { key: "Escape" });
  expect(entrada()).toHaveValue("Compradora já escolhida");
  expect(entrada()).toHaveFocus();
  expect(entrada()).not.toHaveAttribute("aria-activedescendant");
});

it("FR01-U04: setas, Home/End e Enter mantêm foco DOM e selecionam a opção ativa", async () => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} aoAlterar={alterar} />);
  focar();
  const resultados = await opcoes();
  fireEvent.keyDown(entrada(), { key: "ArrowUp" });
  expect(entrada()).toHaveAttribute("aria-activedescendant", resultados[1].id);
  fireEvent.keyDown(entrada(), { key: "Home" });
  expect(entrada()).toHaveAttribute("aria-activedescendant", resultados[0].id);
  fireEvent.keyDown(entrada(), { key: "End" });
  expect(entrada()).toHaveAttribute("aria-activedescendant", resultados[1].id);
  expect(entrada()).toHaveFocus();
  fireEvent.keyDown(entrada(), { key: "Enter" });
  expect(alterar).toHaveBeenLastCalledWith("4", "Circular Fictícia");
});

it("FR01-U05: Enter sem opção ativa é consumido, sem confirmar texto ou submeter cadastro", async () => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} aoAlterar={alterar} />);
  focar();
  fireEvent.change(entrada(), { target: { value: "Empresa não selecionada" } });
  expect(fireEvent.keyDown(entrada(), { key: "Enter" })).toBe(false);
  await opcoes();
  expect(fireEvent.keyDown(entrada(), { key: "Enter" })).toBe(false);
  expect(alterar).not.toHaveBeenCalled();
  expect(entrada().validationMessage).toMatch(/Selecione/);
});

it("FR01-U06: composição IME não confirma opção por Enter", async () => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} aoAlterar={alterar} />);
  focar(); await opcoes();
  fireEvent.keyDown(entrada(), { key: "ArrowDown" });
  fireEvent.keyDown(entrada(), { key: "Enter", isComposing: true });
  expect(alterar).not.toHaveBeenCalled();
});

it("FR01-U07: debounce consulta apenas o último texto; nova busca reinicia na primeira página", async () => {
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} />);
  focar();
  fireEvent.change(entrada(), { target: { value: "C" } });
  fireEvent.change(entrada(), { target: { value: "Circular" } });
  await opcoes();
  expect(consultar).toHaveBeenCalledTimes(1);
  expect(consultar).toHaveBeenLastCalledWith("Circular", expect.any(AbortSignal), 1);
});

it("FR01-U08: resultado atrasado de consulta abortada não sobrescreve a busca mais nova", async () => {
  const antiga = pendente();
  const consultar = vi.fn<Consultar>().mockReturnValueOnce(antiga.promessa).mockResolvedValue(lista([{ id: 8, razao_social: "Novo resultado" }]));
  render(<Controle consultar={consultar} />);
  focar(); await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  const sinal = consultar.mock.calls[0][1];
  fireEvent.change(entrada(), { target: { value: "Nova" } });
  await screen.findByRole("option", { name: /Novo resultado/ });
  expect(sinal.aborted).toBe(true);
  await act(async () => antiga.resolver(lista([{ id: 9, razao_social: "Resultado atrasado" }])));
  expect(screen.queryByRole("option", { name: /atrasado/ })).toBeNull();
});

it("FR01-U09: rejeição atrasada não mostra erro nem encerra o loading da consulta nova", async () => {
  const antiga = pendente(), nova = pendente();
  const consultar = vi.fn<Consultar>().mockReturnValueOnce(antiga.promessa).mockReturnValue(nova.promessa);
  render(<Controle consultar={consultar} />);
  focar(); await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  fireEvent.change(entrada(), { target: { value: "Nova" } });
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  await act(async () => antiga.rejeitar(new Error("Erro antigo")));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Consultando empresas");
  await act(async () => nova.resolver(lista()));
});

it("FR01-U10: carregar mais deduplica por ID e mantém nome/ID de seleção fora das páginas", async () => {
  const consultar = vi.fn<Consultar>().mockImplementation(async (_busca, _sinal, pagina) => pagina === 2
    ? lista([empresas[1], { id: 5, razao_social: "Nome empresarial muito longo para quebrar em telas estreitas" }], 2, 2)
    : lista(empresas, 1, 2));
  const alterar = vi.fn();
  render(<Controle consultar={consultar} inicial="90" nomeInicial="Escolhida antes" aoAlterar={alterar} />);
  focar(); await opcoes();
  expect(within(screen.getByRole("listbox")).queryByRole("button")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Carregar mais empresas" }));
  await screen.findByRole("option", { name: /Nome empresarial muito longo/ });
  expect(screen.getAllByRole("option")).toHaveLength(3);
  expect(entrada()).toHaveValue("Escolhida antes");
  expect(alterar).not.toHaveBeenCalled();
  expect(consultar).toHaveBeenLastCalledWith("", expect.any(AbortSignal), 2);
});

it("FR01-U11: falha de próxima página mantém opções e foco; retry repete exatamente essa página", async () => {
  const segunda = pendente();
  const consultar = vi.fn<Consultar>().mockResolvedValueOnce(lista(empresas, 1, 2))
    .mockReturnValueOnce(segunda.promessa).mockResolvedValue(lista([{ id: 5, razao_social: "Página dois" }], 2, 2));
  render(<Controle consultar={consultar} inicial="3" nomeInicial="Circular Fictícia" />);
  focar(); await opcoes();
  const mais = screen.getByRole("button", { name: "Carregar mais empresas" });
  focar(mais as HTMLInputElement); fireEvent.click(mais);
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Carregando empresas…" })).toHaveFocus();
  expect(screen.getAllByRole("option")).toHaveLength(2);
  await act(async () => segunda.rejeitar(new Error("Falha da página 2")));
  const retry = await screen.findByRole("button", { name: "Tentar consulta novamente" });
  expect(retry).toHaveFocus();
  expect(screen.getAllByRole("option")).toHaveLength(2);
  fireEvent.click(retry);
  await screen.findByRole("option", { name: /Página dois/ });
  expect(consultar.mock.calls.map(x => x[2])).toEqual([1, 2, 2]);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  expect(entrada()).toHaveFocus();
  expect(entrada()).toHaveValue("Circular Fictícia");
});

it("FR01-U12: erro inicial, retry e vazio conservam seleção e não bloqueiam digitação", async () => {
  const consultar = vi.fn<Consultar>().mockRejectedValueOnce(new Error("Diretório indisponível"))
    .mockResolvedValue(lista([]));
  const alterar = vi.fn();
  render(<Controle consultar={consultar} inicial="3" nomeInicial="Circular Fictícia" aoAlterar={alterar} />);
  focar(); await screen.findByRole("alert");
  expect(entrada()).toBeEnabled();
  expect(entrada()).toHaveValue("Circular Fictícia");
  const retry = screen.getByRole("button", { name: "Tentar consulta novamente" });
  focar(retry as HTMLInputElement); fireEvent.click(retry);
  await screen.findByText("Nenhuma empresa encontrada nesta consulta.");
  expect(entrada()).toHaveFocus();
  expect(alterar).not.toHaveBeenCalled();
});

it.each([true, false])("FR01-U13: limpar seleção obrigatória=%s emite vazio, mantém foco e validade correta", async obrigatorio => {
  const alterar = vi.fn();
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  render(<Controle consultar={consultar} inicial="3" nomeInicial="Circular Fictícia" aoAlterar={alterar} obrigatorio={obrigatorio} />);
  fireEvent.click(screen.getByRole("button", { name: "Limpar compradora" }));
  expect(alterar).toHaveBeenLastCalledWith("", "");
  expect(entrada()).toHaveValue("");
  expect(entrada()).toHaveFocus();
  expect(entrada().validity.valid).toBe(!obrigatorio);
  await opcoes();
});

it("FR01-U14: erro de campo associa descrição e validade ARIA à única entrada", () => {
  render(<SeletorEmpresaFrete rotulo="Compradora" valor="" aoAlterar={() => {}}
    consultar={vi.fn()} erroCampo="Selecione a compradora" />);
  expect(entrada()).toHaveAttribute("aria-invalid", "true");
  expect(entrada()).toHaveAccessibleDescription(/Selecione a compradora/);
});

it("FR01-U15: blur externo restaura o nome, fecha a lista e aborta a consulta pendente", async () => {
  const resposta = pendente();
  const consultar = vi.fn<Consultar>().mockReturnValue(resposta.promessa);
  render(<><Controle consultar={consultar} inicial="3" nomeInicial="Circular Fictícia" /><button>Próximo campo</button></>);
  focar(); fireEvent.change(entrada(), { target: { value: "Texto não confirmado" } });
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  focar(screen.getByRole("button", { name: "Próximo campo" }) as HTMLInputElement);
  expect(entrada()).toHaveValue("Circular Fictícia");
  expect(entrada()).toHaveAttribute("aria-expanded", "false");
  expect(consultar.mock.calls[0][1].aborted).toBe(true);
  await act(async () => resposta.resolver(lista()));
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("FR01-U16: mudar contexto descarta cache e erro e aborta respostas da empresa anterior", async () => {
  const antiga = pendente();
  const consultar = vi.fn<Consultar>().mockResolvedValueOnce(lista()).mockReturnValue(antiga.promessa);
  const seguinte = vi.fn<Consultar>().mockResolvedValue(lista([{ id: 10, razao_social: "Contexto novo" }]));
  const { rerender } = render(<SeletorEmpresaFrete rotulo="Compradora" valor="3" consultar={consultar} aoAlterar={() => {}} />);
  focar(); await opcoes();
  expect(entrada()).toHaveValue("Circular Fictícia");
  fireEvent.change(entrada(), { target: { value: "Pendente" } });
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  rerender(<SeletorEmpresaFrete rotulo="Compradora" valor="3" consultar={seguinte} aoAlterar={() => {}} />);
  expect(entrada()).toHaveValue("Empresa selecionada — confira o nome");
  expect(entrada()).toHaveAttribute("aria-expanded", "false");
  expect(consultar.mock.calls[1][1].aborted).toBe(true);
  await act(async () => antiga.resolver(lista([{ id: 3, razao_social: "Não reutilizar" }])));
  focar(); await screen.findByRole("option", { name: /Contexto novo/ });
  expect(seguinte).toHaveBeenLastCalledWith("", expect.any(AbortSignal), 1);
  expect(screen.queryByText(/Não reutilizar/)).toBeNull();
});

it("FR01-U17: desmontagem aborta a consulta e não aplica resposta tardia", async () => {
  const resposta = pendente();
  const consultar = vi.fn<Consultar>().mockReturnValue(resposta.promessa);
  const { unmount } = render(<Controle consultar={consultar} />);
  focar(); await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  unmount();
  expect(consultar.mock.calls[0][1].aborted).toBe(true);
  await act(async () => resposta.resolver(lista()));
});

it("FR01-U18: Escape fecha primeiro a lista dentro do diálogo real; outro Escape fecha o diálogo", async () => {
  const consultar = vi.fn<Consultar>().mockResolvedValue(lista());
  function Exemplo() {
    const [aberto, abrir] = useState(false);
    return <><button onClick={() => abrir(true)}>Abrir cadastro</button>
      <DialogoOperacaoFrete aberto={aberto} aoAbrir={abrir} titulo="Cadastro de teste" descricao="Dados fictícios"
        executando={false} erro={null} aoConfirmar={async () => {}} filhos={<Controle consultar={consultar} />} /></>;
  }
  render(<Exemplo />);
  const abrir = screen.getByRole("button", { name: "Abrir cadastro" });
  focar(abrir as HTMLInputElement); fireEvent.click(abrir);
  focar(); await opcoes();
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Cadastro de teste");
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Dados fictícios");
  fireEvent.keyDown(entrada(), { key: "Escape", code: "Escape" });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(entrada()).toHaveFocus();
  expect(entrada()).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(entrada(), { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(abrir).toHaveFocus());
});
