import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { servicoAnuncios } from "@/services/servico-anuncios";
import type { Anuncio, AnuncioVendedor, CadastroAnuncio } from "@/types/anuncio";

interface SessaoAnuncios { empresaId: string | null }
interface EstadoAnuncios {
  sessao: SessaoAnuncios;
  anuncios: Anuncio[];
  anunciosEmpresa: AnuncioVendedor[];
  carregando: boolean;
  carregandoEmpresa: boolean;
  erro: string | null;
  erroEmpresa: string | null;
  anunciosEmAlteracao: string[];
}
export interface ResultadoAcaoAnuncio { sucesso: boolean; mensagem?: string }

function estadoInicial(sessao: SessaoAnuncios): EstadoAnuncios {
  return { sessao, anuncios: [], anunciosEmpresa: [], carregando: true, carregandoEmpresa: Boolean(sessao.empresaId), erro: null, erroEmpresa: null, anunciosEmAlteracao: [] };
}
function mensagemErro(erro: unknown, alternativa: string) {
  return erro instanceof Error ? erro.message : alternativa;
}

/** Consultas e gravações compartilham a sessão, impedindo respostas de outra empresa. */
export function useGestaoAnuncios(
  empresaId: string | null,
  atualizarEstoque: () => Promise<void>,
  servico = servicoAnuncios,
) {
  const sessao = useMemo(() => ({ empresaId }), [empresaId]);
  const sessaoAtiva = useRef<SessaoAnuncios | null>(sessao);
  const sequenciaPublica = useRef(0);
  const sequenciaEmpresa = useRef(0);
  const sessaoComListaPublica = useRef<SessaoAnuncios | null>(null);
  const alteracoes = useRef(new Map<string, object>());
  const [estado, definirEstado] = useState(() => estadoInicial(sessao));

  useLayoutEffect(() => {
    sessaoAtiva.current = sessao;
    return () => { sessaoAtiva.current = null; };
  }, [sessao]);

  const aplicar = useCallback((alterar: (anterior: EstadoAnuncios) => EstadoAnuncios) => {
    if (sessaoAtiva.current !== sessao) return;
    definirEstado((anterior) => sessaoAtiva.current === sessao ? alterar(anterior.sessao === sessao ? anterior : estadoInicial(sessao)) : anterior);
  }, [sessao]);

  const atualizarAnuncios = useCallback(async () => {
    const sequencia = ++sequenciaPublica.current;
    aplicar((anterior) => sequencia === sequenciaPublica.current ? { ...anterior, carregando: true } : anterior);
    try {
      const resposta = await servico.listar();
      if (sequencia === sequenciaPublica.current && sessaoAtiva.current === sessao) {
        sessaoComListaPublica.current = sessao;
        aplicar((anterior) => sequencia === sequenciaPublica.current ? { ...anterior, anuncios: resposta.items, erro: null } : anterior);
      }
    } catch (erro) {
      if (sequencia === sequenciaPublica.current) aplicar((anterior) => sequencia === sequenciaPublica.current ? { ...anterior, erro: mensagemErro(erro, "Não foi possível carregar os anúncios.") } : anterior);
    } finally {
      if (sequencia === sequenciaPublica.current) aplicar((anterior) => sequencia === sequenciaPublica.current ? { ...anterior, carregando: false } : anterior);
    }
  }, [aplicar, servico, sessao]);

  const atualizarAnunciosEmpresa = useCallback(async () => {
    if (!sessao.empresaId) return;
    const sequencia = ++sequenciaEmpresa.current;
    aplicar((anterior) => sequencia === sequenciaEmpresa.current ? { ...anterior, carregandoEmpresa: true } : anterior);
    try {
      const resposta = await servico.listarDaEmpresa();
      if (sequencia === sequenciaEmpresa.current) aplicar((anterior) => sequencia === sequenciaEmpresa.current ? { ...anterior, anunciosEmpresa: resposta.items, erroEmpresa: null } : anterior);
    } catch (erro) {
      if (sequencia === sequenciaEmpresa.current) aplicar((anterior) => sequencia === sequenciaEmpresa.current ? { ...anterior, erroEmpresa: mensagemErro(erro, "Não foi possível carregar os anúncios da empresa.") } : anterior);
    } finally {
      if (sequencia === sequenciaEmpresa.current) aplicar((anterior) => sequencia === sequenciaEmpresa.current ? { ...anterior, carregandoEmpresa: false } : anterior);
    }
  }, [aplicar, servico, sessao]);

  useEffect(() => {
    void atualizarAnuncios();
    void atualizarAnunciosEmpresa();
  }, [atualizarAnuncios, atualizarAnunciosEmpresa]);

  const invalidarConsultasAnteriores = useCallback(() => {
    ++sequenciaPublica.current;
    ++sequenciaEmpresa.current;
  }, []);

  const criarAnuncio = useCallback(async (entrada: CadastroAnuncio): Promise<ResultadoAcaoAnuncio> => {
    if (!sessao.empresaId || sessaoAtiva.current !== sessao) return { sucesso: false, mensagem: "Autenticação obrigatória." };
    let anuncio: Anuncio;
    try {
      anuncio = (await servico.criar(entrada)).item;
    } catch (erro) {
      return { sucesso: false, mensagem: mensagemErro(erro, "Não foi possível publicar o anúncio.") };
    }
    if (sessaoAtiva.current === sessao) {
      invalidarConsultasAnteriores();
      aplicar((anterior) => ({ ...anterior, carregando: false, anuncios: [anuncio, ...anterior.anuncios.filter((atual) => atual.id !== anuncio.id)] }));
      // A publicação já foi confirmada. Falha desta consulta aparece no estado da lista.
      await Promise.all([atualizarAnuncios(), atualizarAnunciosEmpresa()]);
    }
    return { sucesso: true, mensagem: "Anúncio publicado com sucesso." };
  }, [aplicar, atualizarAnuncios, atualizarAnunciosEmpresa, invalidarConsultasAnteriores, servico, sessao]);

  const alterarAnuncio = useCallback(async (
    id: string,
    operacao: "desativar" | "finalizar",
    quantidade?: number,
  ): Promise<ResultadoAcaoAnuncio> => {
    if (!sessao.empresaId || sessaoAtiva.current !== sessao) return { sucesso: false, mensagem: "Autenticação obrigatória." };
    const chave = `${sessao.empresaId}:${id}`;
    if (alteracoes.current.has(chave)) return { sucesso: false, mensagem: "Aguarde a operação em andamento neste anúncio." };
    const alteracao = {};
    alteracoes.current.set(chave, alteracao);
    aplicar((anterior) => ({ ...anterior, anunciosEmAlteracao: [...anterior.anunciosEmAlteracao, id] }));
    try {
      let anuncio: AnuncioVendedor | undefined;
      try {
        if (operacao === "desativar") await servico.desativar(id);
        else anuncio = (await servico.finalizarVenda(id, { soldQuantity: quantidade! })).ad;
      } catch (erro) {
        return { sucesso: false, mensagem: mensagemErro(erro, operacao === "desativar" ? "Não foi possível encerrar o anúncio." : "Não foi possível registrar a venda.") };
      }

      if (sessaoAtiva.current !== sessao) return { sucesso: true };
      invalidarConsultasAnteriores();
      const anuncioAtualizado = anuncio;
      aplicar((anterior) => ({
        ...anterior,
        carregando: false,
        carregandoEmpresa: false,
        anuncios: anuncioAtualizado?.status === "ativo"
          ? [anuncioAtualizado, ...anterior.anuncios.filter((atual) => atual.id !== id)]
          : anterior.anuncios.filter((atual) => atual.id !== id),
        anunciosEmpresa: anuncioAtualizado
          ? [anuncioAtualizado, ...anterior.anunciosEmpresa.filter((atual) => atual.id !== id)]
          : anterior.anunciosEmpresa.map((atual) => atual.id === id ? { ...atual, status: "inativo" } : atual),
      }));
      if (sessaoComListaPublica.current !== sessao) await atualizarAnuncios();
      if (sessaoAtiva.current !== sessao) return { sucesso: true };

      if (operacao === "finalizar") {
        try {
          await atualizarEstoque();
        } catch {
          return { sucesso: true, mensagem: "Venda registrada. Atualize o estoque para consultar o saldo mais recente." };
        }
      }
      return { sucesso: true, mensagem: operacao === "desativar" ? "Anúncio encerrado com sucesso." : anuncioAtualizado?.status === "ativo" ? "Venda registrada. O anúncio permanece ativo com a quantidade restante." : "Venda registrada e anúncio concluído." };
    } finally {
      if (alteracoes.current.get(chave) === alteracao) alteracoes.current.delete(chave);
      aplicar((anterior) => ({ ...anterior, anunciosEmAlteracao: anterior.anunciosEmAlteracao.filter((atual) => atual !== id) }));
    }
  }, [aplicar, atualizarAnuncios, atualizarEstoque, invalidarConsultasAnteriores, servico, sessao]);

  const dados = estado.sessao === sessao ? estado : estadoInicial(sessao);
  return {
    ...dados,
    atualizarAnuncios,
    atualizarAnunciosEmpresa,
    criarAnuncio,
    desativarAnuncio: (id: string) => alterarAnuncio(id, "desativar"),
    finalizarVenda: (id: string, quantidade: number) => alterarAnuncio(id, "finalizar", quantidade),
  };
}
