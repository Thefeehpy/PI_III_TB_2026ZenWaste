import { ArrowRight, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Campo, Informacao } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "publicacaoAberta" | "definirPublicacaoAberta" | "processoSelecionado" | "formularioPublicacao" | "definirFormularioPublicacao" | "publicarTransporte">;
export function DialogoPublicacaoTransporte({ publicacaoAberta, definirPublicacaoAberta, processoSelecionado, formularioPublicacao, definirFormularioPublicacao, publicarTransporte }: Propriedades) {
    return (<><Dialog open={publicacaoAberta} onOpenChange={definirPublicacaoAberta}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Lançar transporte para transportadoras</DialogTitle>
            <DialogDescription>
              Publique uma demanda de frete para que transportadoras parceiras possam enviar propostas.
            </DialogDescription>
          </DialogHeader>
          {processoSelecionado && (<div className="space-y-5">
              <div className="space-y-3 rounded-[24px] border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Informacao label="Pedido" value={`#${processoSelecionado.numeroPedido}`}/>
                <Informacao label="Material" value={processoSelecionado.material}/>
                <Informacao label="Peso" value={`${processoSelecionado.pesoToneladas} ton`}/>
                <Informacao label="Cubagem" value={`${processoSelecionado.metrosCubicos} m³`}/>
                <Informacao label="Cliente" value={processoSelecionado.cliente}/>
                </div>

                <div className="rounded-[22px] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--background)/0.86))] p-3 sm:p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                    <Route className="h-4 w-4"/>
                    Rota do transporte
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                    <div className="min-w-0 rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="mt-1 break-words text-sm font-semibold leading-6 text-foreground">
                        {processoSelecionado.origem}
                      </p>
                    </div>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_12px_28px_rgba(16,185,129,0.18)] md:h-11 md:w-11">
                      <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0"/>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border/70 bg-background/80 p-3 sm:p-4">
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="mt-1 break-words text-sm font-semibold leading-6 text-foreground">
                        {processoSelecionado.destino}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Valor sugerido para o frete" value={formularioPublicacao.valorSugerido} onChange={(value) => definirFormularioPublicacao((atuais) => ({ ...atuais, valorSugerido: value }))} type="number"/>
                <Campo label="Janela de coleta" value={formularioPublicacao.janelaColeta} onChange={(value) => definirFormularioPublicacao((atuais) => ({ ...atuais, janelaColeta: value }))} placeholder="Ex.: Amanhã, 08:00 - 11:00"/>
                <Campo label="Tipo de veículo necessário" value={formularioPublicacao.tipoVeiculo} onChange={(value) => definirFormularioPublicacao((atuais) => ({ ...atuais, tipoVeiculo: value }))} placeholder="Ex.: Baú médio, truck, roll-on"/>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transporte-observacoes">Observações para a transportadora</Label>
                <Textarea id="transporte-observacoes" value={formularioPublicacao.observacoes} onChange={(evento) => definirFormularioPublicacao((atuais) => ({ ...atuais, observacoes: evento.target.value }))} placeholder="Informe restrições de coleta, necessidade de lona, doca, empilhadeira, documentação e cuidados com o resíduo."/>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirPublicacaoAberta(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={publicarTransporte}>Publicar transporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
