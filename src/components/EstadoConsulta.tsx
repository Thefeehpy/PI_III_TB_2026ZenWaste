import { Button } from "@/components/ui/button";

interface EstadoConsultaProps {
  carregando: boolean;
  erro: string | null;
  tentarNovamente: () => void;
}

/** Estados de leitura compartilhados; o conteúdo da tela permanece sob sua composição. */
export function EstadoConsulta({ carregando, erro, tentarNovamente }: EstadoConsultaProps) {
  if (carregando) return <p role="status" className="py-4 text-sm text-muted-foreground">Carregando dados...</p>;
  if (!erro) return null;
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm">
      <span>{erro}</span>
      <Button type="button" variant="outline" size="sm" onClick={tentarNovamente}>Tentar novamente</Button>
    </div>
  );
}
