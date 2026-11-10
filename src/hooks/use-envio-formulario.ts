import { useCallback, useEffect, useRef, useState } from "react";

/** Trava imediata e descarte de efeitos de um formulário que já foi desmontado. */
export function useEnvioFormulario(contexto: string) {
  const [pendente, definirPendente] = useState(false);
  const controle = useRef<AbortController | null>(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    definirPendente(false);
    return () => { montado.current = false; controle.current?.abort(); controle.current = null; };
  }, [contexto]);

  const executar = useCallback(async <T,>(operacao: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    if (controle.current) return undefined;
    const atual = new AbortController();
    controle.current = atual;
    definirPendente(true);
    try {
      const resposta = await operacao(atual.signal);
      return montado.current && !atual.signal.aborted && controle.current === atual ? resposta : undefined;
    } finally {
      if (montado.current && controle.current === atual) {
        controle.current = null;
        definirPendente(false);
      }
    }
  }, []);
  return { pendente, executar };
}
