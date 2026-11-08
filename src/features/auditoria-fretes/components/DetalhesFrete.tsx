import { CheckCircle2, Copy, FileText, Mail, MessageSquarePlus, MessageCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { etapasFluxo, indiceEtapaSituacao, formatarMoeda, formatarData, formatarDataHora } from '../apresentacao';
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { AbaResumo, AbaDocumentos, AbaEntrega } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "processoSelecionado" | "detalhesAbertos" | "definirDetalhesAbertos" | "definirCotacaoAberta" | "montarTextoSolicitacao" | "copiarSolicitacaoCotacao" | "compartilharSolicitacaoCotacao" | "aprovarCotacao" | "formularioDocumento" | "definirFormularioDocumento" | "registrarDocumentos" | "definirTratativaAberta" | "nomeFotoRetirada" | "definirNomeFotoRetirada" | "registrarRetirada" | "definirEntregaAberta">;
export function DetalhesFrete({ processoSelecionado, detalhesAbertos, definirDetalhesAbertos, definirCotacaoAberta, montarTextoSolicitacao, copiarSolicitacaoCotacao, compartilharSolicitacaoCotacao, aprovarCotacao, formularioDocumento, definirFormularioDocumento, registrarDocumentos, definirTratativaAberta, nomeFotoRetirada, definirNomeFotoRetirada, registrarRetirada, definirEntregaAberta }: Propriedades) {
    return (<>{processoSelecionado && (<Dialog open={detalhesAbertos} onOpenChange={definirDetalhesAbertos}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto rounded-[32px] p-0">
            <div className="border-b border-border/70 p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">Pedido #{processoSelecionado.numeroPedido}</DialogTitle>
                <DialogDescription>
                  {processoSelecionado.cliente} • {processoSelecionado.destino} • {processoSelecionado.metrosCubicos} m³ • {formatarData(processoSelecionado.dataPedido)}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 grid gap-3 md:grid-cols-6">
                {etapasFluxo.map((etapa, indice) => {
                const etapaAtual = indiceEtapaSituacao[processoSelecionado.situacao];
                const concluida = indice < etapaAtual || processoSelecionado.situacao === "delivered";
                const atual = indice === etapaAtual && processoSelecionado.situacao !== "delivered";
                return (<div key={etapa} className="flex items-center gap-3 md:block">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold", concluida && "border-primary bg-primary text-primary-foreground", atual && "border-primary bg-primary/10 text-primary", !concluida && !atual && "border-border bg-muted text-muted-foreground")}>
                        {concluida ? <CheckCircle2 className="h-4 w-4"/> : indice + 1}
                      </div>
                      <p className={cn("mt-0 text-sm md:mt-2", atual ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {etapa}
                      </p>
                    </div>);
            })}
              </div>
            </div>

            <div className="p-6">
              <Tabs defaultValue="summary" className="space-y-6">
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl p-1">
                  <TabsTrigger value="summary" className="rounded-xl">Resumo</TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-xl">Cotações</TabsTrigger>
                  <TabsTrigger value="documents" className="rounded-xl">Documentos</TabsTrigger>
                  <TabsTrigger value="treatments" className="rounded-xl">Tratativas</TabsTrigger>
                  <TabsTrigger value="delivery" className="rounded-xl">Entrega</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-5">
                  <AbaResumo processo={processoSelecionado}/>
                </TabsContent>

                <TabsContent value="quotes" className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Cotações realizadas</h3>
                      <p className="text-sm text-muted-foreground">Selecione uma cotação para aprovar dentro deste pedido.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => definirCotacaoAberta(true)}>
                      <Plus className="mr-2 h-4 w-4"/>
                      Adicionar cotação
                    </Button>
                  </div>

                  <div className="rounded-[26px] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--background)))] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <FileText className="h-4 w-4 text-primary"/>
                          Solicitação pronta para transportadoras
                        </div>
                        <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/70 bg-background/80 p-4 text-xs leading-5 text-muted-foreground">
                          {montarTextoSolicitacao(processoSelecionado)}
                        </pre>
                      </div>
                      <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                        <Button variant="outline" className="rounded-2xl" onClick={() => copiarSolicitacaoCotacao(processoSelecionado)}>
                          <Copy className="mr-2 h-4 w-4"/>
                          Copiar
                        </Button>
                        <Button variant="outline" className="rounded-2xl" onClick={() => compartilharSolicitacaoCotacao(processoSelecionado, "whatsapp")}>
                          <MessageCircle className="mr-2 h-4 w-4"/>
                          WhatsApp
                        </Button>
                        <Button variant="outline" className="rounded-2xl" onClick={() => compartilharSolicitacaoCotacao(processoSelecionado, "email")}>
                          <Mail className="mr-2 h-4 w-4"/>
                          Email
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {processoSelecionado.cotacoes.length === 0 ? (<div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                        Nenhuma cotação registrada ainda.
                      </div>) : (processoSelecionado.cotacoes.map((quote) => (<div key={quote.id} className={cn("rounded-[24px] border p-4", quote.aprovada ? "border-primary/35 bg-primary/10" : "border-border/70 bg-background/80")}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{quote.transportadora}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{quote.observacao}</p>
                              <p className="mt-2 text-xs text-muted-foreground">Prazo estimado: {quote.prazoDias} dia(s)</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xl font-semibold text-foreground">{formatarMoeda(quote.valor)}</p>
                              {quote.aprovada ? (<Badge className="mt-2 rounded-full">Aprovada</Badge>) : (<Button variant="outline" className="mt-2 rounded-2xl" onClick={() => aprovarCotacao(quote.id)}>
                                  Aprovar cotação
                                </Button>)}
                            </div>
                          </div>
                        </div>)))}
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-5">
                  <AbaDocumentos processo={processoSelecionado} formularioDocumento={formularioDocumento} definirFormularioDocumento={definirFormularioDocumento} aoRegistrarDocumento={registrarDocumentos}/>
                </TabsContent>

                <TabsContent value="treatments" className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Tratativas</h3>
                      <p className="text-sm text-muted-foreground">Histórico de ocorrências e comunicações sobre o pedido.</p>
                    </div>
                    <Button className="rounded-2xl" onClick={() => definirTratativaAberta(true)}>
                      <MessageSquarePlus className="mr-2 h-4 w-4"/>
                      Nova tratativa
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {processoSelecionado.tratativas.map((tratativa) => (<div key={tratativa.id} className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                        <p className="text-sm font-semibold text-foreground">{formatarDataHora(tratativa.registradoEm)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{tratativa.autor}</p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{tratativa.observacao}</p>
                      </div>))}
                  </div>
                </TabsContent>

                <TabsContent value="delivery" className="space-y-5">
                  <AbaEntrega processo={processoSelecionado} nomeFotoRetirada={nomeFotoRetirada} definirNomeFotoRetirada={definirNomeFotoRetirada} aoRegistrarRetirada={registrarRetirada} aoAbrirEntrega={() => definirEntregaAberta(true)}/>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>)}</>);
}
