import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";
import { apresentarDetalheFreteApi, apresentarFreteApi, tituloFrete } from "./adaptador-auditoria-fretes";
import type { ServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import type { ModalidadeAuditoriaFrete, SituacaoAuditoriaFrete } from "./tipos-api";
import type { FormularioCotacao, FormularioDocumento, FormularioPublicacaoTransporte, ProcessoFrete, SituacaoFrete } from "./tipos";

const formularioCadastroInicial = {
  tipo: "pedido" as "pedido" | "avulso", pedidoId: "", compradoraId: "", quantidade: "", material: "", unidade: "kg",
  origem: "", destino: "", pesoToneladas: "", metrosCubicos: "", quantidadeVolumes: "", previsaoEntrega: "",
};
const filtrosApi: Partial<Record<SituacaoFrete, SituacaoAuditoriaFrete>> = {
  awaiting_classification: "aguardando_classificacao", awaiting_quote: "em_cotacao", quoting: "em_cotacao",
  awaiting_document: "aguardando_conferencia", awaiting_delivery: "aguardando_entrega", transport: "aguardando_entrega",
  divergent: "com_divergencia", delivered: "concluido", canceled: "cancelado",
};

export function usePainelAuditoriaIntegrada(servico?: ServicoHttpAuditoriaFretes) {
  const { user: empresa } = useAuth();
  const podeCadastrar = empresa?.roles.includes("vendedora") ?? false;
  const dados = useConsultaAuditoriaApi(empresa?.id ?? null, podeCadastrar, servico);
  const processos = useMemo(() => dados.fretes?.resultados.map(apresentarFreteApi) ?? [], [dados.fretes]);
  const processoSelecionado = useMemo(() => dados.detalhe
    ? apresentarDetalheFreteApi(dados.detalhe)
    : processos.find((processo) => processo.id === dados.idSelecionado), [dados.detalhe, dados.idSelecionado, processos]);
  const [detalhesAbertos, definirDetalhesAbertos] = useState(false);
  const [cadastroAberto, definirCadastroAberto] = useState(false);
  const [classificacaoAberta, definirClassificacaoAberta] = useState(false);
  const [cotacaoAberta, definirCotacaoAberta] = useState(false);
  const [publicacaoAberta, definirPublicacaoAberta] = useState(false);
  const [tratativaAberta, definirTratativaAberta] = useState(false);
  const [entregaAberta, definirEntregaAberta] = useState(false);
  const [resolucaoAberta, definirResolucaoAberta] = useState(false);
  const [cancelamentoAberto, definirCancelamentoAberto] = useState(false);
  const [termoBusca, definirTermoBusca] = useState("");
  const [formularioCadastro, definirFormularioCadastro] = useState(formularioCadastroInicial);
  const [formularioClassificacao, definirFormularioClassificacao] = useState({ modalidade: "cotar" as ModalidadeAuditoriaFrete, transportadoraId: "", valorReferencia: "" });
  const [formularioCotacao, definirFormularioCotacao] = useState<FormularioCotacao>({ transportadora: "", valor: "", prazoDias: "2", observacao: "" });
  const [formularioDocumento, definirFormularioDocumento] = useState<FormularioDocumento>({ arquivoNfe: "", nomeArquivo: "", numeroCte: "", valorCte: "" });
  const [formularioPublicacao, definirFormularioPublicacao] = useState<FormularioPublicacaoTransporte>({ valorSugerido: "", janelaColeta: "", tipoVeiculo: "", observacoes: "" });
  const [textoTratativa, definirTextoTratativa] = useState("");
  const [justificativaResolucao, definirJustificativaResolucao] = useState("");
  const [justificativaCancelamento, definirJustificativaCancelamento] = useState("");
  const [nomeFotoRetirada, definirNomeFotoRetirada] = useState("");
  const [nomeRecebedor, definirNomeRecebedor] = useState("");
  const [dadosAssinatura, definirDadosAssinatura] = useState("");
  const [tipoRecebimento, definirTipoRecebimento] = useState<"complete" | "with_reservation">("complete");
  const [textoRessalva, definirTextoRessalva] = useState("");
  useEffect(() => {
    if (termoBusca === (dados.consulta.busca ?? "")) return;
    const temporizador = setTimeout(() => dados.alterarConsulta({ busca: termoBusca }), 250);
    return () => clearTimeout(temporizador);
  }, [termoBusca, dados.consulta.busca, dados.alterarConsulta]);
  const filtroAtivo = (Object.entries(filtrosApi).find(([, situacao]) => situacao === dados.consulta.situacao)?.[0] ?? "all") as "all" | SituacaoFrete;
  const definirFiltroAtivo = (valor: SetStateAction<"all" | SituacaoFrete>) => {
    const proximo = typeof valor === "function" ? valor(filtroAtivo) : valor;
    dados.alterarConsulta({ situacao: proximo === "all" ? undefined : filtrosApi[proximo] });
  };
  const abrirDetalhes = async (id: string) => {
    definirFormularioDocumento({ arquivoNfe: "", nomeArquivo: "", numeroCte: "", valorCte: "" });
    definirDetalhesAbertos(true);
    await dados.abrirDetalhe(id);
  };
  const selecionarPedido = (id: string) => {
    const pedido = dados.pedidos?.resultados.find((registro) => registro.id === id);
    definirFormularioCadastro((anterior) => ({ ...anterior, pedidoId: id,
      ...(pedido ? { quantidade: pedido.quantidade_restante, material: pedido.material, unidade: pedido.unidade, origem: pedido.origem } : {}),
    }));
  };
  const cadastrarFrete = async () => {
    const entrada = {
      quantidade: formularioCadastro.quantidade, origem: formularioCadastro.origem, destino: formularioCadastro.destino,
      peso_toneladas: formularioCadastro.pesoToneladas || "0", cubagem_m3: formularioCadastro.metrosCubicos || "0",
      quantidade_volumes: Number(formularioCadastro.quantidadeVolumes || "0"), previsao_entrega: formularioCadastro.previsaoEntrega,
      ...(formularioCadastro.tipo === "pedido" ? { pedido_id: formularioCadastro.pedidoId } : {
        empresa_compradora_id: Number(formularioCadastro.compradoraId), material: formularioCadastro.material, unidade: formularioCadastro.unidade,
      }),
    };
    const resultado = await dados.executar((integracao) => integracao.cadastrar(entrada));
    if (resultado) { definirCadastroAberto(false); definirFormularioCadastro(formularioCadastroInicial); await abrirDetalhes(resultado.id); }
  };
  const classificarFrete = async () => {
    if (!processoSelecionado) return;
    const resultado = await dados.executar((integracao) => integracao.classificar(processoSelecionado.id, {
      modalidade: formularioClassificacao.modalidade,
      ...(formularioClassificacao.modalidade === "contratado" ? { transportadora_id: Number(formularioClassificacao.transportadoraId), valor_referencia: formularioClassificacao.valorReferencia } : {}),
    }));
    if (resultado) definirClassificacaoAberta(false);
  };
  const cadastrarCotacao = async () => {
    if (!processoSelecionado) return;
    const resultado = await dados.executar((integracao) => integracao.registrarCotacao(processoSelecionado.id, {
      transportadora_id: Number(formularioCotacao.transportadora), valor: formularioCotacao.valor,
      prazo_dias: Number(formularioCotacao.prazoDias), observacao: formularioCotacao.observacao,
    }));
    if (resultado) { definirCotacaoAberta(false); definirFormularioCotacao({ transportadora: "", valor: "", prazoDias: "2", observacao: "" }); }
  };
  const aprovarCotacao = async (id: string) => { if (processoSelecionado) await dados.executar((integracao) => integracao.aprovarCotacao(processoSelecionado.id, id)); };
  const registrarDocumentos = async () => {
    if (processoSelecionado) await dados.executar((integracao) => integracao.registrarCTe(processoSelecionado.id, {
      numero: formularioDocumento.numeroCte, valor: formularioDocumento.valorCte,
      nome_arquivo: formularioDocumento.nomeArquivo, arquivo_nfe: formularioDocumento.arquivoNfe,
    }));
  };
  const registrarTratativa = async () => {
    if (processoSelecionado && await dados.executar((integracao) => integracao.registrarTratativa(processoSelecionado.id, textoTratativa))) {
      definirTextoTratativa(""); definirTratativaAberta(false);
    }
  };
  const registrarRetirada = async () => {
    if (processoSelecionado && await dados.executar((integracao) => integracao.registrarRetirada(processoSelecionado.id, nomeFotoRetirada))) definirNomeFotoRetirada("");
  };
  const confirmarEntrega = async () => {
    if (!processoSelecionado) return;
    if (!dadosAssinatura) { dados.informarErroComando("Registre a assinatura do recebedor."); return; }
    if (await dados.executar((integracao) => integracao.confirmarEntrega(processoSelecionado.id, {
      nome_recebedor: nomeRecebedor, dados_assinatura: dadosAssinatura,
      tipo_recebimento: tipoRecebimento === "with_reservation" ? "com_ressalva" : "completo", ressalva: textoRessalva,
    }))) { definirEntregaAberta(false); definirNomeRecebedor(""); definirDadosAssinatura(""); definirTextoRessalva(""); }
  };
  const resolverDivergencia = async () => {
    if (processoSelecionado && await dados.executar((integracao) => integracao.resolverDivergencia(processoSelecionado.id, justificativaResolucao))) {
      definirResolucaoAberta(false); definirJustificativaResolucao("");
    }
  };
  const cancelarFrete = async () => {
    if (processoSelecionado && await dados.executar((integracao) => integracao.cancelar(processoSelecionado.id, justificativaCancelamento))) {
      definirCancelamentoAberto(false); definirJustificativaCancelamento("");
    }
  };
  const abrirPublicacaoTransporte = async (id?: string) => {
    const processo = id ? processos.find((registro) => registro.id === id) : processoSelecionado ?? processos.find((registro) => registro.permissoes?.gerenciar);
    if (!processo) { dados.informarErroComando("Selecione um frete para registrar a demanda."); return; }
    await dados.abrirDetalhe(processo.id);
    definirPublicacaoAberta(true);
  };
  const publicarTransporte = async () => {
    if (processoSelecionado && await dados.executar((integracao) => integracao.publicarDemanda(processoSelecionado.id, {
      valor_sugerido: formularioPublicacao.valorSugerido, janela_coleta: formularioPublicacao.janelaColeta,
      tipo_veiculo: formularioPublicacao.tipoVeiculo, observacoes: formularioPublicacao.observacoes,
    }))) { definirPublicacaoAberta(false); definirFormularioPublicacao({ valorSugerido: "", janelaColeta: "", tipoVeiculo: "", observacoes: "" }); }
  };
  const montarTextoSolicitacao = (processo: ProcessoFrete) => [tituloFrete(processo), `Material: ${processo.material}`, `Origem: ${processo.origem}`, `Destino: ${processo.destino}`, `Peso: ${processo.pesoToneladas} ton`, `Cubagem: ${processo.metrosCubicos} m³`].join("\n");
  const copiarSolicitacaoCotacao = async (processo: ProcessoFrete) => {
    try { await navigator.clipboard.writeText(montarTextoSolicitacao(processo)); }
    catch { dados.informarErroComando("Não foi possível copiar a solicitação."); }
  };
  const compartilharSolicitacaoCotacao = (processo: ProcessoFrete, canal: "whatsapp" | "email") => {
    const texto = encodeURIComponent(montarTextoSolicitacao(processo));
    window.open(canal === "whatsapp" ? `https://wa.me/?text=${texto}` : `mailto:?subject=${encodeURIComponent(tituloFrete(processo))}&body=${texto}`, "_blank", "noopener,noreferrer");
  };
  const indicadores = { awaitingQuote: dados.fretes?.indicadores.aguardando_cotacao ?? 0, inProgress: dados.fretes?.indicadores.em_andamento ?? 0,
    divergent: dados.fretes?.indicadores.divergentes ?? 0, delivered: dados.fretes?.indicadores.concluidos ?? 0 };
  return {
    dados, podeCadastrar, processos, processoSelecionado, indicadores, termoBusca, definirTermoBusca, filtroAtivo, definirFiltroAtivo,
    detalhesAbertos, definirDetalhesAbertos, abrirDetalhes, cadastroAberto, definirCadastroAberto, formularioCadastro, definirFormularioCadastro, selecionarPedido, cadastrarFrete,
    classificacaoAberta, definirClassificacaoAberta, formularioClassificacao, definirFormularioClassificacao, classificarFrete,
    cotacaoAberta, definirCotacaoAberta, formularioCotacao, definirFormularioCotacao, cadastrarCotacao, aprovarCotacao,
    formularioDocumento, definirFormularioDocumento, registrarDocumentos, tratativaAberta, definirTratativaAberta, textoTratativa, definirTextoTratativa, registrarTratativa,
    publicacaoAberta, definirPublicacaoAberta, abrirPublicacaoTransporte, formularioPublicacao, definirFormularioPublicacao, publicarTransporte,
    entregaAberta, definirEntregaAberta, nomeRecebedor, definirNomeRecebedor, dadosAssinatura, definirDadosAssinatura, tipoRecebimento, definirTipoRecebimento, textoRessalva, definirTextoRessalva, confirmarEntrega,
    nomeFotoRetirada, definirNomeFotoRetirada, registrarRetirada, resolucaoAberta, definirResolucaoAberta, justificativaResolucao, definirJustificativaResolucao, resolverDivergencia,
    cancelamentoAberto, definirCancelamentoAberto, justificativaCancelamento, definirJustificativaCancelamento, cancelarFrete,
    montarTextoSolicitacao, copiarSolicitacaoCotacao, compartilharSolicitacaoCotacao,
  };
}
