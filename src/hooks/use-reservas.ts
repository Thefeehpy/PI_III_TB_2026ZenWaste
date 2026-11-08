import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { servicoReservas } from "@/services/servico-reservas";
import type { Reserva } from "@/types/reserva";

interface SessaoReservas { empresaId: string | null }
interface EstadoReservas { sessao: SessaoReservas; reservas: Reserva[]; carregando: boolean; erro: string | null }
function estadoInicial(sessao: SessaoReservas): EstadoReservas {
  return { sessao, reservas: [], carregando: Boolean(sessao.empresaId), erro: null };
}

export function useReservas(empresaId: string | null, servico = servicoReservas) {
  const sessao = useMemo(() => ({ empresaId }), [empresaId]);
  const sessaoAtiva = useRef<SessaoReservas | null>(sessao);
  const sequenciaConsulta = useRef(0);
  const [estado, definirEstado] = useState(() => estadoInicial(sessao));
  useLayoutEffect(() => {
    sessaoAtiva.current = sessao;
    return () => { sessaoAtiva.current = null; };
  }, [sessao]);

  const atualizarReservas = useCallback(async () => {
    if (!sessao.empresaId) return;
    const sequencia = ++sequenciaConsulta.current;
    const aplicar = (campos: Partial<EstadoReservas>) => {
      if (sessaoAtiva.current !== sessao || sequencia !== sequenciaConsulta.current) return;
      definirEstado((anterior) => sessaoAtiva.current === sessao && sequencia === sequenciaConsulta.current
        ? { ...(anterior.sessao === sessao ? anterior : estadoInicial(sessao)), ...campos }
        : anterior);
    };
    aplicar({ carregando: true });
    try {
      const resposta = await servico.listarReservas();
      aplicar({ reservas: resposta.items, erro: null });
    } catch (erro) {
      aplicar({ erro: erro instanceof Error ? erro.message : "Não foi possível carregar as reservas." });
    } finally {
      aplicar({ carregando: false });
    }
  }, [servico, sessao]);

  useEffect(() => {
    void atualizarReservas();
  }, [atualizarReservas]);
  const dados = estado.sessao === sessao ? estado : estadoInicial(sessao);
  return { ...dados, atualizarReservas };
}
