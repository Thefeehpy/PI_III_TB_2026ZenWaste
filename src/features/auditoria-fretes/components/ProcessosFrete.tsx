import { CircleDollarSign, Route, Search, Send, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apresentacaoSituacoes, etapasFluxo, indiceEtapaSituacao, opcoesFiltro, formatarMoeda, obterCotacaoAprovada, obterDiferenca } from '../apresentacao';
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "termoBusca" | "definirTermoBusca" | "filtroAtivo" | "definirFiltroAtivo" | "processosFiltrados" | "abrirPublicacaoTransporte" | "abrirDetalhes">;
export function ProcessosFrete({ termoBusca, definirTermoBusca, filtroAtivo, definirFiltroAtivo, processosFiltrados, abrirPublicacaoTransporte, abrirDetalhes }: Propriedades) {
    return (<><Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-2xl">Processos de frete por pedido</CardTitle>
              <CardDescription>
                Todas as informações de cotação, documento, transporte e canhoto ficam vinculadas ao mesmo pedido.
              </CardDescription>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input aria-label="Buscar pedido, cliente ou transportadora" value={termoBusca} onChange={(evento) => definirTermoBusca(evento.target.value)} placeholder="Buscar pedido, cliente ou transportadora" className="h-11 rounded-2xl pl-9"/>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {opcoesFiltro.map((opcao) => (<Button key={opcao.value} type="button" variant={filtroAtivo === opcao.value ? "default" : "outline"} className="shrink-0 rounded-2xl" onClick={() => definirFiltroAtivo(opcao.value)}>
                {opcao.label}
              </Button>))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Transportadora</span>
            <span>Valor aprovado</span>
            <span>CT-e</span>
            <span>Etapa</span>
            <span>Status</span>
            <span>Ação</span>
          </div>

          <div className="space-y-3">
    {processosFiltrados.length === 0 ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Nenhum processo encontrado para os filtros selecionados.</p> : null}
            {processosFiltrados.map((processo) => {
            const cotacaoAprovada = obterCotacaoAprovada(processo);
            const diferenca = obterDiferenca(processo);
            const situacao = apresentacaoSituacoes[processo.situacao];
            const possuiDivergencia = diferenca !== null && Math.abs(diferenca) > 5;
            return (<article key={processo.id} className="rounded-[26px] border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] md:p-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">Pedido #{processo.numeroPedido}</p>
                        <Badge variant="outline" className={cn("rounded-full px-3 py-1", situacao.classeSelo)}>
                          <span className={cn("mr-2 h-2 w-2 rounded-full", situacao.classeMarcador)}/>
                          {situacao.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{processo.cliente}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{processo.material}</p>
                    </div>

                    <div className="rounded-[22px] bg-muted/20 px-4 py-3">
                      <div className="grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border/60">
                        <div className="min-w-0 sm:pr-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Truck className="h-3.5 w-3.5 text-primary"/>
                            <span>Transportadora</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {cotacaoAprovada?.transportadora ?? "Não definida"}
                          </p>
                        </div>

                        <div className="min-w-0 sm:px-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CircleDollarSign className="h-3.5 w-3.5 text-primary"/>
                            <span>Financeiro</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {cotacaoAprovada ? formatarMoeda(cotacaoAprovada.valor) : "Aguardando"}
                            </p>
                            <p className={cn("text-xs", possuiDivergencia ? "text-destructive" : "text-muted-foreground")}>
                              CT-e: {processo.documento ? formatarMoeda(processo.documento.valorCte) : "não recebido"}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-0 sm:pl-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Route className="h-3.5 w-3.5 text-primary"/>
                            <span>Etapa atual</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-foreground">{etapasFluxo[indiceEtapaSituacao[processo.situacao]]}</p>
                            {possuiDivergencia && <p className="text-xs text-destructive">Dif.: {formatarMoeda(diferenca)}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row xl:flex-col">
                      <Button type="button" className="w-full rounded-2xl xl:w-auto" onClick={() => abrirPublicacaoTransporte(processo.id)}>
                        <Send className="mr-2 h-4 w-4"/>
                        Lançar
                      </Button>
                      <Button type="button" variant="outline" className="w-full rounded-2xl xl:w-auto" onClick={() => abrirDetalhes(processo.id)}>
                        Ver detalhes
                      </Button>
                    </div>
                  </div>

                  <div className="hidden">
                  <div>
                    <p className="font-semibold text-foreground">Pedido #{processo.numeroPedido}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{processo.material}</p>
                  </div>
                  <p className="text-sm text-foreground">{processo.cliente}</p>
                  <p className="text-sm text-muted-foreground">{cotacaoAprovada?.transportadora ?? "Não definida"}</p>
                  <p className="text-sm font-medium text-foreground">{cotacaoAprovada ? formatarMoeda(cotacaoAprovada.valor) : "Aguardando"}</p>
                  <p className="text-sm font-medium text-foreground">{processo.documento ? formatarMoeda(processo.documento.valorCte) : "Não recebido"}</p>
                  <p className="text-sm text-muted-foreground">{etapasFluxo[indiceEtapaSituacao[processo.situacao]]}</p>
                  <div>
                    <Badge variant="outline" className={cn("rounded-full px-3 py-1", situacao.classeSelo)}>
                      <span className={cn("mr-2 h-2 w-2 rounded-full", situacao.classeMarcador)}/>
                      {situacao.label}
                    </Badge>
                    {diferenca !== null && Math.abs(diferenca) > 5 && (<p className="mt-1 text-xs text-destructive">Diferença: {formatarMoeda(diferenca)}</p>)}
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => abrirDetalhes(processo.id)}>
                    Ver detalhes
                  </Button>
                  </div>
                </article>);
        })}
          </div>
        </CardContent>
      </Card></>);
}
