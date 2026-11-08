/** Referências demonstrativas já existentes na interface, sem atualização de mercado. */
const PRECOS_REFERENCIA_LOCAIS: Readonly<Record<string, number>> = {
  "Plástico Industrial": 2.8,
  "Sucata Metálica": 8.5,
  "Papel e Papelão": 0.45,
  "Vidro Industrial": 0.3,
  "Borracha": 1.2,
};

export function obterPrecoReferenciaLocal(categoria: string): number {
  return PRECOS_REFERENCIA_LOCAIS[categoria] ?? 1;
}
