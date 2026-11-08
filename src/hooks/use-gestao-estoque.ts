import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { servicoEstoque } from "@/services/servico-estoque";
import type { AtualizacaoItemEstoque, CadastroItemEstoque, ItemEstoque, MovimentacaoEstoque, RegistroMovimentacaoEstoque } from "@/types/estoque";

interface SessaoEstoque { empresaId: string | null; itensEmAlteracao: Set<string> }
interface EstadoEstoque {
  sessao: SessaoEstoque;
  itens: ItemEstoque[];
  movimentacoes: MovimentacaoEstoque[];
  carregando: boolean;
  erro: string | null;
  erroMovimentacoes: string | null;
}
export interface ResultadoAcaoEstoque { sucesso: boolean; mensagem: string }

function estadoInicial(sessao: SessaoEstoque): EstadoEstoque {
  return { sessao, itens: [], movimentacoes: [], carregando: Boolean(sessao.empresaId), erro: null, erroMovimentacoes: null };
}
function mensagemErro(erro: unknown, alternativa: string) {
  return erro instanceof Error ? erro.message : alternativa;
}
function ordenarItens(itens: ItemEstoque[]) {
  return [...itens].sort((primeiro, segundo) => Date.parse(segundo.updatedAt) - Date.parse(primeiro.updatedAt));
}
function ordenarMovimentacoes(movimentacoes: MovimentacaoEstoque[]) {
  return [...movimentacoes].sort((primeira, segunda) => Date.parse(segunda.createdAt) - Date.parse(primeira.createdAt));
}

