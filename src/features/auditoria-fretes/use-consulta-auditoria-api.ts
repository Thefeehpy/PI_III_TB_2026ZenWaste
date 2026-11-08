import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { criarServicoHttpAuditoriaFretes, type ServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import type { ConsultaFretes, EmpresaFreteDTO, FreteDetalheDTO, ListaDemandasFreteDTO, ListaFretesDTO, ListaPedidosFreteDTO } from "./tipos-api";

const consultaInicial: ConsultaFretes = { pagina: 1, tamanho_pagina: 10 };
type Sessao = { empresaId: string | null; servico: ServicoHttpAuditoriaFretes };
type Estado = {
  sessao: Sessao;
  consulta: ConsultaFretes;
  paginaPedidos: number;
  paginaDemandas: number;
  fretes: ListaFretesDTO | null;
  pedidos: ListaPedidosFreteDTO | null;
  demandas: ListaDemandasFreteDTO | null;
  compradoras: EmpresaFreteDTO[];
  transportadoras: EmpresaFreteDTO[];
  detalhe: FreteDetalheDTO | null;
  idSelecionado: string | null;
  carregando: boolean;
  carregandoDetalhe: boolean;
  executando: boolean;
  erro: string | null;
  erroDetalhe: string | null;
  erroComando: string | null;
};
function iniciarEstado(sessao: Sessao): Estado {
  return {
    sessao, consulta: consultaInicial, paginaPedidos: 1, paginaDemandas: 1,
    fretes: null, pedidos: null, demandas: null, compradoras: [], transportadoras: [],
    detalhe: null, idSelecionado: null, carregando: Boolean(sessao.empresaId), carregandoDetalhe: false,
    executando: false, erro: null, erroDetalhe: null, erroComando: null,
  };
}
function mensagemFalha(erro: unknown, alternativa: string) { return erro instanceof Error ? erro.message : alternativa; }

/** Sessão, página e seleção fazem parte da consulta; nenhuma página é buscada implicitamente. */
export function useConsultaAuditoriaApi(empresaId: string | null, podeCadastrar: boolean, servicoFornecido?: ServicoHttpAuditoriaFretes) {
  const servico = useMemo(() => servicoFornecido ?? criarServicoHttpAuditoriaFretes(), [empresaId, servicoFornecido]);
  const sessao = useMemo(() => ({ empresaId, servico }), [empresaId, servico]);
  const ativa = useRef<Sessao | null>(sessao);
  const sequenciaLista = useRef(0);
  const sequenciaDetalhe = useRef(0);
  const comandoEmAndamento = useRef(false);
  const [estado, definirEstado] = useState(() => iniciarEstado(sessao));
  const dados = estado.sessao === sessao ? estado : iniciarEstado(sessao);
  const { consulta, paginaPedidos, paginaDemandas } = dados;
  const selecaoAtual = useRef(dados.idSelecionado);
  useLayoutEffect(() => {
    ativa.current = sessao;
    return () => { ativa.current = null; };
  }, [sessao]);
  useLayoutEffect(() => { selecaoAtual.current = dados.idSelecionado; }, [dados.idSelecionado]);

  const aplicar = useCallback((alterar: (anterior: Estado) => Estado) => {
    if (ativa.current !== sessao) return;
    definirEstado((anterior) => ativa.current === sessao ? alterar(anterior.sessao === sessao ? anterior : iniciarEstado(sessao)) : anterior);
  }, [sessao]);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    if (!sessao.empresaId) return;
    const sequencia = ++sequenciaLista.current;
    aplicar((anterior) => ({ ...anterior, carregando: true }));
    const [fretes, pedidos, demandas, compradoras, transportadoras] = await Promise.allSettled([
      servico.listar(consulta, sinal),
      podeCadastrar ? servico.listarPedidosDisponiveis(paginaPedidos, 6, sinal) : Promise.resolve(null),
      servico.listarDemandas(paginaDemandas, 6, sinal),
      podeCadastrar ? servico.listarCompradoras("", sinal) : Promise.resolve({ resultados: [] as EmpresaFreteDTO[] }),
      podeCadastrar ? servico.listarTransportadoras("", sinal) : Promise.resolve({ resultados: [] as EmpresaFreteDTO[] }),
    ]);
    if (sinal?.aborted || sequencia !== sequenciaLista.current || ativa.current !== sessao) return;
    const falha = [fretes, pedidos, demandas, compradoras, transportadoras].find((resultado) => resultado.status === "rejected");
    aplicar((anterior) => sequencia === sequenciaLista.current ? {
      ...anterior,
      fretes: fretes.status === "fulfilled" ? fretes.value : anterior.fretes,
      pedidos: pedidos.status === "fulfilled" ? pedidos.value : anterior.pedidos,
      demandas: demandas.status === "fulfilled" ? demandas.value : anterior.demandas,
      compradoras: compradoras.status === "fulfilled" ? compradoras.value.resultados : anterior.compradoras,
      transportadoras: transportadoras.status === "fulfilled" ? transportadoras.value.resultados : anterior.transportadoras,
      carregando: false,
      erro: falha?.status === "rejected" ? mensagemFalha(falha.reason, "Não foi possível atualizar a auditoria.") : null,
    } : anterior);
  }, [aplicar, consulta, paginaPedidos, paginaDemandas, podeCadastrar, servico, sessao]);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  const abrirDetalhe = useCallback(async (id: string) => {
    const sequencia = ++sequenciaDetalhe.current;
    selecaoAtual.current = id;
    aplicar((anterior) => ({ ...anterior, idSelecionado: id, detalhe: anterior.detalhe?.id === id ? anterior.detalhe : null, carregandoDetalhe: true, erroDetalhe: null, erroComando: null }));
    try {
      const detalhe = await servico.obter(id);
      if (sequencia === sequenciaDetalhe.current) aplicar((anterior) => ({ ...anterior, detalhe, carregandoDetalhe: false }));
    } catch (falha) {
      if (sequencia === sequenciaDetalhe.current) aplicar((anterior) => ({ ...anterior, carregandoDetalhe: false, erroDetalhe: mensagemFalha(falha, "Não foi possível carregar o frete.") }));
    }
  }, [aplicar, servico]);

  const executar = useCallback(async (comando: (integracao: ServicoHttpAuditoriaFretes) => Promise<FreteDetalheDTO>) => {
    if (!sessao.empresaId || ativa.current !== sessao || comandoEmAndamento.current) return null;
    comandoEmAndamento.current = true;
    aplicar((anterior) => ({ ...anterior, executando: true, erroComando: null }));
    try {
      const resultado = await comando(servico);
      if (ativa.current !== sessao) return null;
      if (selecaoAtual.current === resultado.id) {
        ++sequenciaDetalhe.current;
        aplicar((anterior) => ({ ...anterior, detalhe: resultado, carregandoDetalhe: false, erroDetalhe: null }));
      }
      // O comando foi confirmado. Falha posterior de leitura não transforma sucesso em falha.
      void carregar();
      return resultado;
    } catch (falha) {
      aplicar((anterior) => ({ ...anterior, erroComando: mensagemFalha(falha, "Não foi possível concluir a operação.") }));
      return null;
    } finally {
      comandoEmAndamento.current = false;
      aplicar((anterior) => ({ ...anterior, executando: false }));
    }
  }, [aplicar, carregar, servico, sessao]);

  const alterarConsulta = useCallback((campos: Partial<ConsultaFretes>) => aplicar((anterior) => ({
    ...anterior, consulta: { ...anterior.consulta, pagina: 1, ...campos },
  })), [aplicar]);
  return {
    ...dados, abrirDetalhe, executar, recarregar: () => carregar(), alterarConsulta,
    alterarPaginaPedidos: (pagina: number) => aplicar((anterior) => ({ ...anterior, paginaPedidos: pagina })),
    alterarPaginaDemandas: (pagina: number) => aplicar((anterior) => ({ ...anterior, paginaDemandas: pagina })),
    informarErroComando: (erroComando: string | null) => aplicar((anterior) => ({ ...anterior, erroComando })),
  };
}
