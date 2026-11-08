import { useCallback, useEffect, useRef, useState } from 'react';
import { criarServicoAuditoriaDemonstrativa, type ServicoAuditoriaFretes } from './servico-auditoria-fretes';
import type { EstadoAuditoriaFretes } from './tipos';
const estadoVazio: EstadoAuditoriaFretes = { processos: [], pedidosErpPendentes: [], transportesPublicados: [] };
export function useDadosAuditoriaFretes(servicoFornecido?: ServicoAuditoriaFretes) {
    const [servico] = useState(() => servicoFornecido ?? criarServicoAuditoriaDemonstrativa());
    const [estado, definirEstado] = useState(estadoVazio);
    const [carregando, definirCarregando] = useState(true);
    const [erro, informarErro] = useState<string | null>(null);
    const [executando, definirExecutando] = useState(false);
    const ativo = useRef(false);
    const sequencia = useRef(0);
    const comandoEmAndamento = useRef(false);
    const carregar = useCallback(async (sinal?: AbortSignal) => {
        const leitura = ++sequencia.current;
        definirCarregando(true);
        try {
            const resultado = await servico.carregar(sinal);
            if (!ativo.current || sinal?.aborted || leitura !== sequencia.current)
                return;
            definirEstado(resultado);
            informarErro(null);
        }
        catch (falha) {
            if (ativo.current && !sinal?.aborted && leitura === sequencia.current)
                informarErro(falha instanceof Error ? falha.message : 'Não foi possível carregar a auditoria de fretes.');
        }
        finally {
            if (ativo.current && !sinal?.aborted && leitura === sequencia.current)
                definirCarregando(false);
        }
    }, [servico]);
    useEffect(() => {
        ativo.current = true;
        const controle = new AbortController();
        void carregar(controle.signal);
        return () => { ativo.current = false; controle.abort(); };
    }, [carregar]);
    const executar = useCallback(async (comando: (servico: ServicoAuditoriaFretes) => Promise<EstadoAuditoriaFretes>): Promise<EstadoAuditoriaFretes | null> => {
        if (comandoEmAndamento.current || !ativo.current) return null;
        comandoEmAndamento.current = true;
        definirExecutando(true);
            if (!ativo.current)
                return null;
            try {
                const resultado = await comando(servico);
                ++sequencia.current;
                if (!ativo.current)
                    return null;
                definirEstado(resultado);
                definirCarregando(false);
                informarErro(null);
                return resultado;
            }
            catch (falha) {
                if (ativo.current)
                    informarErro(falha instanceof Error ? falha.message : 'Não foi possível concluir a operação demonstrativa.');
                return null;
            }
            finally {
                comandoEmAndamento.current = false;
                if (ativo.current) definirExecutando(false);
            }
    }, [servico]);
    return { estado, carregando, executando, erro, informarErro, executar, recarregar: () => carregar(), origem: servico.origem };
}
