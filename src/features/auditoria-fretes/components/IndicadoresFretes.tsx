import { AlertTriangle, CheckCircle2, FileText, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
type Propriedades = { indicadores: { awaitingQuote: number; inProgress: number; divergent: number; delivered: number }; rotuloConcluidos?: string };
export function IndicadoresFretes({ indicadores, rotuloConcluidos = "Entregues no mês" }: Propriedades) {
    return (<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
            { label: "Aguardando cotação", value: indicadores.awaitingQuote, icon: FileText, color: "bg-warning/10 text-warning" },
            { label: "Em andamento", value: indicadores.inProgress, icon: Truck, color: "bg-primary/10 text-primary" },
            { label: "Com divergência", value: indicadores.divergent, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
            { label: rotuloConcluidos, value: indicadores.delivered, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600" },
        ].map((metric) => (<Card key={metric.label} className="rounded-[28px] border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{metric.value}</p>
              </div>
              <div className={cn("rounded-2xl p-3", metric.color)}>
                <metric.icon className="h-5 w-5"/>
              </div>
            </CardContent>
          </Card>))}
      </div></>);
}
