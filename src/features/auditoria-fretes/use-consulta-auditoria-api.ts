import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  criarServicoHttpAuditoriaFretes,
  type ServicoHttpAuditoriaFretes,
} from "./servico-http-auditoria-fretes";
import { ErroApi, obterTokenAutenticacao } from "@/services/cliente-http";
import type {
  ConsultaFretes,
  FreteDetalheDTO,
  ListaDemandasFreteDTO,
  ListaFretesDTO,
  ListaPedidosFreteDTO,
} from "./tipos-api";

import { ErroProtecaoFrete } from "./intencoes-frete";
import { mensagemErroFrete } from "./validacoes";

const consultaInicial: ConsultaFretes = { pagina: 1, tamanho_pagina: 10 };
type Sessao = { empresaId: string | null; servico: ServicoHttpAuditoriaFretes };
export type ResultadoOperacaoFrete = {
  estado: "nao_iniciada" | "em_andamento" | "confirmada" | "rejeitada" | "incerta" | "bloqueada";
  descricao: string; freteId: string | null;
};
type Estado = {
  sessao: Sessao;
  consulta: ConsultaFretes;
  paginaPedidos: number;
  paginaDemandas: number;
  fretes: ListaFretesDTO | null;
  pedidos: ListaPedidosFreteDTO | null;
  demandas: ListaDemandasFreteDTO | null;
  detalhe: FreteDetalheDTO | null;
  idSelecionado: string | null;
  carregando: boolean;
  carregandoDetalhe: boolean;
  executando: boolean;
  erro: string | null;
  erroDetalhe: string | null;
  erroComando: string | null;
  erroPedidos: string | null;
  operacao: ResultadoOperacaoFrete;
};
function iniciarEstado(sessao: Sessao): Estado {
  return {
    sessao,
    consulta: consultaInicial,
    paginaPedidos: 1,
    paginaDemandas: 1,
    fretes: null,
    pedidos: null,
    demandas: null,
    detalhe: null,
    idSelecionado: null,
    carregando: Boolean(sessao.empresaId),
    carregandoDetalhe: false,
    executando: false,
    erro: null,
    erroDetalhe: null,
    erroComando: null,
    erroPedidos: null,
    operacao: { estado: "nao_iniciada", descricao: "", freteId: null },
  };
}
function mensagemFalha(erro: unknown, alternativa: string) {
  return erro instanceof Error ? erro.message : alternativa;
}

