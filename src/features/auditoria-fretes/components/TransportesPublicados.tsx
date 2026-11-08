import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda } from '../apresentacao';
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Informacao } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "abrirPublicacaoTransporte" | "transportesPublicados">;
export function TransportesPublicados({ abrirPublicacaoTransporte, transportesPublicados }: Propriedades) {
    return (<><Card className="rounded-[34px] border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card)))] shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Transportes publicados para transportadoras</CardTitle>
            <CardDescription>
              Demandas lançadas pela empresa vendedora para receber propostas de frete.
            </CardDescription>
          </div>
          <Button className="rounded-2xl" onClick={() => abrirPublicacaoTransporte()}>
            <Send className="mr-2 h-4 w-4"/>
            Publicar transporte
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {transportesPublicados.map((transport) => (<article key={transport.id} className="rounded-[26px] border border-border/70 bg-background/80 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-foreground">Pedido #{transport.numeroPedido}</p>
                    <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/10 text-primary">
                      {transport.propostas} proposta(s)
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{transport.material}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">Valor sugerido</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatarMoeda(transport.valorSugerido)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Informacao label="Origem" value={transport.origem}/>
                <Informacao label="Destino" value={transport.destino}/>
                <Informacao label="Carga" value={`${transport.pesoToneladas} ton / ${transport.metrosCubicos} m³`}/>
                <Informacao label="Coleta" value={transport.janelaColeta}/>
              </div>

              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">{transport.tipoVeiculo}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{transport.observacoes}</p>
              </div>
            </article>))}
        </CardContent>
      </Card></>);
}