/** A sessão faz parte do estado para nunca exibir dados da empresa anterior. */
export function useGestaoEstoque(empresaId: string | null, servico = servicoEstoque) {
  const sessao = useMemo(() => ({ empresaId, itensEmAlteracao: new Set<string>() }), [empresaId]);
  const sessaoAtiva = useRef<SessaoEstoque | null>(sessao);
  const sequenciaItens = useRef(0);
  const sequenciaMovimentacoes = useRef(0);
  const sessaoComListaCompleta = useRef<SessaoEstoque | null>(null);
  const { itensEmAlteracao } = sessao;
  const [estado, definirEstado] = useState(() => estadoInicial(sessao));

  useLayoutEffect(() => {
    sessaoAtiva.current = sessao;
    return () => { sessaoAtiva.current = null; };
  }, [sessao]);

  const aplicar = useCallback((alterar: (anterior: EstadoEstoque) => EstadoEstoque) => {
    if (!sessao.empresaId || sessaoAtiva.current !== sessao) return;
    definirEstado((anterior) => sessaoAtiva.current === sessao
      ? alterar(anterior.sessao === sessao ? anterior : estadoInicial(sessao))
      : anterior);
  }, [sessao]);

  const atualizarMovimentacoes = useCallback(async (signal?: AbortSignal) => {
    const sequencia = ++sequenciaMovimentacoes.current;
    try {
      const resposta = await servico.listarMovimentacoes({ signal });
      if (sequencia !== sequenciaMovimentacoes.current || signal?.aborted) return;
      aplicar((anterior) => ({ ...anterior, movimentacoes: ordenarMovimentacoes(resposta.movements), erroMovimentacoes: null }));
    } catch (erro) {
      if (sequencia !== sequenciaMovimentacoes.current || signal?.aborted) return;
      aplicar((anterior) => ({ ...anterior, erroMovimentacoes: mensagemErro(erro, "Não foi possível carregar o histórico de movimentações.") }));
    }
  }, [aplicar, servico]);

  const atualizarEstoque = useCallback(async (signal?: AbortSignal) => {
    if (!sessao.empresaId) return;
    const sequencia = ++sequenciaItens.current;
    aplicar((anterior) => ({ ...anterior, carregando: true }));
    const carregarItens = async () => {
      try {
        const resposta = await servico.listarItens({ signal });
        if (sequencia !== sequenciaItens.current || signal?.aborted) return;
        if (sessaoAtiva.current === sessao) sessaoComListaCompleta.current = sessao;
        aplicar((anterior) => ({ ...anterior, itens: ordenarItens(resposta.items), erro: null }));
      } catch (erro) {
        if (sequencia !== sequenciaItens.current || signal?.aborted) return;
        aplicar((anterior) => ({ ...anterior, erro: mensagemErro(erro, "Não foi possível carregar o estoque.") }));
      }
    };
    await Promise.all([carregarItens(), atualizarMovimentacoes(signal)]);
    if (sequencia === sequenciaItens.current && !signal?.aborted) aplicar((anterior) => ({ ...anterior, carregando: false }));
  }, [aplicar, atualizarMovimentacoes, servico, sessao]);

  useEffect(() => {
    const controle = new AbortController();
    void atualizarEstoque(controle.signal);
    return () => controle.abort();
  }, [atualizarEstoque]);

  const aplicarItem = useCallback((item: ItemEstoque) => {
    // Consultas iniciadas antes desta gravação não podem substituir seu resultado.
    ++sequenciaItens.current;
    aplicar((anterior) => ({ ...anterior, carregando: false, itens: ordenarItens([item, ...anterior.itens.filter((atual) => atual.id !== item.id)]) }));
  }, [aplicar]);

  const alterarItem = useCallback(async (itemId: string, acao: () => Promise<ResultadoAcaoEstoque>): Promise<ResultadoAcaoEstoque> => {
    if (!sessao.empresaId || sessaoAtiva.current !== sessao) return { sucesso: false, mensagem: "Autenticação obrigatória." };
    if (itensEmAlteracao.has(itemId)) return { sucesso: false, mensagem: "Aguarde a conclusão da alteração anterior deste item." };
    itensEmAlteracao.add(itemId);
    try { return await acao(); }
    finally { itensEmAlteracao.delete(itemId); }
  }, [itensEmAlteracao, sessao]);

  const cadastrarItem = useCallback(async (entrada: CadastroItemEstoque): Promise<ResultadoAcaoEstoque> => {
    if (!sessao.empresaId || sessaoAtiva.current !== sessao) return { sucesso: false, mensagem: "Autenticação obrigatória." };
    let item: ItemEstoque;
    try {
      const resposta = await servico.cadastrarItem({ ...entrada, name: entrada.name.trim() });
      item = resposta.item;
    } catch (erro) {
      return { sucesso: false, mensagem: mensagemErro(erro, "Não foi possível cadastrar o item.") };
    }
    if (sessaoAtiva.current === sessao) {
      const precisaCompletarLista = sessaoComListaCompleta.current !== sessao;
      aplicarItem(item);
      // Recarrega a lista completa: um GET inicial anterior pode ter sido invalidado.
      // O cadastro já foi confirmado; falha desta consulta fica no estado de leitura.
      if (precisaCompletarLista) await atualizarEstoque();
      else await atualizarMovimentacoes();
    }
    return { sucesso: true, mensagem: "Item cadastrado com sucesso." };
  }, [aplicarItem, atualizarEstoque, atualizarMovimentacoes, servico, sessao]);

  const atualizarItem = useCallback((entrada: AtualizacaoItemEstoque & { itemId: string }) => alterarItem(entrada.itemId, async () => {
    try {
      const { itemId, ...campos } = entrada;
      const resposta = await servico.atualizarItem(itemId, { ...campos, ...(campos.name === undefined ? {} : { name: campos.name.trim() }) });
      if (sessaoAtiva.current === sessao) aplicarItem(resposta.item);
      return { sucesso: true, mensagem: "Item atualizado com sucesso." };
    } catch (erro) {
      return { sucesso: false, mensagem: mensagemErro(erro, "Não foi possível atualizar o item.") };
    }
  }), [alterarItem, aplicarItem, servico, sessao]);

  const registrarMovimentacao = useCallback((entrada: RegistroMovimentacaoEstoque) => alterarItem(entrada.itemId, async () => {
    try {
      const resposta = await servico.registrarMovimentacao(entrada);
      if (sessaoAtiva.current === sessao) {
        aplicarItem(resposta.item);
        ++sequenciaMovimentacoes.current;
        aplicar((anterior) => ({ ...anterior, movimentacoes: ordenarMovimentacoes([resposta.movement, ...anterior.movimentacoes.filter((atual) => atual.id !== resposta.movement.id)]) }));
      }
      return { sucesso: true, mensagem: entrada.type === "entrada" ? "Entrada registrada com sucesso." : "Saída registrada com sucesso." };
    } catch (erro) {
      return { sucesso: false, mensagem: mensagemErro(erro, "Não foi possível registrar a movimentação.") };
    }
  }), [alterarItem, aplicar, aplicarItem, servico, sessao]);

  const desativarItem = useCallback((itemId: string) => alterarItem(itemId, async () => {
    try {
      const resposta = await servico.desativarItem(itemId);
      if (sessaoAtiva.current === sessao) {
        ++sequenciaItens.current;
        aplicar((anterior) => ({ ...anterior, carregando: false, itens: anterior.itens.filter((item) => item.id !== itemId) }));
      }
      return { sucesso: true, mensagem: resposta.closedAds > 0 ? "Item desativado e anúncios vinculados encerrados." : "Item desativado com sucesso." };
    } catch (erro) {
      return { sucesso: false, mensagem: mensagemErro(erro, "Não foi possível desativar o item.") };
    }
  }), [alterarItem, aplicar, servico, sessao]);

  const dados = estado.sessao === sessao ? estado : estadoInicial(sessao);
  return { itens: dados.itens, movimentacoes: dados.movimentacoes, carregando: dados.carregando, erro: dados.erro, erroMovimentacoes: dados.erroMovimentacoes, atualizarEstoque, cadastrarItem, atualizarItem, registrarMovimentacao, desativarItem };
}
