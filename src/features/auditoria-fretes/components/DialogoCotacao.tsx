import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Campo } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "cotacaoAberta" | "definirCotacaoAberta" | "formularioCotacao" | "definirFormularioCotacao" | "cadastrarCotacao">;
export function DialogoCotacao({ cotacaoAberta, definirCotacaoAberta, formularioCotacao, definirFormularioCotacao, cadastrarCotacao }: Propriedades) {
    return (<><Dialog open={cotacaoAberta} onOpenChange={definirCotacaoAberta}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Adicionar cotação</DialogTitle>
            <DialogDescription>Simule uma cotação recebida para o pedido selecionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Transportadora" value={formularioCotacao.transportadora} onChange={(value) => definirFormularioCotacao((atuais) => ({ ...atuais, transportadora: value }))}/>
            <Campo label="Valor" value={formularioCotacao.valor} onChange={(value) => definirFormularioCotacao((atuais) => ({ ...atuais, valor: value }))} type="number"/>
            <Campo label="Prazo estimado (dias)" value={formularioCotacao.prazoDias} onChange={(value) => definirFormularioCotacao((atuais) => ({ ...atuais, prazoDias: value }))} type="number"/>
            <div className="space-y-2">
              <Label htmlFor="cotacao-observacao">Observação</Label>
              <Textarea id="cotacao-observacao" value={formularioCotacao.observacao} onChange={(evento) => definirFormularioCotacao((atuais) => ({ ...atuais, observacao: evento.target.value }))}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirCotacaoAberta(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={cadastrarCotacao}>Salvar cotação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
