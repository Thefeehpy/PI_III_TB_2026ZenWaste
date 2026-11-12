import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CampoAuditoria } from "./CampoAuditoria";
import { DialogoOperacaoFrete, SeletorEmpresaFrete } from "./ControlesAuditoriaIntegrada";
import { FormularioCadastroFrete } from "./FormularioCadastroFrete";
import { cadastroInicial } from "../validacoes";
import type { ListaEmpresasFreteDTO } from "../tipos-api";

const pagina = (id: number, nome: string, pagina = 1): ListaEmpresasFreteDTO => ({ resultados: [{ id, razao_social: nome }], paginacao: { pagina, tamanho_pagina: 1, total: 2, total_paginas: 2 } });
it("campo monetário mantém vírgula e associa instrução e erro", () => {
  const alterar = vi.fn();
  render(<CampoAuditoria rotulo="Valor" valor="12,345" formato="moeda" erro="Use até 2 casas" aoAlterar={alterar} />);
  const campo = screen.getByLabelText("Valor *");
  expect(campo).toHaveAttribute("inputmode","decimal");
  expect(campo).toHaveAttribute("aria-invalid","true");
  expect(campo).toHaveAccessibleDescription(/até 2 casas/);
  expect(campo).toHaveValue("12,345");
  fireEvent.change(campo,{target:{value:"12,34"}});
  expect(alterar).toHaveBeenCalledWith("12,34");
});
it("texto excedido não é truncado nem limitado pelo navegador", () => {
  render(<CampoAuditoria rotulo="Material" valor={"A".repeat(257)} limite={256} aoAlterar={() => {}} />);
  expect(screen.getByLabelText("Material *")).toHaveValue("A".repeat(257));
  expect(screen.getByLabelText("Material *")).not.toHaveAttribute("maxlength");
  expect(screen.getByLabelText("Material *")).toHaveAttribute("aria-invalid","true");
});
it("resumo acessível direciona foco para o primeiro campo inválido", async () => {
  function Exemplo() {
    const [erros, definir] = useState<Record<string,string>>({});
    return <DialogoOperacaoFrete aberto aoAbrir={() => {}} titulo="Cadastro" descricao="Teste fictício" executando={false} erro={null} erros={erros} validarLocalmente
      aoConfirmar={async () => definir({destino:"Preencha o destino"})}
      filhos={<CampoAuditoria rotulo="Destino" valor="" erro={erros.destino} aoAlterar={() => {}} />} />;
  }
  render(<Exemplo />);
  fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));
  await waitFor(() => expect(screen.getByLabelText("Destino *")).toHaveFocus());
  expect(screen.getByRole("alert")).toHaveTextContent("Revise os 1 campo(s)");
});
it("trava síncrona impede dois submits antes da mudança de props", async () => {
  let resolver: () => void;
  const confirmar = vi.fn(() => new Promise<void>(r => { resolver = r; }));
  const { container, rerender } = render(<DialogoOperacaoFrete aberto aoAbrir={() => {}} titulo="Cadastro" descricao="Teste fictício" executando={false} erro={null} aoConfirmar={confirmar} filhos={<input aria-label="Campo" />} />);
  fireEvent.submit(container.ownerDocument.querySelector("form")!);
  fireEvent.submit(container.ownerDocument.querySelector("form")!);
  expect(confirmar).toHaveBeenCalledTimes(1);
  rerender(<DialogoOperacaoFrete aberto aoAbrir={() => {}} titulo="Cadastro" descricao="Teste fictício" executando erro={null} aoConfirmar={confirmar} filhos={<input aria-label="Campo" />} />);
  expect(screen.getByRole("button",{name:"Salvando…"})).toBeDisabled();
  expect(screen.getByLabelText("Campo")).toBeDisabled();
  await act(async () => resolver());
});
it("erro de conflito recebe foco para ficar visível em formulário extenso", async () => {
  function Exemplo() {
    const [valor, alterar] = useState("");
    const [erro, definirErro] = useState<string | null>(null);
    return <DialogoOperacaoFrete aberto aoAbrir={() => {}} titulo="Cadastro" descricao="Teste fictício" executando={false}
      validarLocalmente erro={erro} aoConfirmar={async () => definirErro("Conflito: pedido cancelado")}
      filhos={<CampoAuditoria rotulo="Campo" valor={valor} aoAlterar={alterar} />} />;
  }
  render(<Exemplo />);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(screen.getByRole("alert")).toHaveTextContent("pedido cancelado");
  const campo = screen.getByLabelText("Campo *");
  campo.focus();
  fireEvent.change(campo, { target: { value: "Correção" } });
  expect(campo).toHaveFocus();
  expect(campo).toHaveValue("Correção");
});
it("seletor preserva razão social ao carregar outra página sem exigir ID manual", async () => {
  const consultar = vi.fn().mockImplementation((_busca, _sinal, numero) => Promise.resolve(numero === 2
    ? pagina(4,"Transportadora Beta",2) : pagina(3,"Transportadora Alfa")));
  function Exemplo() { const [valor, alterar] = useState(""); return <SeletorEmpresaFrete rotulo="Transportadora" valor={valor} aoAlterar={alterar} consultar={consultar} />; }
  render(<Exemplo />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Transportadora" }));
  await screen.findByRole("option",{name:/Transportadora Alfa/});
  fireEvent.click(screen.getByRole("option",{name:/Transportadora Alfa/}));
  fireEvent.focus(screen.getByRole("combobox", { name: "Transportadora" }));
  await screen.findByRole("button",{name:"Carregar mais empresas"});
  fireEvent.click(screen.getByRole("button",{name:"Carregar mais empresas"}));
  await screen.findByRole("option",{name:/Transportadora Beta/});
  expect(screen.getByRole("combobox", { name: "Transportadora" })).toHaveValue("Transportadora Alfa");
  expect(consultar).toHaveBeenLastCalledWith("",expect.any(AbortSignal),2);
});
it("seletor ignora consulta antiga após nova busca", async () => {
  let antiga: (v: ListaEmpresasFreteDTO) => void;
  const consultar = vi.fn().mockImplementationOnce(() => new Promise(r => { antiga = r; })).mockResolvedValue(pagina(4,"Resultado novo"));
  render(<SeletorEmpresaFrete rotulo="Compradora" valor="" aoAlterar={() => {}} consultar={consultar} />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Compradora" }));
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole("combobox", { name: "Compradora" }),{target:{value:"Nova"}});
  await screen.findByRole("option",{name:/Resultado novo/});
  await act(async () => antiga(pagina(3,"Resultado antigo")));
  expect(screen.queryByRole("option",{name:/Resultado antigo/})).toBeNull();
});
it("seletor mostra falha, recuperação e vazio", async () => {
  const consultar = vi.fn().mockRejectedValueOnce(new Error("Consulta indisponível")).mockResolvedValue({resultados:[],paginacao:{pagina:1,tamanho_pagina:10,total:0,total_paginas:1}});
  render(<SeletorEmpresaFrete rotulo="Transportadora" valor="" aoAlterar={() => {}} consultar={consultar} obrigatorio={false} />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Transportadora" }));
  await screen.findByText("Consulta indisponível");
  fireEvent.click(screen.getByRole("button",{name:"Tentar consulta novamente"}));
  await screen.findByText("Nenhuma empresa encontrada nesta consulta.");
  expect(screen.getByRole("combobox",{name:"Transportadora"})).toHaveAttribute("placeholder", "Todas as transportadoras");
});
it("pedido mostra compradora, negociada e remessa em leitura", () => {
  const pedido = { id:"pedido-1",numero:"PED-1",cliente:"Compradora fictícia",material:"Material confirmado",unidade:"kg",quantidade:"20.000",quantidade_restante:"12.000",origem:"Coleta",data_pedido:"2026-11-10" };
  render(<FormularioCadastroFrete formulario={{...cadastroInicial,pedido,pedidoId:pedido.id,material:pedido.material}} alterar={() => {}} trocarTipo={() => {}} selecionarPedido={() => {}} pedidos={null} carregando={false} erroConsulta={null} aoRecarregar={() => {}} aoPaginar={() => {}} consultarCompradoras={vi.fn()} erros={{}} />);
  expect(screen.getByText("Compradora fictícia")).toBeInTheDocument();
  expect(screen.getByText("20,000 kg")).toBeInTheDocument();
  expect(screen.getByText("12,000 kg")).toBeInTheDocument();
  expect(screen.queryByRole("textbox",{name:/Material/})).toBeNull();
});
