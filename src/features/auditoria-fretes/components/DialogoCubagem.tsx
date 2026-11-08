import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcularCubagemM3 } from '../apresentacao';
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
import { Campo } from './ElementosFrete';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "cubagemAberta" | "definirCubagemAberta" | "pedidoErpSelecionado" | "formularioCubagem" | "definirFormularioCubagem" | "salvarCubagem">;
export function DialogoCubagem({ cubagemAberta, definirCubagemAberta, pedidoErpSelecionado, formularioCubagem, definirFormularioCubagem, salvarCubagem }: Propriedades) {
    return (<><Dialog open={cubagemAberta} onOpenChange={definirCubagemAberta}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Cubagem do pedido #{pedidoErpSelecionado?.numeroPedido}</DialogTitle>
            <DialogDescription>
              Ajuste volumes, medidas e peso antes de transformar o pedido demonstrativo em processo de frete.
            </DialogDescription>
          </DialogHeader>
          {pedidoErpSelecionado && (<div className="space-y-5">
              <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <PackageCheck className="mt-0.5 h-5 w-5 text-primary"/>
                  <div>
                    <p className="font-semibold text-foreground">{pedidoErpSelecionado.produtos}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pedidoErpSelecionado.quantidade} unidade(s), com {pedidoErpSelecionado.unidadesPorCaixa} unidade(s) por caixa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Campo label="Volumes" value={formularioCubagem.quantidadeVolumes} onChange={(value) => definirFormularioCubagem((atuais) => ({ ...atuais, quantidadeVolumes: value }))} type="number"/>
                <Campo label="Comprimento (cm)" value={formularioCubagem.comprimentoCm} onChange={(value) => definirFormularioCubagem((atuais) => ({ ...atuais, comprimentoCm: value }))} type="number"/>
                <Campo label="Largura (cm)" value={formularioCubagem.larguraCm} onChange={(value) => definirFormularioCubagem((atuais) => ({ ...atuais, larguraCm: value }))} type="number"/>
                <Campo label="Altura (cm)" value={formularioCubagem.alturaCm} onChange={(value) => definirFormularioCubagem((atuais) => ({ ...atuais, alturaCm: value }))} type="number"/>
                <Campo label="Peso (ton)" value={formularioCubagem.pesoToneladas} onChange={(value) => definirFormularioCubagem((atuais) => ({ ...atuais, pesoToneladas: value }))} type="number"/>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-semibold text-foreground">Cubagem calculada</p>
                <p className="mt-2 text-3xl font-semibold text-primary">
                  {calcularCubagemM3(Number(formularioCubagem.quantidadeVolumes) || 0, Number(formularioCubagem.comprimentoCm) || 0, Number(formularioCubagem.larguraCm) || 0, Number(formularioCubagem.alturaCm) || 0)}{" "}
                  m³
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fórmula: volumes x comprimento x largura x altura, convertendo centímetros para metros cúbicos.
                </p>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => definirCubagemAberta(false)}>Cancelar</Button>
            <Button className="rounded-2xl" onClick={salvarCubagem}>Salvar cubagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog></>);
}
