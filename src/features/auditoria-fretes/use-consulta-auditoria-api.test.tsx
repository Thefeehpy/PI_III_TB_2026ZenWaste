import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { criarServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";
import { freteSintetico, listaFretesSintetica } from "@/test/fixtures/fretes";
import type { FreteDetalheDTO, ListaFretesDTO } from "./tipos-api";

beforeEach(() => localStorage.clear());
function servicoSintetico() {
  const servico = criarServicoHttpAuditoriaFretes();
  vi.spyOn(servico, "listar").mockResolvedValue(listaFretesSintetica());
  vi.spyOn(servico, "listarPedidosDisponiveis").mockResolvedValue({
    resultados: [],
    paginacao: { pagina: 1, tamanho_pagina: 6, total: 0, total_paginas: 1 },
  });
  vi.spyOn(servico, "listarDemandas").mockResolvedValue({
    resultados: [],
    paginacao: { pagina: 1, tamanho_pagina: 6, total: 0, total_paginas: 1 },
  });
  vi.spyOn(servico, "obter").mockResolvedValue(freteSintetico());
  return servico;
}

it("não substitui falha de leitura por fretes demonstrativos", async () => {
  const servico = servicoSintetico();
  vi.mocked(servico.listar).mockRejectedValue(
    new Error("Consulta indisponível"),
  );
  const { result: resultado } = renderHook(() =>
    useConsultaAuditoriaApi("1", true, servico),
  );
  await waitFor(() =>
    expect(resultado.current.erro).toBe("Consulta indisponível"),
  );
  expect(resultado.current.fretes).toBeNull();
});

it("ignora resposta atrasada da empresa anterior", async () => {
  const servico = servicoSintetico();
  let resolver: (valor: ListaFretesDTO) => void;
  vi.mocked(servico.listar).mockImplementationOnce(
    () =>
      new Promise((concluir) => {
        resolver = concluir;
      }),
  );
  const { result: resultado, rerender: renderizar } = renderHook(
    ({ empresa }) => useConsultaAuditoriaApi(empresa, true, servico),
    { initialProps: { empresa: "1" } },
  );
  renderizar({ empresa: "2" });
  await waitFor(() => expect(resultado.current.fretes).not.toBeNull());
  await act(async () =>
    resolver({
      ...listaFretesSintetica(),
      resultados: [freteSintetico({ material: "Resposta antiga" })],
    }),
  );
  expect(resultado.current.fretes.resultados[0].material).toBe(
    "Material sintético",
  );
});

it("evita dois comandos simultâneos e preserva sucesso se a recarga falhar", async () => {
  const servico = servicoSintetico();
  const { result: resultado } = renderHook(() =>
    useConsultaAuditoriaApi("1", true, servico),
  );
  await waitFor(() => expect(resultado.current.carregando).toBe(false));
  let resolver: (valor: FreteDetalheDTO) => void;
  const comando = vi.fn(
    () =>
      new Promise<FreteDetalheDTO>((concluir) => {
        resolver = concluir;
      }),
  );
  let primeira: Promise<FreteDetalheDTO>;
  act(() => {
    primeira = resultado.current.executar(comando);
  });
  expect(await resultado.current.executar(comando)).toBeNull();
  vi.mocked(servico.listar).mockRejectedValue(new Error("Falha na recarga"));
  await act(async () => {
    resolver(freteSintetico());
    await primeira;
  });
  expect(comando).toHaveBeenCalledTimes(1);
  expect(resultado.current.erroComando).toBeNull();
  await waitFor(() => expect(resultado.current.erro).toBe("Falha na recarga"));
});

it("não deixa detalhe antigo sobrescrever a seleção mais recente", async () => {
  const servico = servicoSintetico();
  let resolver: (valor: FreteDetalheDTO) => void;
  vi.mocked(servico.obter).mockImplementationOnce(
    () =>
      new Promise((concluir) => {
        resolver = concluir;
      }),
  );
  const { result: resultado } = renderHook(() =>
    useConsultaAuditoriaApi("1", true, servico),
  );
  await waitFor(() => expect(resultado.current.carregando).toBe(false));
  let primeira: Promise<void>;
  act(() => {
    primeira = resultado.current.abrirDetalhe("antigo");
  });
  await act(async () => resultado.current.abrirDetalhe(freteSintetico().id));
  await act(async () => {
    resolver(freteSintetico({ id: "antigo" }));
    await primeira;
  });
  expect(resultado.current.detalhe.id).toBe(freteSintetico().id);
});

it("isola a trava de comandos por sessão durante troca de empresa", async () => {
  const servico = servicoSintetico();
  let concluirAntigo: (valor: FreteDetalheDTO) => void;
  let concluirNovo: (valor: FreteDetalheDTO) => void;
  const antigo = vi.fn(
    () =>
      new Promise<FreteDetalheDTO>((concluir) => {
        concluirAntigo = concluir;
      }),
  );
  const novo = vi.fn(
    () =>
      new Promise<FreteDetalheDTO>((concluir) => {
        concluirNovo = concluir;
      }),
  );
  const { result: resultado, rerender: renderizar } = renderHook(
    ({ empresa }) => useConsultaAuditoriaApi(empresa, true, servico),
    { initialProps: { empresa: "1" } },
  );
  await waitFor(() => expect(resultado.current.carregando).toBe(false));
  let primeira: Promise<FreteDetalheDTO>;
  act(() => {
    primeira = resultado.current.executar(antigo);
  });
  renderizar({ empresa: "2" });
  let segunda: Promise<FreteDetalheDTO>;
  act(() => {
    segunda = resultado.current.executar(novo);
  });
  expect(novo).toHaveBeenCalledTimes(1);
  await act(async () => {
    concluirAntigo(freteSintetico());
    expect(await primeira).toBeNull();
  });
  expect(resultado.current.executando).toBe(true);
  expect(await resultado.current.executar(novo)).toBeNull();
  await act(async () => {
    concluirNovo(freteSintetico());
    await segunda;
  });
  expect(resultado.current.executando).toBe(false);
});
