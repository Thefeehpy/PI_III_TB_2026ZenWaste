import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Campo } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "cadastroAberto" | "definirCadastroAberto" | "formularioNovoFrete" | "definirFormularioNovoFrete" | "cadastrarNovoFrete">;
export function DialogoNovoFrete({ cadastroAberto, definirCadastroAberto, formularioNovoFrete, definirFormularioNovoFrete, cadastrarNovoFrete }: Propriedades) {
    return (<><Dialog open={cadastroAberto} onOpenChange={definirCadastroAberto}>
        <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-[28px] sm:w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Adicionar pedido</DialogTitle>
            <DialogDescription>Crie um processo de frete mockado para demonstrar o fluxo completo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Número do pedido" value={formularioNovoFrete.numeroPedido} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, numeroPedido: value }))}/>
            <Campo label="Cliente" value={formularioNovoFrete.cliente} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, cliente: value }))}/>
            <Campo label="Mercadoria" value={formularioNovoFrete.material} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, material: value }))}/>
            <Campo label="Origem" value={formularioNovoFrete.origem} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, origem: value }))}/>
            <Campo label="Destino" value={formularioNovoFrete.destino} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, destino: value }))}/>
            <Campo label="Cubagem (m³)" value={formularioNovoFrete.metrosCubicos} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, metrosCubicos: value }))} type="number"/>
            <Campo label="Peso (ton)" value={formularioNovoFrete.pesoToneladas} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, pesoToneladas: value }))} type="number"/>
            <Campo label="Previsão" value={formularioNovoFrete.previsaoEntrega} onChange={(value) => definirFormularioNovoFrete((atuais) => ({ ...atuais, previsaoEntrega: value }))} type="date"/>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirCadastroAberto(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={cadastrarNovoFrete}>Adicionar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
