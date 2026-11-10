import { Button } from "@/components/ui/button";

export function RecuperacaoSessao({ mensagem, tentarNovamente, sair }: {
  mensagem: string;
  tentarNovamente: () => void;
  sair: () => void;
}) {
  return (
    <section className="mx-auto my-6 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6" aria-labelledby="recuperacao-sessao-titulo">
      <h1 id="recuperacao-sessao-titulo" className="text-xl font-semibold">Não foi possível confirmar sua sessão</h1>
      <p role="alert" className="text-sm text-muted-foreground">{mensagem}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={tentarNovamente}>Tentar novamente</Button>
        <Button type="button" variant="outline" onClick={sair}>Usar outra conta</Button>
      </div>
    </section>
  );
}
