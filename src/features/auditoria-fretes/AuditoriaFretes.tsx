import { usePainelAuditoriaFretes } from './use-painel-auditoria-fretes';
import type { ServicoAuditoriaFretes } from './servico-auditoria-fretes';
import { CabecalhoAuditoria } from './components/CabecalhoAuditoria';
import { PedidosErp } from './components/PedidosErp';
import { IndicadoresFretes } from './components/IndicadoresFretes';
import { TransportesPublicados } from './components/TransportesPublicados';
import { ProcessosFrete } from './components/ProcessosFrete';
import { DetalhesFrete } from './components/DetalhesFrete';
import { DialogoCubagem } from './components/DialogoCubagem';
import { DialogoNovoFrete } from './components/DialogoNovoFrete';
import { DialogoPublicacaoTransporte } from './components/DialogoPublicacaoTransporte';
import { DialogoCotacao } from './components/DialogoCotacao';
import { DialogoTratativa } from './components/DialogoTratativa';
import { DialogoEntrega } from './components/DialogoEntrega';
export function AuditoriaFretes({ servico }: {
    servico?: ServicoAuditoriaFretes;
}) {
    const painel = usePainelAuditoriaFretes(servico);
    return (<div className="space-y-8" aria-busy={painel.carregando || painel.executando}>
    <CabecalhoAuditoria definirCadastroAberto={painel.definirCadastroAberto} abrirPublicacaoTransporte={painel.abrirPublicacaoTransporte}/>
    {painel.executando ? <p role="status" className="text-sm text-muted-foreground">Processando operação...</p> : null}
    {painel.erro ? <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>{painel.erro}</p><button type="button" className="mt-2 underline" onClick={() => void painel.recarregar()}>Tentar novamente</button></div> : null}
        {painel.carregando ? <p role="status" className="py-8 text-center text-muted-foreground">Carregando auditoria de fretes…</p> : <>
        <PedidosErp pedidosErpPendentes={painel.pedidosErpPendentes} importarPedidoErp={painel.importarPedidoErp} abrirEditorCubagem={painel.abrirEditorCubagem}/>
        <IndicadoresFretes indicadores={painel.indicadores}/>
        <TransportesPublicados abrirPublicacaoTransporte={painel.abrirPublicacaoTransporte} transportesPublicados={painel.transportesPublicados}/>
        <ProcessosFrete termoBusca={painel.termoBusca} definirTermoBusca={painel.definirTermoBusca} filtroAtivo={painel.filtroAtivo} definirFiltroAtivo={painel.definirFiltroAtivo} processosFiltrados={painel.processosFiltrados} abrirPublicacaoTransporte={painel.abrirPublicacaoTransporte} abrirDetalhes={painel.abrirDetalhes}/>
        <DetalhesFrete processoSelecionado={painel.processoSelecionado} detalhesAbertos={painel.detalhesAbertos} definirDetalhesAbertos={painel.definirDetalhesAbertos} definirCotacaoAberta={painel.definirCotacaoAberta} montarTextoSolicitacao={painel.montarTextoSolicitacao} copiarSolicitacaoCotacao={painel.copiarSolicitacaoCotacao} compartilharSolicitacaoCotacao={painel.compartilharSolicitacaoCotacao} aprovarCotacao={painel.aprovarCotacao} formularioDocumento={painel.formularioDocumento} definirFormularioDocumento={painel.definirFormularioDocumento} registrarDocumentos={painel.registrarDocumentos} definirTratativaAberta={painel.definirTratativaAberta} nomeFotoRetirada={painel.nomeFotoRetirada} definirNomeFotoRetirada={painel.definirNomeFotoRetirada} registrarRetirada={painel.registrarRetirada} definirEntregaAberta={painel.definirEntregaAberta}/>
        <DialogoCubagem cubagemAberta={painel.cubagemAberta} definirCubagemAberta={painel.definirCubagemAberta} pedidoErpSelecionado={painel.pedidoErpSelecionado} formularioCubagem={painel.formularioCubagem} definirFormularioCubagem={painel.definirFormularioCubagem} salvarCubagem={painel.salvarCubagem}/>
        <DialogoNovoFrete cadastroAberto={painel.cadastroAberto} definirCadastroAberto={painel.definirCadastroAberto} formularioNovoFrete={painel.formularioNovoFrete} definirFormularioNovoFrete={painel.definirFormularioNovoFrete} cadastrarNovoFrete={painel.cadastrarNovoFrete}/>
        <DialogoPublicacaoTransporte publicacaoAberta={painel.publicacaoAberta} definirPublicacaoAberta={painel.definirPublicacaoAberta} processoSelecionado={painel.processoSelecionado} formularioPublicacao={painel.formularioPublicacao} definirFormularioPublicacao={painel.definirFormularioPublicacao} publicarTransporte={painel.publicarTransporte}/>
        <DialogoCotacao cotacaoAberta={painel.cotacaoAberta} definirCotacaoAberta={painel.definirCotacaoAberta} formularioCotacao={painel.formularioCotacao} definirFormularioCotacao={painel.definirFormularioCotacao} cadastrarCotacao={painel.cadastrarCotacao}/>
        <DialogoTratativa tratativaAberta={painel.tratativaAberta} definirTratativaAberta={painel.definirTratativaAberta} textoTratativa={painel.textoTratativa} definirTextoTratativa={painel.definirTextoTratativa} registrarTratativa={painel.registrarTratativa}/>
        <DialogoEntrega entregaAberta={painel.entregaAberta} definirEntregaAberta={painel.definirEntregaAberta} processoSelecionado={painel.processoSelecionado} nomeRecebedor={painel.nomeRecebedor} definirNomeRecebedor={painel.definirNomeRecebedor} tipoRecebimento={painel.tipoRecebimento} definirTipoRecebimento={painel.definirTipoRecebimento} textoRessalva={painel.textoRessalva} definirTextoRessalva={painel.definirTextoRessalva} dadosAssinatura={painel.dadosAssinatura} definirDadosAssinatura={painel.definirDadosAssinatura} confirmarEntrega={painel.confirmarEntrega}/>
        </>}
    </div>);
}
