import { Plus, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { usePainelAuditoriaFretes } from '../use-painel-auditoria-fretes';
type Propriedades = Pick<ReturnType<typeof usePainelAuditoriaFretes>, "definirCadastroAberto" | "abrirPublicacaoTransporte">;
export function CabecalhoAuditoria({ definirCadastroAberto, abrirPublicacaoTransporte }: Propriedades) {
    return (<><Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"/>
        <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-emerald-200/20 blur-3xl"/>

        <CardContent className="relative grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="max-w-3xl space-y-5">
            <Badge className="w-fit rounded-full border border-white/16 bg-white/12 px-4 py-1.5 text-white hover:bg-white/12">
              <Sparkles className="mr-2 h-4 w-4"/>
              Processo logístico centralizado
            </Badge>
            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">Gestão de Fretes</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Acompanhe o fluxo demonstrativo, da cotação à entrega. Os dados e as ações são temporários nesta sessão.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="h-12 rounded-2xl bg-white px-5 text-emerald-800 hover:bg-white/90" onClick={() => definirCadastroAberto(true)}>
              <Plus className="mr-2 h-4 w-4"/>
              Adicionar pedido
            </Button>
            <Button variant="outline" className="h-12 rounded-2xl border-white/40 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white" onClick={() => abrirPublicacaoTransporte()}>
              <Send className="mr-2 h-4 w-4"/>
              Lançar transporte
            </Button>
          </div>
        </CardContent>
      </Card></>);
}
