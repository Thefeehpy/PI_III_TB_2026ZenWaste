import { useOperacoesFrete } from "./use-operacoes-frete";
import { useIntencoesFrete } from "./use-intencoes-frete";
import { acoesFrete } from "./permissoes-interface";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";
import {
  apresentarDetalheFreteApi,
  apresentarFreteApi,
  tituloFrete,
} from "./adaptador-auditoria-fretes";
import type { ServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import type {
  ModalidadeAuditoriaFrete,
  SituacaoAuditoriaFrete,
} from "./tipos-api";
import type {
  FormularioCotacao,
  FormularioDocumento,
  FormularioPublicacaoTransporte,
  ProcessoFrete,
  SituacaoFrete,
} from "./tipos";

import { useFormularioFrete } from "./use-formulario-frete";
import { cadastroInicial, classificacaoInicial, decimalFrete, inteiroFrete, identificadorEmpresa,
  textoFrete, validarCamposFrete, validarCadastroFrete, validarClassificacaoFrete, errosCamposApi,
  type ErrosFrete } from "./validacoes";
import type { PedidoDisponivelFreteDTO } from "./tipos-api";

const cotacaoInicial: FormularioCotacao = { transportadora: "", valor: "", prazoDias: "2", observacao: "" };
const documentoInicial: FormularioDocumento = { arquivoNfe: "", nomeArquivo: "", numeroCte: "", valorCte: "" };
const publicacaoInicial: FormularioPublicacaoTransporte = { valorSugerido: "", janelaColeta: "", tipoVeiculo: "", observacoes: "" };
const filtrosApi: Partial<Record<SituacaoFrete, SituacaoAuditoriaFrete>> = {
  awaiting_classification: "aguardando_classificacao",
  awaiting_quote: "em_cotacao",
  quoting: "em_cotacao",
  awaiting_document: "aguardando_conferencia",
  awaiting_delivery: "aguardando_entrega",
  transport: "aguardando_entrega",
  divergent: "com_divergencia",
  delivered: "concluido",
  canceled: "cancelado",
};

export function usePainelAuditoriaIntegrada(
  servico?: ServicoHttpAuditoriaFretes,
) {
  const { user: empresa, retrySession } = useAuth();
  const podeCadastrar = empresa?.roles.includes("vendedora") ?? false;
  const dados = useConsultaAuditoriaApi(
    empresa?.id ?? null,
    podeCadastrar,
    servico,
    retrySession,
  );
  const processos = useMemo(
    () => dados.fretes?.resultados.map(apresentarFreteApi) ?? [],
    [dados.fretes],
  );
  const processoSelecionado = useMemo(
    () =>
      dados.detalhe
        ? apresentarDetalheFreteApi(dados.detalhe)
        : processos.find((processo) => processo.id === dados.idSelecionado),
    [dados.detalhe, dados.idSelecionado, processos],
  );
  const [detalhesAbertos, definirDetalhesAbertos] = useState(false);
  const [termoBusca, definirTermoBusca] = useState("");
  const [descarte, definirDescarte] = useState<{
    sessao: object; descricao: string; continuar: () => void;
  } | null>(null);
  const pedirDescarte = (descricao: string, continuar: () => void) =>
    definirDescarte({ sessao: dados.sessao, descricao, continuar });
  const contextoFrete = useMemo(() => ({ sessao: dados.sessao, id: dados.idSelecionado }), [dados.sessao, dados.idSelecionado]);
  const operacoes = useOperacoesFrete(contextoFrete, dados.detalhe, dados, pedirDescarte);
  const intencoes = useIntencoesFrete(empresa?.id ?? null);
  const acoes = acoesFrete(dados.detalhe);
  const verificarAcao = (permitida: boolean) => {
    if (permitida) return true;
    dados.informarErroComando("A ação não está disponível nas permissões e situação atuais. Atualize o frete.");
    return false;
  };
  const cadastro = useFormularioFrete(dados.sessao, cadastroInicial, pedirDescarte);
  const classificacao = useFormularioFrete(contextoFrete, classificacaoInicial, pedirDescarte);
  const cotacao = useFormularioFrete(contextoFrete, cotacaoInicial, pedirDescarte);
  const documento = useFormularioFrete(contextoFrete, documentoInicial, pedirDescarte);
  const publicacao = useFormularioFrete(contextoFrete, publicacaoInicial, pedirDescarte);
  const formularioCadastro = cadastro.formulario;
  const formularioClassificacao = classificacao.formulario;
  const formularioCotacao = cotacao.formulario;
  const formularioDocumento = documento.formulario;
  const formularioPublicacao = publicacao.formulario;
  const definirFormularioCadastro = cadastro.definir;
  const definirFormularioClassificacao = classificacao.definir;
  const definirFormularioCotacao = cotacao.definir;
  const definirFormularioDocumento = documento.definir;
  const definirFormularioPublicacao = publicacao.definir;
  const cadastroAberto = cadastro.aberto;
  const classificacaoAberta = classificacao.aberto;
  const cotacaoAberta = cotacao.aberto;
  const publicacaoAberta = publicacao.aberto;
  const aoAbrirFormulario = (abrir: (valor: boolean) => void) => (valor: boolean) => {
    if (dados.executando) return;
    dados.informarErroComando(null);
    abrir(valor);
  };
  const definirCadastroAberto = aoAbrirFormulario(cadastro.abrir);
  const definirClassificacaoAberta = aoAbrirFormulario(classificacao.abrir);
  const definirCotacaoAberta = aoAbrirFormulario(cotacao.abrir);
  const definirPublicacaoAberta = aoAbrirFormulario(publicacao.abrir);
  const falhaCampos = (definir: (erros: ErrosFrete) => void, campos: Record<string, string>) => (erro: unknown) => {
    const erros = errosCamposApi(erro, campos);
    definir(erros);
    return Object.keys(erros).length > 0;
  };
  const tratativaAberta = operacoes.tratativa.aberto;
  const definirTratativaAberta = operacoes.abrirTratativa;
  const entregaAberta = operacoes.recebimento.aberto;
  const definirEntregaAberta = operacoes.abrirRecebimento;
  const resolucaoAberta = operacoes.aceite.aberto;
  const definirResolucaoAberta = operacoes.abrirAceite;
  const cancelamentoAberto = operacoes.cancelamento.aberto;
  const definirCancelamentoAberto = operacoes.abrirCancelamento;
  const textoTratativa = operacoes.tratativa.formulario.texto;
  const definirTextoTratativa = (texto: string) => operacoes.tratativa.definir({ texto });
  const justificativaResolucao = operacoes.aceite.formulario.texto;
  const definirJustificativaResolucao = (texto: string) => operacoes.aceite.definir({ texto });
  const justificativaCancelamento = operacoes.cancelamento.formulario.texto;
  const definirJustificativaCancelamento = (texto: string) => operacoes.cancelamento.definir({ texto });
  const nomeFotoRetirada = operacoes.retirada.formulario.texto;
  const definirNomeFotoRetirada = (texto: string) => operacoes.retirada.definir({ texto });
  const buscaAtual = dados.consulta.busca;
  const alterarConsulta = dados.alterarConsulta;
  useEffect(() => {
    if (termoBusca === (buscaAtual ?? "")) return;
    const temporizador = setTimeout(
      () => alterarConsulta({ busca: termoBusca }),
      250,
    );
    return () => clearTimeout(temporizador);
  }, [termoBusca, buscaAtual, alterarConsulta]);
  const filtroAtivo = (Object.entries(filtrosApi).find(
    ([, situacao]) => situacao === dados.consulta.situacao,
  )?.[0] ?? "all") as "all" | SituacaoFrete;
  const definirFiltroAtivo = (valor: SetStateAction<"all" | SituacaoFrete>) => {
    const proximo = typeof valor === "function" ? valor(filtroAtivo) : valor;
    dados.alterarConsulta({
      situacao: proximo === "all" ? undefined : filtrosApi[proximo],
    });
  };
  const limparDetalhes = () => {
    documento.limpar(); classificacao.limpar(); cotacao.limpar(); publicacao.limpar();
    operacoes.limpar();
  };
  const temRascunhoDetalhe = documento.sujo || classificacao.sujo || cotacao.sujo || publicacao.sujo || operacoes.sujo;
  const abrirDetalhes = async (id: string) => {
    if (dados.executando) return;
    const continuar = async () => {
      limparDetalhes(); definirDetalhesAbertos(true); await dados.abrirDetalhe(id);
    };
    if (temRascunhoDetalhe) pedirDescarte("Os rascunhos do frete atual serão descartados ao abrir outro detalhe.", () => { void continuar(); });
    else await continuar();
  };
  const fecharDetalhes = (aberto: boolean) => {
    if (dados.executando) return;
    if (aberto) definirDetalhesAbertos(true);
    else {
      const continuar = () => { limparDetalhes(); definirDetalhesAbertos(false); };
      if (temRascunhoDetalhe) pedirDescarte("Fechar os detalhes descartará os rascunhos ainda não enviados.", continuar);
      else continuar();
    }
  };
  const selecionarPedido = (pedido: PedidoDisponivelFreteDTO | null) => {
    if (pedido?.id === formularioCadastro.pedidoId) return;
    cadastro.trocar(() => definirFormularioCadastro({ ...cadastroInicial, pedidoId: pedido?.id ?? "", pedido,
      ...(pedido ? { quantidade: pedido.quantidade_restante, material: pedido.material, unidade: pedido.unidade, origem: pedido.origem } : {}) }));
  };
  const trocarTipoCadastro = (tipo: typeof formularioCadastro.tipo) => {
    if (tipo !== formularioCadastro.tipo) cadastro.trocar(() => definirFormularioCadastro({ ...cadastroInicial, tipo }));
  };
  const cadastrarFrete = async () => {
    const pedido = dados.pedidos?.resultados.find(p => p.id === formularioCadastro.pedidoId) ?? formularioCadastro.pedido;
    const { entrada, erros } = validarCadastroFrete({ ...formularioCadastro, pedido });
    cadastro.definirErros(erros);
    if (!entrada) return;
    const resultado = await dados.executar(integracao => integracao.cadastrar(entrada),
      falhaCampos(cadastro.definirErros, { pedido_id: "pedidoId", empresa_compradora_id: "compradoraId", quantidade: "quantidade", material: "material", unidade: "unidade", origem: "origem", destino: "destino", peso_toneladas: "pesoToneladas", cubagem_m3: "metrosCubicos", quantidade_volumes: "quantidadeVolumes", previsao_entrega: "previsaoEntrega" }));
    if (resultado) {
      cadastro.limpar(); limparDetalhes();
      dados.adotarDetalhe(resultado);
      definirDetalhesAbertos(true);
    }
  };
  const trocarModalidadeClassificacao = (modalidade: ModalidadeAuditoriaFrete) => {
    if (modalidade !== formularioClassificacao.modalidade)
      classificacao.trocar(() => definirFormularioClassificacao({ ...classificacaoInicial, modalidade }));
  };
  const classificarFrete = async () => {
    if (!processoSelecionado) return;
    const { entrada, erros } = validarClassificacaoFrete(formularioClassificacao);
    classificacao.definirErros(erros);
    if (!entrada || !verificarAcao(acoes.classificar)) return;
    const resultado = await dados.executar(integracao => integracao.classificar(processoSelecionado.id, entrada),
      falhaCampos(classificacao.definirErros, { transportadora_id: "transportadoraId", valor_referencia: "valorReferencia", modalidade: "modalidade" }));
    if (resultado) classificacao.limpar();
  };
  const cadastrarCotacao = async () => {
    if (!processoSelecionado) return;
    const { valores, erros } = validarCamposFrete({
      transportadora: () => identificadorEmpresa(formularioCotacao.transportadora),
      valor: () => decimalFrete(formularioCotacao.valor, 2),
      prazoDias: () => inteiroFrete(formularioCotacao.prazoDias, 1),
      observacao: () => textoFrete(formularioCotacao.observacao, 1000, false),
    });
    cotacao.definirErros(erros);
    if (Object.keys(erros).length || !verificarAcao(acoes.cotacao)) return;
    const resultado = await dados.executar(integracao => integracao.registrarCotacao(processoSelecionado.id, {
      transportadora_id: valores.transportadora, valor: valores.valor, prazo_dias: valores.prazoDias, observacao: valores.observacao,
    }), falhaCampos(cotacao.definirErros, { transportadora_id: "transportadora", valor: "valor", prazo_dias: "prazoDias", observacao: "observacao" }));
    if (resultado) cotacao.limpar();
  };
  const aprovarCotacao = async (id: string) => {
    if (!processoSelecionado || !verificarAcao(acoes.cotacao)) return null;
    return dados.executar(integracao => integracao.aprovarCotacao(processoSelecionado.id, id), undefined, "Aprovação de cotação");
  };
  const registrarDocumentos = async () => {
    if (!processoSelecionado) return;
    const { valores, erros } = validarCamposFrete({
      numeroCte: () => textoFrete(formularioDocumento.numeroCte, 60),
      valorCte: () => decimalFrete(formularioDocumento.valorCte, 2),
      nomeArquivo: () => textoFrete(formularioDocumento.nomeArquivo, 255, false),
      arquivoNfe: () => textoFrete(formularioDocumento.arquivoNfe, 255, false),
    });
    documento.definirErros(erros);
    if (Object.keys(erros).length || !verificarAcao(acoes.documento)) return;
    if (await dados.executar(integracao => integracao.registrarCTe(processoSelecionado.id, {
      numero: valores.numeroCte, valor: valores.valorCte, nome_arquivo: valores.nomeArquivo, arquivo_nfe: valores.arquivoNfe,
    }), falhaCampos(documento.definirErros, { numero: "numeroCte", valor: "valorCte", nome_arquivo: "nomeArquivo", arquivo_nfe: "arquivoNfe" }))) documento.limpar();
  };
  const registrarTratativa = operacoes.registrarTratativa;
  const registrarRetirada = operacoes.registrarRetirada;
  const confirmarEntrega = operacoes.confirmarRecebimento;
  const resolverDivergencia = operacoes.aceitarDiferenca;
  const cancelarFrete = operacoes.cancelarFrete;
  const abrirPublicacaoTransporte = async (id?: string) => {
    const processo = id
      ? processos.find((registro) => registro.id === id)
      : (processoSelecionado ??
        processos.find((registro) => registro.permissoes?.gerenciar));
    if (!processo) {
      dados.informarErroComando("Selecione um frete para registrar a demanda.");
      return;
    }
    await dados.abrirDetalhe(processo.id);
    definirPublicacaoAberta(true);
  };
  const publicarTransporte = async () => {
    if (!processoSelecionado) return;
    const { valores, erros } = validarCamposFrete({
      valorSugerido: () => decimalFrete(formularioPublicacao.valorSugerido, 2),
      janelaColeta: () => textoFrete(formularioPublicacao.janelaColeta, 120),
      tipoVeiculo: () => textoFrete(formularioPublicacao.tipoVeiculo, 120),
      observacoes: () => textoFrete(formularioPublicacao.observacoes, 1000, false),
    });
    publicacao.definirErros(erros);
    if (Object.keys(erros).length || !verificarAcao(acoes.demanda)) return;
    if (await dados.executar(integracao => integracao.publicarDemanda(processoSelecionado.id, {
      valor_sugerido: valores.valorSugerido, janela_coleta: valores.janelaColeta, tipo_veiculo: valores.tipoVeiculo, observacoes: valores.observacoes,
    }), falhaCampos(publicacao.definirErros, { valor_sugerido: "valorSugerido", janela_coleta: "janelaColeta", tipo_veiculo: "tipoVeiculo", observacoes: "observacoes" }))) publicacao.limpar();
  };
  const montarTextoSolicitacao = (processo: ProcessoFrete) =>
    [
      tituloFrete(processo),
      `Material: ${processo.material}`,
      `Origem: ${processo.origem}`,
      `Destino: ${processo.destino}`,
      `Peso: ${processo.pesoToneladas} ton`,
      `Cubagem: ${processo.metrosCubicos} m³`,
    ].join("\n");
  const copiarSolicitacaoCotacao = async (processo: ProcessoFrete) => {
    try {
      await navigator.clipboard.writeText(montarTextoSolicitacao(processo));
    } catch {
      dados.informarErroComando("Não foi possível copiar a solicitação.");
    }
  };
  const compartilharSolicitacaoCotacao = (
    processo: ProcessoFrete,
    canal: "whatsapp" | "email",
  ) => {
    const texto = encodeURIComponent(montarTextoSolicitacao(processo));
    window.open(
      canal === "whatsapp"
        ? `https://wa.me/?text=${texto}`
        : `mailto:?subject=${encodeURIComponent(tituloFrete(processo))}&body=${texto}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const indicadores = {
    awaitingQuote: dados.fretes?.indicadores.aguardando_cotacao ?? 0,
    inProgress: dados.fretes?.indicadores.em_andamento ?? 0,
    divergent: dados.fretes?.indicadores.divergentes ?? 0,
    delivered: dados.fretes?.indicadores.concluidos ?? 0,
  };
  return {
    dados,
    operacoes,
    intencoes,
    acoes,
    podeCadastrar,
    processos,
    processoSelecionado,
    indicadores,
    termoBusca,
    definirTermoBusca,
    filtroAtivo,
    definirFiltroAtivo,
    detalhesAbertos,
    definirDetalhesAbertos: fecharDetalhes,
    abrirDetalhes,
    cadastroAberto,
    definirCadastroAberto,
    formularioCadastro,
    definirFormularioCadastro,
    selecionarPedido,
    trocarTipoCadastro,
    errosCadastro: cadastro.erros,
    errosClassificacao: classificacao.erros,
    errosCotacao: cotacao.erros,
    errosDocumento: documento.erros,
    errosPublicacao: publicacao.erros,
    descarte: descarte?.sessao === dados.sessao ? descarte : null,
    cancelarDescarte: () => definirDescarte(null),
    confirmarDescarte: () => {
      definirDescarte(null);
      if (descarte?.sessao === dados.sessao) descarte.continuar();
    },
    cadastrarFrete,
    classificacaoAberta,
    definirClassificacaoAberta,
    formularioClassificacao,
    definirFormularioClassificacao,
    classificarFrete,
    trocarModalidadeClassificacao,
    cotacaoAberta,
    definirCotacaoAberta,
    formularioCotacao,
    definirFormularioCotacao,
    cadastrarCotacao,
    aprovarCotacao,
    formularioDocumento,
    definirFormularioDocumento,
    documentoAberto: documento.aberto,
    definirDocumentoAberto: aoAbrirFormulario(documento.abrir),
    registrarDocumentos,
    tratativaAberta,
    definirTratativaAberta,
    textoTratativa,
    definirTextoTratativa,
    registrarTratativa,
    publicacaoAberta,
    definirPublicacaoAberta,
    abrirPublicacaoTransporte,
    formularioPublicacao,
    definirFormularioPublicacao,
    publicarTransporte,
    entregaAberta,
    definirEntregaAberta,
    confirmarEntrega,
    nomeFotoRetirada,
    definirNomeFotoRetirada,
    registrarRetirada,
    resolucaoAberta,
    definirResolucaoAberta,
    justificativaResolucao,
    definirJustificativaResolucao,
    resolverDivergencia,
    cancelamentoAberto,
    definirCancelamentoAberto,
    justificativaCancelamento,
    definirJustificativaCancelamento,
    cancelarFrete,
    montarTextoSolicitacao,
    copiarSolicitacaoCotacao,
    compartilharSolicitacaoCotacao,
  };
}
