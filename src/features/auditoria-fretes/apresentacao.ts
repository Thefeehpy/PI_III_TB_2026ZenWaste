import type { SituacaoFrete, ProcessoFrete, PedidoErp, FormularioNovoFrete, FormularioPublicacaoTransporte, FormularioCotacao } from './tipos';
export const apresentacaoSituacoes: Record<SituacaoFrete, {
    label: string;
    rotuloCurto: string;
    classeSelo: string;
    classeMarcador: string;
}> = {
    awaiting_classification: {
        label: "Aguardando classificação", rotuloCurto: "Classificação",
        classeSelo: "border-warning/30 bg-warning/10 text-warning", classeMarcador: "bg-warning",
    },
    awaiting_quote: {
        label: "Aguardando cotação",
        rotuloCurto: "Cotação",
        classeSelo: "border-warning/30 bg-warning/10 text-warning",
        classeMarcador: "bg-warning",
    },
    quoting: {
        label: "Em cotação",
        rotuloCurto: "Cotando",
        classeSelo: "border-info/25 bg-info/10 text-info",
        classeMarcador: "bg-info",
    },
    awaiting_document: {
        label: "Aguardando documento",
        rotuloCurto: "Documento",
        classeSelo: "border-violet-500/25 bg-violet-500/10 text-violet-500",
        classeMarcador: "bg-violet-500",
    },
    transport: {
        label: "Em transporte",
        rotuloCurto: "Transporte",
        classeSelo: "border-primary/25 bg-primary/10 text-primary",
        classeMarcador: "bg-primary",
    },
    awaiting_delivery: {
        label: "Aguardando entrega", rotuloCurto: "Entrega",
        classeSelo: "border-primary/25 bg-primary/10 text-primary", classeMarcador: "bg-primary",
    },
    canceled: {
        label: "Cancelado", rotuloCurto: "Cancelado",
        classeSelo: "border-muted-foreground/25 bg-muted text-muted-foreground", classeMarcador: "bg-muted-foreground",
    },
    divergent: {
        label: "Divergência",
        rotuloCurto: "Divergência",
        classeSelo: "border-destructive/25 bg-destructive/10 text-destructive",
        classeMarcador: "bg-destructive",
    },
    delivered: {
        label: "Entregue",
        rotuloCurto: "Entregue",
        classeSelo: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
        classeMarcador: "bg-emerald-500",
    },
};
export const etapasFluxo = ["Pedido", "Cotação", "Aprovação", "Conferência", "Transporte", "Entrega"];
export const indiceEtapaSituacao: Record<SituacaoFrete, number> = {
    awaiting_classification: 0,
    awaiting_quote: 1,
    quoting: 1,
    awaiting_document: 3,
    divergent: 3,
    transport: 4,
    delivered: 5,
    awaiting_delivery: 4,
    canceled: 0,
};
export const opcoesFiltro: Array<{
    value: "all" | SituacaoFrete;
    label: string;
}> = [
    { value: "all", label: "Todos" },
    { value: "awaiting_quote", label: "Aguardando Cotação" },
    { value: "transport", label: "Em Andamento" },
    { value: "divergent", label: "Divergências" },
    { value: "delivered", label: "Entregues" },
];
export const formularioNovoFreteVazio: FormularioNovoFrete = {
    numeroPedido: "",
    cliente: "",
    material: "",
    origem: "",
    destino: "",
    metrosCubicos: "",
    pesoToneladas: "",
    previsaoEntrega: "",
};
export const formularioCotacaoVazio: FormularioCotacao = {
    transportadora: "",
    valor: "",
    prazoDias: "2",
    observacao: "",
};
export const formularioPublicacaoVazio: FormularioPublicacaoTransporte = {
    valorSugerido: "",
    janelaColeta: "",
    tipoVeiculo: "",
    observacoes: "",
};
export function formatarMoeda(value: number) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
export function formatarData(value: string) {
    if (!value) return "Não informada";
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
export function formatarDataHora(value: string) {
    return new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
export function calcularCubagemM3(quantidadeVolumes: number, comprimentoCm: number, larguraCm: number, alturaCm: number) {
    return Number(((quantidadeVolumes * comprimentoCm * larguraCm * alturaCm) / 1000000).toFixed(3));
}
export function obterCubagemPedido(pedido: PedidoErp) {
    return calcularCubagemM3(pedido.quantidadeVolumes, pedido.comprimentoCm, pedido.larguraCm, pedido.alturaCm);
}
export function obterCotacaoAprovada(processo: ProcessoFrete) {
    return processo.cotacoes.find((quote) => quote.aprovada);
}
export function obterDiferenca(processo: ProcessoFrete) {
    if (processo.origemDados === "api") return processo.diferencaConferida ?? null;
    const cotacaoAprovada = obterCotacaoAprovada(processo);
    if (!cotacaoAprovada || !processo.documento) {
        return null;
    }
    return processo.documento.valorCte - cotacaoAprovada.valor;
}
export function possuiDivergenciaAberta(processo: ProcessoFrete) {
    if (processo.origemDados === "api") return processo.divergenciaAberta === true;
    const diferenca = obterDiferenca(processo);
    return diferenca !== null && Math.abs(diferenca) > 5;
}
export function obterValorReferencia(processo: ProcessoFrete) {
    return processo.origemDados === "api" ? processo.valorReferencia ?? null : obterCotacaoAprovada(processo)?.valor ?? null;
}
export function obterNomeTransportadora(processo: ProcessoFrete) {
    return processo.origemDados === "api" ? processo.transportadoraNome || "Não definida" : obterCotacaoAprovada(processo)?.transportadora || "Não definida";
}
export function obterSituacaoAposDocumento(processo: ProcessoFrete) {
    if (processo.origemDados === "api") return processo.situacao;
    const diferenca = obterDiferenca(processo);
    if (diferenca === null) {
        return processo.situacao;
    }
    return Math.abs(diferenca) > 5 ? "divergent" : "transport";
}
export function obterSituacoesSeparadas(processo: ProcessoFrete) {
    const diferenca = obterDiferenca(processo);
    return [
        {
            label: "Transporte",
            value: processo.entrega
                ? "Entregue"
                : processo.registroRetirada
                    ? "Carga retirada / em transporte"
                    : processo.modalidadeFrete === "customer_pickup"
                        ? "Aguardando retirada do cliente"
                        : obterCotacaoAprovada(processo)
                            ? "Aguardando retirada"
                            : "Frete em definição",
        },
        { label: "NF-e", value: processo.arquivoNfe ? "Anexada" : "Pendente" },
        { label: "CT-e", value: processo.documento ? "Recebido" : "Pendente" },
        { label: "Comprovante", value: processo.entrega ? "Recebido" : "Pendente" },
        {
            label: "Financeiro",
            value: !processo.documento ? "Aguardando CT-e" : possuiDivergenciaAberta(processo) ? "Divergência" : processo.origemDados === "api" && processo.divergenciaConfirmada ? "Diferença resolvida" : "Conferido",
        },
    ];
}
