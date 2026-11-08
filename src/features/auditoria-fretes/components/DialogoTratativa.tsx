import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "tratativaAberta" | "definirTratativaAberta" | "textoTratativa" | "definirTextoTratativa" | "registrarTratativa">;
export function DialogoTratativa({ tratativaAberta, definirTratativaAberta, textoTratativa, definirTextoTratativa, registrarTratativa }: Propriedades) {
    return (<><Dialog open={tratativaAberta} onOpenChange={definirTratativaAberta}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Nova tratativa</DialogTitle>
            <DialogDescription>Registre uma observação temporária no histórico do pedido.</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Observação da tratativa" value={textoTratativa} onChange={(evento) => definirTextoTratativa(evento.target.value)} placeholder="Descreva a tratativa..."/>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirTratativaAberta(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={registrarTratativa}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
