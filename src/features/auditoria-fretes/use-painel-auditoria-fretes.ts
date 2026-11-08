import { useMemo, useState } from 'react';
import type { SituacaoFrete, ProcessoFrete, PedidoErp, FormularioNovoFrete, FormularioPublicacaoTransporte, FormularioCotacao, FormularioDocumento, FormularioCubagem } from './tipos';
import { formularioNovoFreteVazio, formularioCotacaoVazio, formularioPublicacaoVazio, formatarData, obterCotacaoAprovada } from './apresentacao';
import { useDadosAuditoriaFretes } from './use-dados-auditoria-fretes';
import type { ServicoAuditoriaFretes } from './servico-auditoria-fretes';
export function usePainelAuditoriaFretes(servico?: ServicoAuditoriaFretes) {
    const { estado, carregando, executando, erro, informarErro, executar, recarregar, origem } = useDadosAuditoriaFretes(servico);
    const { processos, pedidosErpPendentes, transportesPublicados } = estado;
    const [filtroAtivo, definirFiltroAtivo] = useState<"all" | SituacaoFrete>("all");
    const [termoBusca, definirTermoBusca] = useState("");
    const [idProcessoSelecionado, definirIdProcessoSelecionado] = useState<string | null>(null);
    const [idPedidoErpSelecionado, definirIdPedidoErpSelecionado] = useState<string | null>(null);
    const [detalhesAbertos, definirDetalhesAbertos] = useState(false);
    const [cadastroAberto, definirCadastroAberto] = useState(false);
    const [cubagemAberta, definirCubagemAberta] = useState(false);
    const [cotacaoAberta, definirCotacaoAberta] = useState(false);
    const [publicacaoAberta, definirPublicacaoAberta] = useState(false);
    const [tratativaAberta, definirTratativaAberta] = useState(false);
    const [entregaAberta, definirEntregaAberta] = useState(false);
    const [formularioNovoFrete, definirFormularioNovoFrete] = useState<FormularioNovoFrete>(formularioNovoFreteVazio);
    const [formularioCubagem, definirFormularioCubagem] = useState<FormularioCubagem>({
        quantidadeVolumes: "",
        comprimentoCm: "",
        larguraCm: "",
        alturaCm: "",
        pesoToneladas: "",
    });
    const [formularioCotacao, definirFormularioCotacao] = useState<FormularioCotacao>(formularioCotacaoVazio);
    const [formularioPublicacao, definirFormularioPublicacao] = useState<FormularioPublicacaoTransporte>(formularioPublicacaoVazio);
    const [formularioDocumento, definirFormularioDocumento] = useState<FormularioDocumento>({ arquivoNfe: "", nomeArquivo: "", numeroCte: "", valorCte: "" });
    const [textoTratativa, definirTextoTratativa] = useState("");
    const [nomeFotoRetirada, definirNomeFotoRetirada] = useState("");
    const [nomeRecebedor, definirNomeRecebedor] = useState("");
    const [dadosAssinatura, definirDadosAssinatura] = useState("");
    const [tipoRecebimento, definirTipoRecebimento] = useState<"complete" | "with_reservation">("complete");
    const [textoRessalva, definirTextoRessalva] = useState("");
    const processoSelecionado = processos.find((processo) => processo.id === idProcessoSelecionado) ?? processos[0];
    const pedidoErpSelecionado = pedidosErpPendentes.find((pedido) => pedido.id === idPedidoErpSelecionado) ?? pedidosErpPendentes[0];
    const indicadores = useMemo(() => processos.reduce((acumulador, processo) => {
        if (processo.situacao === "awaiting_quote") {
            acumulador.awaitingQuote += 1;
        }
        if (processo.situacao === "quoting" || processo.situacao === "awaiting_document" || processo.situacao === "transport") {
            acumulador.inProgress += 1;
        }
        if (processo.situacao === "divergent") {
            acumulador.divergent += 1;
        }
        if (processo.situacao === "delivered") {
            acumulador.delivered += 1;
        }
        return acumulador;
    }, { awaitingQuote: 0, inProgress: 0, divergent: 0, delivered: 0 }), [processos]);
    const processosFiltrados = useMemo(() => {
        const buscaNormalizada = termoBusca.trim().toLowerCase();
        return processos.filter((processo) => {
            const correspondeFiltro = filtroAtivo === "all" ||
                processo.situacao === filtroAtivo ||
                (filtroAtivo === "transport" &&
                    (processo.situacao === "quoting" || processo.situacao === "awaiting_document" || processo.situacao === "transport"));
            const cotacaoAprovada = obterCotacaoAprovada(processo);
            const correspondeBusca = !buscaNormalizada ||
                processo.numeroPedido.toLowerCase().includes(buscaNormalizada) ||
                processo.cliente.toLowerCase().includes(buscaNormalizada) ||
                cotacaoAprovada?.transportadora.toLowerCase().includes(buscaNormalizada);
            return correspondeFiltro && correspondeBusca;
        });
    }, [filtroAtivo, processos, termoBusca]);
    const abrirDetalhes = (processId: string) => {
        definirIdProcessoSelecionado(processId);
        definirDetalhesAbertos(true);
    };
    const abrirEditorCubagem = (pedido: PedidoErp) => {
        definirIdPedidoErpSelecionado(pedido.id);
        definirFormularioCubagem({
            quantidadeVolumes: String(pedido.quantidadeVolumes),
            comprimentoCm: String(pedido.comprimentoCm),
            larguraCm: String(pedido.larguraCm),
            alturaCm: String(pedido.alturaCm),
            pesoToneladas: String(pedido.pesoToneladas),
        });
        definirCubagemAberta(true);
    };
    const montarTextoSolicitacao = (processo: ProcessoFrete) => {
        const dimensoes = processo.dimensoesCaixaCm
            ? `${processo.quantidadeVolumes ?? "-"} volume(s) de ${processo.dimensoesCaixaCm.length} x ${processo.dimensoesCaixaCm.width} x ${processo.dimensoesCaixaCm.height} cm`
            : "Volumes a confirmar";
        return [
            `Solicitação de cotação de frete - Pedido #${processo.numeroPedido}`,
            `Cliente: ${processo.cliente}`,
            `Origem: ${processo.origem}`,
            `Destino: ${processo.destino}`,
            `Carga: ${processo.material}`,
            `Volumes: ${dimensoes}`,
            `Cubagem total: ${processo.metrosCubicos} m³`,
            `Peso total: ${processo.pesoToneladas} ton`,
            `Prazo desejado: ${formatarData(processo.previsaoEntrega)}`,
            "Cuidados: validar veículo, janela de coleta, documentação necessária e restrições do material.",
        ].join("\n");
    };
    const compartilharSolicitacaoCotacao = (processo: ProcessoFrete, canal: "whatsapp" | "email") => {
        const texto = montarTextoSolicitacao(processo);
        if (canal === "whatsapp") {
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
            return;
        }
        window.open(`mailto:?subject=${encodeURIComponent(`Cotação de frete - Pedido #${processo.numeroPedido}`)}&body=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    };
    const abrirPublicacaoTransporte = (processId?: string) => {
        if (processId) {
            definirIdProcessoSelecionado(processId);
        }
        definirPublicacaoAberta(true);
    };
    const copiarSolicitacaoCotacao = async (processo: ProcessoFrete) => {
        try {
            if (!navigator.clipboard)
                throw new Error('A cópia não está disponível neste navegador.');
            await navigator.clipboard.writeText(montarTextoSolicitacao(processo));
        }
        catch (falha) {
            informarErro(falha instanceof Error ? falha.message : 'Não foi possível copiar a solicitação.');
        }
    };
    const importarPedidoErp = async (orderId: string, modalidadeFrete: NonNullable<ProcessoFrete["modalidadeFrete"]>) => {
        const resultado = await executar(servico => servico.importarPedidoErp(orderId, modalidadeFrete));
        if (resultado) {
            definirIdProcessoSelecionado(resultado.processos[0]?.id ?? null);
            definirDetalhesAbertos(true);
        }
    };
    const salvarCubagem = async () => {
        if (pedidoErpSelecionado && await executar(servico => servico.atualizarCubagem(pedidoErpSelecionado.id, formularioCubagem)))
            definirCubagemAberta(false);
    };
    const cadastrarNovoFrete = async () => {
        const resultado = await executar(servico => servico.cadastrarProcesso(formularioNovoFrete));
        if (resultado) {
            definirIdProcessoSelecionado(resultado.processos[0]?.id ?? null);
            definirFormularioNovoFrete(formularioNovoFreteVazio);
            definirCadastroAberto(false);
            definirDetalhesAbertos(true);
        }
    };
    const publicarTransporte = async () => {
        if (processoSelecionado && await executar(servico => servico.publicarTransporte(processoSelecionado.id, formularioPublicacao))) {
            definirFormularioPublicacao(formularioPublicacaoVazio);
            definirPublicacaoAberta(false);
        }
    };
    const cadastrarCotacao = async () => {
        if (processoSelecionado && await executar(servico => servico.cadastrarCotacao(processoSelecionado.id, formularioCotacao))) {
            definirFormularioCotacao(formularioCotacaoVazio);
            definirCotacaoAberta(false);
        }
    };
    const aprovarCotacao = async (quoteId: string) => {
        if (processoSelecionado)
            await executar(servico => servico.aprovarCotacao(processoSelecionado.id, quoteId));
    };
    const registrarDocumentos = async () => {
        if (processoSelecionado)
            await executar(servico => servico.registrarDocumentoDemonstrativo(processoSelecionado.id, formularioDocumento));
    };
    const registrarTratativa = async () => {
        if (processoSelecionado && await executar(servico => servico.registrarTratativa(processoSelecionado.id, textoTratativa))) {
            definirTextoTratativa('');
            definirTratativaAberta(false);
        }
    };
    const registrarRetirada = async () => {
        if (processoSelecionado && await executar(servico => servico.registrarRetirada(processoSelecionado.id, nomeFotoRetirada)))
            definirNomeFotoRetirada('');
    };
    const confirmarEntrega = async () => {
        if (processoSelecionado && await executar(servico => servico.confirmarEntrega(processoSelecionado.id, { nomeRecebedor, dadosAssinatura, tipoRecebimento, textoRessalva }))) {
            definirNomeRecebedor('');
            definirDadosAssinatura('');
            definirTipoRecebimento('complete');
            definirTextoRessalva('');
            definirEntregaAberta(false);
        }
    };
    return { definirCadastroAberto, abrirPublicacaoTransporte, pedidosErpPendentes, importarPedidoErp, abrirEditorCubagem, indicadores, transportesPublicados, termoBusca, definirTermoBusca, filtroAtivo, definirFiltroAtivo, processosFiltrados, abrirDetalhes, processoSelecionado, detalhesAbertos, definirDetalhesAbertos, definirCotacaoAberta, montarTextoSolicitacao, copiarSolicitacaoCotacao, compartilharSolicitacaoCotacao, aprovarCotacao, formularioDocumento, definirFormularioDocumento, registrarDocumentos, definirTratativaAberta, nomeFotoRetirada, definirNomeFotoRetirada, registrarRetirada, definirEntregaAberta, cubagemAberta, definirCubagemAberta, pedidoErpSelecionado, formularioCubagem, definirFormularioCubagem, salvarCubagem, cadastroAberto, formularioNovoFrete, definirFormularioNovoFrete, cadastrarNovoFrete, publicacaoAberta, definirPublicacaoAberta, formularioPublicacao, definirFormularioPublicacao, publicarTransporte, cotacaoAberta, formularioCotacao, definirFormularioCotacao, cadastrarCotacao, tratativaAberta, textoTratativa, definirTextoTratativa, registrarTratativa, entregaAberta, nomeRecebedor, definirNomeRecebedor, tipoRecebimento, definirTipoRecebimento, textoRessalva, definirTextoRessalva, dadosAssinatura, definirDadosAssinatura, confirmarEntrega, carregando, executando, erro, recarregar, origem };
}
