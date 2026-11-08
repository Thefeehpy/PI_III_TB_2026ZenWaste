import { Box, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obterCubagemPedido } from '../apresentacao';
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Informacao } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "pedidosErpPendentes" | "importarPedidoErp" | "abrirEditorCubagem">;
export function PedidosErp({ pedidosErpPendentes, importarPedidoErp, abrirEditorCubagem }: Propriedades) {
    return (<><Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl">Pedidos recebidos do ERP</CardTitle>
            <CardDescription>
              Pedidos demonstrativos: escolha quais precisam de cotação e quais seguem outro fluxo.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/10 px-4 py-1.5 text-primary">
            {pedidosErpPendentes.length} pendente(s)
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          {pedidosErpPendentes.length === 0 ? (<div className="rounded-[26px] border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground xl:col-span-3">
              Todos os pedidos demonstrativos já foram classificados.
            </div>) : (pedidosErpPendentes.map((pedido) => {
            const cubage = obterCubagemPedido(pedido);
            return (<article key={pedido.id} className="rounded-[28px] border border-border/70 bg-background/80 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-foreground">Pedido #{pedido.numeroPedido}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{pedido.cliente}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-info/25 bg-info/10 text-info">
                      ERP/API
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <Informacao label="Material" value={pedido.material}/>
                    <Informacao label="Entrega" value={pedido.destino}/>
                    <Informacao label="Volumes e cubagem" value={`${pedido.quantidadeVolumes} vol. • ${cubage} m³ • ${pedido.pesoToneladas} ton`}/>
                  </div>

                  <div className="mt-5 grid gap-2">
                    <Button className="rounded-2xl" onClick={() => importarPedidoErp(pedido.id, "quote")}>
                      <FileText className="mr-2 h-4 w-4"/>
                      Precisa cotação
                    </Button>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <Button variant="outline" className="rounded-2xl" onClick={() => importarPedidoErp(pedido.id, "contracted")}>
                        Frete contratado
                      </Button>
                      <Button variant="outline" className="rounded-2xl" onClick={() => importarPedidoErp(pedido.id, "customer_pickup")}>
                        Retirada cliente
                      </Button>
                    </div>
                    <Button variant="ghost" className="rounded-2xl" onClick={() => abrirEditorCubagem(pedido)}>
                      <Box className="mr-2 h-4 w-4"/>
                      Ajustar cubagem
                    </Button>
                  </div>
                </article>);
        }))}
        </CardContent>
      </Card></>);
}
