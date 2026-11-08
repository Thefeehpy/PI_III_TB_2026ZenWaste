import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Campo, Informacao } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "entregaAberta" | "definirEntregaAberta" | "processoSelecionado" | "nomeRecebedor" | "definirNomeRecebedor" | "tipoRecebimento" | "definirTipoRecebimento" | "textoRessalva" | "definirTextoRessalva" | "dadosAssinatura" | "definirDadosAssinatura" | "confirmarEntrega">;
export function DialogoEntrega({ entregaAberta, definirEntregaAberta, processoSelecionado, nomeRecebedor, definirNomeRecebedor, tipoRecebimento, definirTipoRecebimento, textoRessalva, definirTextoRessalva, dadosAssinatura, definirDadosAssinatura, confirmarEntrega }: Propriedades) {
    return (<><Dialog open={entregaAberta} onOpenChange={definirEntregaAberta}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <DialogDescription>Simule o canhoto digital assinado pelo recebedor.</DialogDescription>
          </DialogHeader>
          {processoSelecionado && (<div className="space-y-5">
              <div className="grid gap-3 rounded-[24px] border border-border/70 bg-muted/20 p-4 sm:grid-cols-3">
                <Informacao label="Pedido" value={`#${processoSelecionado.numeroPedido}`}/>
                <Informacao label="Cliente" value={processoSelecionado.cliente}/>
                <Informacao label="Mercadoria" value={processoSelecionado.material}/>
              </div>
              <Campo label="Nome de quem recebeu" value={nomeRecebedor} onChange={definirNomeRecebedor}/>
              <div className="space-y-3">
                <Label>Tipo de recebimento</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant={tipoRecebimento === "complete" ? "default" : "outline"} className="rounded-2xl" onClick={() => definirTipoRecebimento("complete")}>
                    Recebimento completo
                  </Button>
                  <Button type="button" variant={tipoRecebimento === "with_reservation" ? "default" : "outline"} className="rounded-2xl" onClick={() => definirTipoRecebimento("with_reservation")}>
                    Com ressalva
                  </Button>
                </div>
                {tipoRecebimento === "with_reservation" && (<Textarea aria-label="Ressalva do recebimento" value={textoRessalva} onChange={(evento) => definirTextoRessalva(evento.target.value)} placeholder="Descreva avaria, falta, divergência de volume ou outra observação."/>)}
              </div>
              <div className="space-y-2">
                <Label>Assinatura do recebedor</Label>
                <SignaturePad value={dadosAssinatura} onChange={definirDadosAssinatura}/>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirEntregaAberta(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={confirmarEntrega}>Confirmar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
