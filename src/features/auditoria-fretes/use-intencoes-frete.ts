import { useEffect, useState } from "react";
import { EVENTO_INTENCOES_FRETE, lerIntencoesFrete, type IntencaoFrete } from "./intencoes-frete";

export function useIntencoesFrete(empresaId: string | null) {
  const [estado, definir] = useState<{ empresaId: string | null; pendentes: IntencaoFrete[]; erro: string | null }>({ empresaId: null, pendentes: [], erro: null });
  useEffect(() => {
    const atualizar = () => {
      try { definir({ empresaId, pendentes: lerIntencoesFrete(empresaId), erro: null }); }
      catch { definir({ empresaId, pendentes: [], erro: "Não foi possível consultar as proteções locais de operações. Novos envios dependem de leitura segura do armazenamento." }); }
    };
    atualizar();
    window.addEventListener("storage", atualizar);
    window.addEventListener(EVENTO_INTENCOES_FRETE, atualizar);
    return () => {
      window.removeEventListener("storage", atualizar);
      window.removeEventListener(EVENTO_INTENCOES_FRETE, atualizar);
    };
  }, [empresaId]);
  return estado.empresaId === empresaId ? estado : { empresaId, pendentes: [], erro: null };
}
