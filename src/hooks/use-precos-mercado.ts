import { useCallback, useEffect, useRef, useState } from "react";
import { servicoMercado } from "@/services/servico-mercado";
import type { PrecosMercado } from "@/types/mercado";

export function usePrecosMercado(servico: Pick<typeof servicoMercado, "obterPrecos"> = servicoMercado) {
  const { obterPrecos } = servico;
  const [dados, definirDados] = useState<PrecosMercado | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const sequencia = useRef(0);
  const ativo = useRef(false);
  const atualizar = useCallback(async () => {
    const requisicao = ++sequencia.current;
    definirCarregando(true);
    try {
      const resposta = await obterPrecos();
      if (!ativo.current || requisicao !== sequencia.current) return;
      definirDados(resposta);
      definirErro(null);
    } catch (falha) {
      if (!ativo.current || requisicao !== sequencia.current) return;
      definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar os preços de mercado.");
    } finally {
      if (ativo.current && requisicao === sequencia.current) definirCarregando(false);
    }
  }, [obterPrecos]);
  useEffect(() => {
    ativo.current = true;
    void atualizar();
    return () => { ativo.current = false; };
  }, [atualizar]);
  return { dados, carregando, erro, atualizar };
}
