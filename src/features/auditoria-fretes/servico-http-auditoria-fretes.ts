import {
  ErroApi,
  obterTokenAutenticacao,
  requisitar,
} from "@/services/cliente-http";
import type {
  CadastroCotacaoFreteDTO,
  CadastroFreteDTO,
  ClassificacaoFreteDTO,
  ConfirmacaoEntregaFreteDTO,
  ConsultaFretes,
  ListaEmpresasFreteDTO,
  FreteDetalheDTO,
  ListaFretesDTO,
  ListaPedidosFreteDTO,
  ListaDemandasFreteDTO,
  PublicacaoDemandaFreteDTO,
  RegistroCTeDTO,
} from "./tipos-api";

function parametrosConsulta(
  consulta: Record<string, string | number | undefined>,
) {
  const parametros = new URLSearchParams();
  Object.entries(consulta).forEach(([campo, valor]) => {
    if (valor !== undefined && valor !== "")
      parametros.set(campo, String(valor));
  });
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}

function serializarOrdenado(valor: unknown): string {
  if (Array.isArray(valor))
    return `[${valor.map(serializarOrdenado).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.entries(valor as Record<string, unknown>)
      .filter(([, conteudo]) => conteudo !== undefined)
      .sort(([primeiro], [segundo]) => primeiro.localeCompare(segundo))
      .map(
        ([campo, conteudo]) =>
          `${JSON.stringify(campo)}:${serializarOrdenado(conteudo)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(valor);
}

async function resumoOperacao(caminho: string, entrada: unknown) {
  const dados = new TextEncoder().encode(
    `${caminho}\n${serializarOrdenado(entrada)}`,
  );
  const resumo = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(resumo), (valor) =>
    valor.toString(16).padStart(2, "0"),
  ).join("");
}

/** Uma instância por sessão. Retém somente chaves de comandos incertos, sem registrar payloads. */
export function criarServicoHttpAuditoriaFretes(
  tokenSessao = obterTokenAutenticacao(),
) {
  function exigirSessao() {
    if (obterTokenAutenticacao() !== tokenSessao)
      throw new ErroApi(
        "A sessão mudou. Atualize a auditoria antes de enviar a operação.",
        409,
      );
  }
  function consultar<T>(caminho: string, sinal?: AbortSignal) {
    exigirSessao();
    return requisitar<T>(caminho, { signal: sinal });
  }
  const chavesPendentes = new Map<string, string>();
  const comandosEmAndamento = new Map<string, Promise<FreteDetalheDTO>>();
  const detalhe = (id: string) => `/fretes/${encodeURIComponent(id)}/`;

  async function executarComando(
    caminho: string,
    entrada: unknown,
  ): Promise<FreteDetalheDTO> {
    const resumo = await resumoOperacao(caminho, entrada);
    exigirSessao();
    const pendente = comandosEmAndamento.get(resumo);
    if (pendente) return pendente;
    const chave = chavesPendentes.get(resumo) ?? crypto.randomUUID();
    chavesPendentes.set(resumo, chave);
    const operacao = (async () => {
      try {
        const resposta = await requisitar<FreteDetalheDTO>(caminho, {
          method: "POST",
          headers: { "Idempotency-Key": chave },
          body: JSON.stringify(entrada),
        });
        chavesPendentes.delete(resumo);
        return resposta;
      } catch (erro) {
        // Em falhas de transporte/5xx, a gravação pode ter acontecido no servidor.
        if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500)
          chavesPendentes.delete(resumo);
        throw erro;
      } finally {
        comandosEmAndamento.delete(resumo);
      }
    })();
    comandosEmAndamento.set(resumo, operacao);
    return operacao;
  }

  return {
    listar(consulta: ConsultaFretes = {}, sinal?: AbortSignal) {
      return consultar<ListaFretesDTO>(
        `/fretes/${parametrosConsulta({ ...consulta })}`,
        sinal,
      );
    },
    obter(id: string, sinal?: AbortSignal) {
      return consultar<FreteDetalheDTO>(detalhe(id), sinal);
    },
    listarPedidosDisponiveis(
      pagina = 1,
      tamanhoPagina = 10,
      sinal?: AbortSignal,
    ) {
      return consultar<ListaPedidosFreteDTO>(
        `/fretes/pedidos-disponiveis/${parametrosConsulta({ pagina, tamanho_pagina: tamanhoPagina })}`,
        sinal,
      );
    },
    listarTransportadoras(busca = "", sinal?: AbortSignal, pagina = 1) {
      return consultar<ListaEmpresasFreteDTO>(
        `/fretes/transportadoras/${parametrosConsulta({ busca, pagina })}`,
        sinal,
      );
    },
    listarCompradoras(busca = "", sinal?: AbortSignal, pagina = 1) {
      return consultar<ListaEmpresasFreteDTO>(
        `/fretes/compradoras/${parametrosConsulta({ busca, pagina })}`,
        sinal,
      );
    },
    listarDemandas(pagina = 1, tamanhoPagina = 10, sinal?: AbortSignal) {
      return consultar<ListaDemandasFreteDTO>(
        `/fretes/demandas/${parametrosConsulta({ pagina, tamanho_pagina: tamanhoPagina })}`,
        sinal,
      );
    },
    cadastrar(entrada: CadastroFreteDTO) {
      return executarComando("/fretes/", entrada);
    },
    classificar(id: string, entrada: ClassificacaoFreteDTO) {
      return executarComando(`${detalhe(id)}classificar/`, entrada);
    },
    registrarCotacao(id: string, entrada: CadastroCotacaoFreteDTO) {
      return executarComando(`${detalhe(id)}cotacoes/`, entrada);
    },
    aprovarCotacao(id: string, cotacaoId: string) {
      return executarComando(`${detalhe(id)}aprovar-cotacao/`, {
        cotacao_id: cotacaoId,
      });
    },
    registrarCTe(id: string, entrada: RegistroCTeDTO) {
      return executarComando(`${detalhe(id)}registrar-cte/`, entrada);
    },
    resolverDivergencia(id: string, justificativa: string) {
      return executarComando(`${detalhe(id)}resolver-divergencia/`, {
        justificativa,
      });
    },
    cancelar(id: string, justificativa: string) {
      return executarComando(`${detalhe(id)}cancelar/`, { justificativa });
    },
    registrarTratativa(id: string, observacao: string) {
      return executarComando(`${detalhe(id)}tratativas/`, { observacao });
    },
    registrarRetirada(id: string, nomeFoto: string) {
      return executarComando(`${detalhe(id)}retirada/`, {
        nome_foto: nomeFoto,
      });
    },
    confirmarEntrega(id: string, entrada: ConfirmacaoEntregaFreteDTO) {
      return executarComando(`${detalhe(id)}confirmar-entrega/`, entrada);
    },
    publicarDemanda(id: string, entrada: PublicacaoDemandaFreteDTO) {
      return executarComando(`${detalhe(id)}publicar-demanda/`, entrada);
    },
  };
}

export type ServicoHttpAuditoriaFretes = ReturnType<
  typeof criarServicoHttpAuditoriaFretes
>;
