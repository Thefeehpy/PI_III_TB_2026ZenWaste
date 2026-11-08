import type { SituacaoFrete, ProcessoFrete, PedidoErp, FormularioNovoFrete, TransportePublicado, FormularioPublicacaoTransporte, FormularioCotacao, FormularioDocumento, FormularioCubagem } from './tipos';
import type { EstadoAuditoriaFretes } from './tipos';
import { pedidosErpDemonstrativos, processosDemonstrativos, transportesDemonstrativos } from './dados-demonstrativos';
import { obterCubagemPedido, obterSituacaoAposDocumento } from './apresentacao';
export interface ServicoAuditoriaFretes {
    readonly origem: 'demonstrativo' | 'api';
    carregar(sinal?: AbortSignal): Promise<EstadoAuditoriaFretes>;
    importarPedidoErp(orderId: string, modalidadeFrete: NonNullable<ProcessoFrete["modalidadeFrete"]>): Promise<EstadoAuditoriaFretes>;
    atualizarCubagem(pedidoId: string, formularioCubagem: FormularioCubagem): Promise<EstadoAuditoriaFretes>;
    cadastrarProcesso(formularioNovoFrete: FormularioNovoFrete): Promise<EstadoAuditoriaFretes>;
    publicarTransporte(processoId: string, formularioPublicacao: FormularioPublicacaoTransporte): Promise<EstadoAuditoriaFretes>;
    cadastrarCotacao(processoId: string, formularioCotacao: FormularioCotacao): Promise<EstadoAuditoriaFretes>;
    aprovarCotacao(processoId: string, quoteId: string): Promise<EstadoAuditoriaFretes>;
    registrarDocumentoDemonstrativo(processoId: string, formularioDocumento: FormularioDocumento): Promise<EstadoAuditoriaFretes>;
    registrarTratativa(processoId: string, textoTratativa: string): Promise<EstadoAuditoriaFretes>;
    registrarRetirada(processoId: string, nomeFotoRetirada: string): Promise<EstadoAuditoriaFretes>;
    confirmarEntrega(processoId: string, entrada: {
        nomeRecebedor: string;
        dadosAssinatura: string;
        tipoRecebimento: "complete" | "with_reservation";
        textoRessalva: string;
    }): Promise<EstadoAuditoriaFretes>;
}
/** Uma instância por tela/sessão. Não envia documentos, mensagens, pagamentos ou MTR. */
export function criarServicoAuditoriaDemonstrativa(): ServicoAuditoriaFretes {
    let processos = structuredClone(processosDemonstrativos);
    let pedidosErpPendentes = structuredClone(pedidosErpDemonstrativos);
    let transportesPublicados = structuredClone(transportesDemonstrativos);
    const definirProcessos = (alterar: (atuais: ProcessoFrete[]) => ProcessoFrete[]) => { processos = alterar(processos); };
    const definirPedidosErpPendentes = (alterar: (atuais: PedidoErp[]) => PedidoErp[]) => { pedidosErpPendentes = alterar(pedidosErpPendentes); };
    const definirTransportesPublicados = (alterar: (atuais: TransportePublicado[]) => TransportePublicado[]) => { transportesPublicados = alterar(transportesPublicados); };
    const obterEstado = (): EstadoAuditoriaFretes => structuredClone({ processos, pedidosErpPendentes, transportesPublicados });
    const atualizarProcesso = (processId: string, updater: (processo: ProcessoFrete) => ProcessoFrete) => {
        definirProcessos((atuais) => atuais.map((processo) => (processo.id === processId ? updater(processo) : processo)));
    };
    const criarProcessoPedidoErp = (pedido: PedidoErp, modalidadeFrete: ProcessoFrete["modalidadeFrete"], situacao: SituacaoFrete, motivoSemCotacao?: string): ProcessoFrete => {
        const metrosCubicos = obterCubagemPedido(pedido);
        const cotacaoContratada = modalidadeFrete === "contracted"
            ? [
                {
                    id: `q-${pedido.numeroPedido}-contratado`,
                    transportadora: "Transportadora já contratada",
                    valor: 0,
                    prazoDias: 2,
                    observacao: "Frete informado como já contratado no pedido recebido do ERP.",
                    aprovada: true,
                },
            ]
            : [];
        return {
            id: `fp-erp-${pedido.numeroPedido}`,
            numeroPedido: pedido.numeroPedido,
            cliente: pedido.cliente,
            material: pedido.material,
            origem: pedido.origem,
            destino: pedido.destino,
            metrosCubicos,
            pesoToneladas: pedido.pesoToneladas,
            dataPedido: pedido.dataPedido,
            previsaoEntrega: pedido.previsaoEntrega,
            situacao,
            origemCadastro: "erp",
            modalidadeFrete,
            motivoSemCotacao,
            quantidadeVolumes: pedido.quantidadeVolumes,
            dimensoesCaixaCm: {
                length: pedido.comprimentoCm,
                width: pedido.larguraCm,
                height: pedido.alturaCm,
            },
            cotacoes: cotacaoContratada,
            tratativas: [
                {
                    id: `tr-erp-${crypto.randomUUID()}`,
                    registradoEm: new Date().toISOString(),
                    autor: "Integração ERP",
                    observacao: modalidadeFrete === "quote"
                        ? "Pedido demonstrativo importado e marcado para cotação de frete."
                        : `Pedido demonstrativo importado e marcado como ${motivoSemCotacao}.`,
                },
            ],
        };
    };
    return {
        origem: 'demonstrativo',
        async carregar(sinal) {
            if (sinal?.aborted)
                throw new DOMException('Consulta cancelada.', 'AbortError');
            return obterEstado();
        },
        async importarPedidoErp(orderId: string, modalidadeFrete: NonNullable<ProcessoFrete["modalidadeFrete"]>) {
            const pedido = pedidosErpPendentes.find((item) => item.id === orderId);
            if (!pedido) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            const situacaoPorModalidade: Record<NonNullable<ProcessoFrete["modalidadeFrete"]>, SituacaoFrete> = {
                quote: "awaiting_quote",
                contracted: "awaiting_document",
                customer_pickup: "transport",
            };
            const motivoPorModalidade: Record<NonNullable<ProcessoFrete["modalidadeFrete"]>, string | undefined> = {
                quote: undefined,
                contracted: "frete já contratado",
                customer_pickup: "retirada pelo cliente",
            };
            const novoProcesso = criarProcessoPedidoErp(pedido, modalidadeFrete, situacaoPorModalidade[modalidadeFrete], motivoPorModalidade[modalidadeFrete]);
            definirProcessos((atuais) => [novoProcesso, ...atuais]);
            definirPedidosErpPendentes((atuais) => atuais.filter((item) => item.id !== pedido.id));
            return obterEstado();
        },
        async atualizarCubagem(pedidoId: string, formularioCubagem: FormularioCubagem) {
            const pedidoErpSelecionado = pedidosErpPendentes.find(pedido => pedido.id === pedidoId);
            if (!pedidoErpSelecionado) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            definirPedidosErpPendentes((atuais) => atuais.map((pedido) => pedido.id === pedidoErpSelecionado.id
                ? {
                    ...pedido,
                    quantidadeVolumes: Number(formularioCubagem.quantidadeVolumes) || pedido.quantidadeVolumes,
                    comprimentoCm: Number(formularioCubagem.comprimentoCm) || pedido.comprimentoCm,
                    larguraCm: Number(formularioCubagem.larguraCm) || pedido.larguraCm,
                    alturaCm: Number(formularioCubagem.alturaCm) || pedido.alturaCm,
                    pesoToneladas: Number(formularioCubagem.pesoToneladas) || pedido.pesoToneladas,
                }
                : pedido));
            return obterEstado();
        },
        async cadastrarProcesso(formularioNovoFrete: FormularioNovoFrete) {
            if (!formularioNovoFrete.numeroPedido.trim() || !formularioNovoFrete.cliente.trim()) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            const novoProcesso: ProcessoFrete = {
                id: `fp-${crypto.randomUUID()}`,
                numeroPedido: formularioNovoFrete.numeroPedido.trim(),
                cliente: formularioNovoFrete.cliente.trim(),
                material: formularioNovoFrete.material.trim() || "Material não informado",
                origem: formularioNovoFrete.origem.trim() || "Origem não informada",
                destino: formularioNovoFrete.destino.trim() || "Destino não informado",
                metrosCubicos: Number(formularioNovoFrete.metrosCubicos) || 0,
                pesoToneladas: Number(formularioNovoFrete.pesoToneladas) || 0,
                dataPedido: new Date().toISOString().slice(0, 10),
                previsaoEntrega: formularioNovoFrete.previsaoEntrega || new Date().toISOString().slice(0, 10),
                situacao: "awaiting_quote",
                cotacoes: [],
                tratativas: [
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Sistema",
                        observacao: "Pedido de frete criado e aguardando cotações.",
                    },
                ],
            };
            definirProcessos((atuais) => [novoProcesso, ...atuais]);
            return obterEstado();
        },
        async publicarTransporte(processoId: string, formularioPublicacao: FormularioPublicacaoTransporte) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado || Number(formularioPublicacao.valorSugerido) <= 0) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            const transportePublicado: TransportePublicado = {
                id: `pub-${crypto.randomUUID()}`,
                numeroPedido: processoSelecionado.numeroPedido,
                material: processoSelecionado.material,
                origem: processoSelecionado.origem,
                destino: processoSelecionado.destino,
                pesoToneladas: processoSelecionado.pesoToneladas,
                metrosCubicos: processoSelecionado.metrosCubicos,
                valorSugerido: Number(formularioPublicacao.valorSugerido),
                janelaColeta: formularioPublicacao.janelaColeta.trim() || "Janela a combinar",
                tipoVeiculo: formularioPublicacao.tipoVeiculo.trim() || "Veículo compatível com a carga",
                observacoes: formularioPublicacao.observacoes.trim() || "Oportunidade publicada para transportadoras parceiras.",
                propostas: 0,
                publicadoEm: new Date().toISOString(),
            };
            definirTransportesPublicados((atuais) => [transportePublicado, ...atuais]);
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                situacao: processo.situacao === "awaiting_quote" ? "quoting" : processo.situacao,
                tratativas: [
                    ...processo.tratativas,
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Faturamento",
                        observacao: "Transporte publicado para transportadoras enviarem propostas.",
                    },
                ],
            }));
            return obterEstado();
        },
        async cadastrarCotacao(processoId: string, formularioCotacao: FormularioCotacao) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado || !formularioCotacao.transportadora.trim() || Number(formularioCotacao.valor) <= 0) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                situacao: processo.situacao === "awaiting_quote" ? "quoting" : processo.situacao,
                cotacoes: [
                    ...processo.cotacoes,
                    {
                        id: `q-${crypto.randomUUID()}`,
                        transportadora: formularioCotacao.transportadora.trim(),
                        valor: Number(formularioCotacao.valor),
                        prazoDias: Number(formularioCotacao.prazoDias) || 1,
                        observacao: formularioCotacao.observacao.trim() || "Cotação registrada manualmente.",
                    },
                ],
            }));
            return obterEstado();
        },
        async aprovarCotacao(processoId: string, quoteId: string) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                situacao: "awaiting_document",
                cotacoes: processo.cotacoes.map((quote) => ({ ...quote, aprovada: quote.id === quoteId })),
                tratativas: [
                    ...processo.tratativas,
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Faturamento",
                        observacao: "Cotação aprovada e enviada para acompanhamento documental.",
                    },
                ],
            }));
            return obterEstado();
        },
        async registrarDocumentoDemonstrativo(processoId: string, formularioDocumento: FormularioDocumento) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado || (!formularioDocumento.arquivoNfe.trim() && Number(formularioDocumento.valorCte) <= 0)) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => {
                const proximoProcesso: ProcessoFrete = {
                    ...processo,
                    arquivoNfe: formularioDocumento.arquivoNfe.trim() || processo.arquivoNfe,
                    documento: Number(formularioDocumento.valorCte) > 0
                        ? {
                            nomeArquivo: formularioDocumento.nomeArquivo.trim() || `cte-pedido-${processo.numeroPedido}.pdf`,
                            numeroCte: formularioDocumento.numeroCte.trim() || `CTE-${Math.floor(90000 + Math.random() * 900)}`,
                            valorCte: Number(formularioDocumento.valorCte),
                            recebidoEm: new Date().toISOString(),
                        }
                        : processo.documento,
                };
                const proximaSituacao = obterSituacaoAposDocumento(proximoProcesso);
                return {
                    ...proximoProcesso,
                    situacao: proximaSituacao,
                    tratativas: [
                        ...processo.tratativas,
                        {
                            id: `tr-${crypto.randomUUID()}`,
                            registradoEm: new Date().toISOString(),
                            autor: "Financeiro",
                            observacao: proximaSituacao === "divergent"
                                ? "Divergência identificada entre cotação aprovada e CT-e recebido."
                                : "Documento recebido e valores conferidos.",
                        },
                    ],
                };
            });
            return obterEstado();
        },
        async registrarTratativa(processoId: string, textoTratativa: string) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado || !textoTratativa.trim()) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                tratativas: [
                    ...processo.tratativas,
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Usuário",
                        observacao: textoTratativa.trim(),
                    },
                ],
            }));
            return obterEstado();
        },
        async registrarRetirada(processoId: string, nomeFotoRetirada: string) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            if (!processoSelecionado || !nomeFotoRetirada.trim()) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                registroRetirada: {
                    nomeFoto: nomeFotoRetirada.trim(),
                    registradaEm: new Date().toISOString(),
                },
                situacao: processo.situacao === "awaiting_document" ? "transport" : processo.situacao,
                tratativas: [
                    ...processo.tratativas,
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Expedição",
                        observacao: `Retirada registrada com foto da carga: ${nomeFotoRetirada.trim()}.`,
                    },
                ],
            }));
            return obterEstado();
        },
        async confirmarEntrega(processoId: string, entrada: {
            nomeRecebedor: string;
            dadosAssinatura: string;
            tipoRecebimento: "complete" | "with_reservation";
            textoRessalva: string;
        }) {
            const processoSelecionado = processos.find(processo => processo.id === processoId);
            const { nomeRecebedor, dadosAssinatura, tipoRecebimento, textoRessalva } = entrada;
            if (!processoSelecionado || !nomeRecebedor.trim()) {
                throw new Error("Selecione um pedido e confira os campos obrigatórios.");
            }
            atualizarProcesso(processoSelecionado.id, (processo) => ({
                ...processo,
                situacao: "delivered",
                entrega: {
                    nomeRecebedor: nomeRecebedor.trim(),
                    confirmadoEm: new Date().toISOString(),
                    dadosAssinatura,
                    tipoRecebimento,
                    textoRessalva: tipoRecebimento === "with_reservation" ? textoRessalva.trim() : undefined,
                },
                tratativas: [
                    ...processo.tratativas,
                    {
                        id: `tr-${crypto.randomUUID()}`,
                        registradoEm: new Date().toISOString(),
                        autor: "Entregador",
                        observacao: tipoRecebimento === "with_reservation"
                            ? `Entrega confirmada por ${nomeRecebedor.trim()} com ressalva: ${textoRessalva.trim() || "sem observação detalhada"}.`
                            : `Entrega confirmada por ${nomeRecebedor.trim()} com canhoto digital.`,
                    },
                ],
            }));
            return obterEstado();
        }
    };
}