/** Sessão, página e seleção fazem parte da consulta; nenhuma página é buscada implicitamente. */
export function useConsultaAuditoriaApi(
  empresaId: string | null,
  podeCadastrar: boolean,
  servicoFornecido?: ServicoHttpAuditoriaFretes,
  aoSessaoInvalida?: () => void,
) {
  const sessaoInvalida = useRef(aoSessaoInvalida);
  useLayoutEffect(() => { sessaoInvalida.current = aoSessaoInvalida; }, [aoSessaoInvalida]);
  const tokenSessao = obterTokenAutenticacao();
  const sessao = useMemo(
    () => ({
      empresaId,
      servico: servicoFornecido ?? criarServicoHttpAuditoriaFretes(tokenSessao, empresaId ? { empresaId } : undefined),
    }),
    [empresaId, servicoFornecido, tokenSessao],
  );
  const servico = sessao.servico;
  const ativa = useRef<Sessao | null>(sessao);
  const sequenciaLista = useRef(0);
  const sequenciaDetalhe = useRef(0);
  const comandoEmAndamento = useRef<Sessao | null>(null);
  const [estado, definirEstado] = useState(() => iniciarEstado(sessao));
  const dados = estado.sessao === sessao ? estado : iniciarEstado(sessao);
  const { consulta, paginaPedidos, paginaDemandas } = dados;
  const selecaoAtual = useRef(dados.idSelecionado);
  useLayoutEffect(() => {
    ativa.current = sessao;
    return () => {
      ativa.current = null;
    };
  }, [sessao]);
  useLayoutEffect(() => {
    selecaoAtual.current = dados.idSelecionado;
  }, [dados.idSelecionado]);

  const aplicar = useCallback(
    (alterar: (anterior: Estado) => Estado) => {
      if (ativa.current !== sessao) return;
      definirEstado((anterior) =>
        ativa.current === sessao
          ? alterar(
              anterior.sessao === sessao ? anterior : iniciarEstado(sessao),
            )
          : anterior,
      );
    },
    [sessao],
  );

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      if (!sessao.empresaId) return;
      const sequencia = ++sequenciaLista.current;
      aplicar((anterior) => ({ ...anterior, carregando: true }));
      const [fretes, pedidos, demandas] = await Promise.allSettled([
        servico.listar(consulta, sinal),
        podeCadastrar
          ? servico.listarPedidosDisponiveis(paginaPedidos, 6, sinal)
          : Promise.resolve(null),
        servico.listarDemandas(paginaDemandas, 6, sinal),
      ]);
      if (
        sinal?.aborted ||
        sequencia !== sequenciaLista.current ||
        ativa.current !== sessao
      )
        return;
      for (const resultado of [fretes, pedidos, demandas]) {
        if (resultado.status === "rejected" && resultado.reason instanceof ErroApi && resultado.reason.status === 401) {
          sessaoInvalida.current?.();
          break;
        }
      }
      const falha = [fretes, pedidos, demandas].find(
        (resultado) => resultado.status === "rejected",
      );
      aplicar((anterior) =>
        sequencia === sequenciaLista.current
          ? {
              ...anterior,
              fretes:
                fretes.status === "fulfilled" ? fretes.value : anterior.fretes,
              pedidos:
                pedidos.status === "fulfilled"
                  ? pedidos.value
                  : anterior.pedidos,
              demandas:
                demandas.status === "fulfilled"
                  ? demandas.value
                  : anterior.demandas,
              erroPedidos: pedidos.status === "rejected" ? mensagemFalha(pedidos.reason, "Não foi possível consultar os pedidos.") : null,
              carregando: false,
              erro:
                falha?.status === "rejected"
                  ? mensagemFalha(
                      falha.reason,
                      "Não foi possível atualizar a auditoria.",
                    )
                  : null,
            }
          : anterior,
      );
    },
    [
      aplicar,
      consulta,
      paginaPedidos,
      paginaDemandas,
      podeCadastrar,
      servico,
      sessao,
    ],
  );

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  const abrirDetalhe = useCallback(
    async (id: string) => {
      const sequencia = ++sequenciaDetalhe.current;
      selecaoAtual.current = id;
      aplicar((anterior) => ({
        ...anterior,
        idSelecionado: id,
        detalhe: anterior.detalhe?.id === id ? anterior.detalhe : null,
        carregandoDetalhe: true,
        erroDetalhe: null,
        erroComando: null,
      }));
      try {
        const detalhe = await servico.obter(id);
        if (sequencia === sequenciaDetalhe.current)
          aplicar((anterior) => ({
            ...anterior,
            detalhe,
            carregandoDetalhe: false,
          }));
      } catch (falha) {
        if (sequencia === sequenciaDetalhe.current && ativa.current === sessao && falha instanceof ErroApi && falha.status === 401) sessaoInvalida.current?.();
        if (sequencia === sequenciaDetalhe.current)
          aplicar((anterior) => ({
            ...anterior,
            carregandoDetalhe: false,
            erroDetalhe: mensagemFalha(
              falha,
              "Não foi possível carregar o frete.",
            ),
          }));
      }
    },
    [aplicar, servico, sessao],
  );

  const executar = useCallback(
    async (
      comando: (
        integracao: ServicoHttpAuditoriaFretes,
      ) => Promise<FreteDetalheDTO>,
      aoFalhar?: (erro: unknown) => boolean | void,
      descricao = "Operação",
    ) => {
      if (
        !sessao.empresaId ||
        ativa.current !== sessao ||
        comandoEmAndamento.current === sessao
      )
        return null;
      comandoEmAndamento.current = sessao;
      aplicar((anterior) => ({
        ...anterior,
        executando: true,
        erroComando: null,
        operacao: { estado: "em_andamento", descricao, freteId: selecaoAtual.current },
      }));
      try {
        const resultado = await comando(servico);
        if (ativa.current !== sessao) return null;
        aplicar(anterior => ({ ...anterior, operacao: { estado: "confirmada", descricao, freteId: resultado.id } }));
        if (selecaoAtual.current === resultado.id) {
          ++sequenciaDetalhe.current;
          aplicar((anterior) => ({
            ...anterior,
            detalhe: resultado,
            carregandoDetalhe: false,
            erroDetalhe: null,
          }));
        }
        // O comando foi confirmado. Falha posterior de leitura não transforma sucesso em falha.
        if (
          (consulta.pagina ?? 1) > 1 ||
          paginaPedidos > 1 ||
          paginaDemandas > 1
        ) {
          aplicar((anterior) => ({
            ...anterior,
            consulta: { ...anterior.consulta, pagina: 1 },
            paginaPedidos: 1,
            paginaDemandas: 1,
          }));
        } else void carregar();
        return resultado;
      } catch (falha) {
        if (ativa.current !== sessao) return null;
        const porCampo = aoFalhar?.(falha);
        if (falha instanceof ErroApi && falha.status === 401) sessaoInvalida.current?.();
        aplicar((anterior) => ({ ...anterior, erroComando: porCampo ? null : mensagemErroFrete(falha),
          operacao: { descricao, freteId: selecaoAtual.current,
            estado: falha instanceof ErroProtecaoFrete ? "bloqueada" : falha instanceof ErroApi && falha.status >= 400 && falha.status < 500 ? "rejeitada" : "incerta" },
        }));
        return null;
      } finally {
        if (comandoEmAndamento.current === sessao)
          comandoEmAndamento.current = null;
        aplicar((anterior) => ({ ...anterior, executando: false }));
      }
    },
    [
      aplicar,
      carregar,
      servico,
      sessao,
      consulta.pagina,
      paginaPedidos,
      paginaDemandas,
    ],
  );

  const alterarConsulta = useCallback(
    (campos: Partial<ConsultaFretes>) =>
      aplicar((anterior) => ({
        ...anterior,
        consulta: { ...anterior.consulta, pagina: 1, ...campos },
      })),
    [aplicar],
  );
  const consultarEmpresas = useCallback(async (
    tipo: "listarCompradoras" | "listarTransportadoras",
    busca?: string, sinal?: AbortSignal, pagina?: number,
  ) => {
    try { return await servico[tipo](busca, sinal, pagina); }
    catch (erro) {
      if (!sinal?.aborted && ativa.current === sessao && erro instanceof ErroApi && erro.status === 401)
        sessaoInvalida.current?.();
      throw erro;
    }
  }, [servico, sessao]);
  const consultarCompradoras = useCallback((busca?: string, sinal?: AbortSignal, pagina?: number) =>
    consultarEmpresas("listarCompradoras", busca, sinal, pagina), [consultarEmpresas]);
  const consultarTransportadoras = useCallback((busca?: string, sinal?: AbortSignal, pagina?: number) =>
    consultarEmpresas("listarTransportadoras", busca, sinal, pagina), [consultarEmpresas]);
  return {
    ...dados,
    abrirDetalhe,
    adotarDetalhe: (detalhe: FreteDetalheDTO) => {
      if (ativa.current !== sessao) return;
      ++sequenciaDetalhe.current;
      selecaoAtual.current = detalhe.id;
      aplicar(anterior => ({ ...anterior, detalhe, idSelecionado: detalhe.id, carregandoDetalhe: false, erroDetalhe: null }));
    },
    executar,
    recarregar: () => carregar(),
    alterarConsulta,
    consultarCompradoras,
    consultarTransportadoras,
    alterarPaginaPedidos: (pagina: number) =>
      aplicar((anterior) => ({ ...anterior, paginaPedidos: pagina })),
    alterarPaginaDemandas: (pagina: number) =>
      aplicar((anterior) => ({ ...anterior, paginaDemandas: pagina })),
    informarErroComando: (erroComando: string | null) =>
      aplicar((anterior) => ({ ...anterior, erroComando })),
  };
}
