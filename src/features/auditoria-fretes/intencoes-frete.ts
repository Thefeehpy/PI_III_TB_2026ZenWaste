import { ErroApi } from "@/services/cliente-http";

export const EVENTO_INTENCOES_FRETE = "zenwaste:fretes-intencoes";
const prefixo = "zenwaste.fretes.pendentes.v1.";
// Só existe após uma resposta de comando validada; nunca é inferido da consulta/status.
const confirmadasNestaPagina = new Set<string>();
export interface IntencaoFrete {
  empresaId: string; escopo: string; caminho: string; resumo: string; chave: string;
  instancia: string; iniciadaEm: string; estado: "em_andamento" | "incerta" | "confirmada_localmente";
}
export class ErroProtecaoFrete extends ErroApi {
  constructor(mensagem: string) { super(mensagem, 409, { codigo: "intencao_pendente" }); }
}
/** Leitura não depende dessas capacidades. Escrita nunca usa substitutos inseguros. */
export function exigirCriptografiaFrete() {
  try {
    if (globalThis.isSecureContext === false || typeof globalThis.crypto?.randomUUID !== "function" ||
      typeof globalThis.crypto?.subtle?.digest !== "function") throw new Error();
  } catch {
    throw new ErroProtecaoFrete("Este ambiente não oferece criptografia segura para comandos de frete. Use HTTPS ou localhost em navegador compatível. Nenhuma operação foi enviada; as consultas continuam disponíveis.");
  }
}
function identidadeRegistro(i: IntencaoFrete) {
  return JSON.stringify([i.empresaId, i.escopo, i.caminho, i.chave, i.resumo, i.instancia]);
}
function validar(entrada: unknown, empresaId: string): entrada is IntencaoFrete[] {
  return Array.isArray(entrada) && new Set(entrada.map(i => i?.escopo)).size === entrada.length && entrada.every(i => i && i.empresaId === empresaId &&
    Object.keys(i).length === 8 && Object.keys(i).every(k => ["empresaId", "escopo", "caminho", "resumo", "chave", "instancia", "iniciadaEm", "estado"].includes(k)) &&
    typeof i.escopo === "string" && typeof i.caminho === "string" &&
    /^\/fretes\/(?:[a-f0-9-]+\/[a-z-]+\/)?$/.test(i.caminho) &&
    /^[a-f0-9]{64}$/.test(i.resumo) && /^[a-f0-9-]{36}$/.test(i.chave) &&
    i.escopo === (i.caminho === "/fretes/" ? "cadastro" : i.caminho.split("/")[2]) &&
    typeof i.instancia === "string" && typeof i.iniciadaEm === "string" &&
    ["em_andamento", "incerta"].includes(i.estado));
}
export function lerIntencoesFrete(empresaId: string | null, storage: Storage = localStorage): IntencaoFrete[] {
  if (!empresaId) return [];
  const texto = storage.getItem(prefixo + empresaId);
  if (!texto) return [];
  const dados: unknown = JSON.parse(texto);
  if (!validar(dados, empresaId)) throw new Error("Registro local de operações inválido.");
  return dados.map(i => confirmadasNestaPagina.has(identidadeRegistro(i)) ? { ...i, estado: "confirmada_localmente" } : i);
}

/** Não contém payload, assinatura, nome do recebedor, valores ou credenciais.
 * Uma pendência de outra instância NUNCA é considerada rejeitada por idade/status visual.
 */
export function criarProtecaoIntencoes(empresaId: string, storage?: Storage, locksFornecidos?: LockManager) {
  let instancia: string | undefined;
  const ambiente = () => {
    exigirCriptografiaFrete();
    let locks: LockManager | undefined;
    try { locks = locksFornecidos ?? globalThis.navigator?.locks; } catch { /* indisponível */ }
    if (typeof locks?.request !== "function")
      throw new ErroProtecaoFrete("Este navegador não oferece coordenação segura entre abas. Nenhuma operação foi enviada. Use um navegador compatível.");
    let destino: Storage;
    try { destino = storage ?? globalThis.localStorage; if (!destino) throw new Error(); }
    catch { throw new ErroProtecaoFrete("Não foi possível acessar a proteção local. Nenhuma operação foi enviada; verifique o armazenamento do navegador."); }
    return { locks, destino };
  };
  const gravar = (destino: Storage, dados: IntencaoFrete[]) => {
    if (dados.length) destino.setItem(prefixo + empresaId, JSON.stringify(dados.map(i =>
      i.estado === "confirmada_localmente" ? { ...i, estado: "em_andamento" } : i)));
    else destino.removeItem(prefixo + empresaId);
    window.dispatchEvent(new Event(EVENTO_INTENCOES_FRETE));
  };
  return {
    verificarDisponibilidade() { ambiente(); },
    async executar<T>(caminho: string, resumo: string, novaChave: string,
      exigirSessao: () => void, enviar: (chave: string) => Promise<T>): Promise<T> {
      const { locks, destino } = ambiente();
      const escopo = caminho === "/fretes/" ? "cadastro" : caminho.split("/")[2];
      // Só a atualização síncrona do registro compartilhado usa o mutex empresarial.
      const comRegistro = <R>(alterar: (dados: IntencaoFrete[]) => R) =>
        locks.request(`zenwaste-fretes-${empresaId}`, {}, () => {
          let dados: IntencaoFrete[];
          try { dados = lerIntencoesFrete(empresaId, destino); }
          catch { throw new ErroProtecaoFrete("Não foi possível ler a proteção local. Nenhuma nova operação foi enviada; preserve os dados e verifique o acesso ao armazenamento."); }
          return alterar(dados);
        });
      let entrou = false;
      try { return await locks.request(`zenwaste-fretes-${empresaId}:operacao:${escopo}`, { ifAvailable: true }, async lock => {
        entrou = true;
        if (!lock) throw new ErroProtecaoFrete("Há uma operação deste frete em andamento em outra aba. Aguarde e consulte o frete antes de reenviar.");
        exigirSessao();
        let preparada: { atual: IntencaoFrete; repeticao: boolean };
        try {
          instancia ??= crypto.randomUUID();
          preparada = await comRegistro(dados => {
            exigirSessao();
            const anterior = dados.find(i => i.escopo === escopo && i.estado !== "confirmada_localmente");
            if (anterior && (anterior.instancia !== instancia || anterior.caminho !== caminho || anterior.resumo !== resumo))
              throw new ErroProtecaoFrete("Existe uma operação de resultado não confirmado neste contexto. Consulte o frete e o histórico. Uma nova intenção está bloqueada; a reconciliação confiável depende de suporte do servidor.");
            const atual: IntencaoFrete = anterior ?? { empresaId, escopo, caminho, resumo, chave: novaChave,
              instancia: instancia!, iniciadaEm: new Date().toISOString(), estado: "em_andamento" };
            gravar(destino, [...dados.filter(i => i.escopo !== escopo), { ...atual, estado: "em_andamento" }]);
            return { atual, repeticao: Boolean(anterior) };
          });
        } catch (erro) {
          if (erro instanceof ErroApi) throw erro;
          throw new ErroProtecaoFrete("Não foi possível preparar a proteção local. Nenhuma operação foi enviada. Verifique o armazenamento do navegador.");
        }
        const { atual, repeticao } = preparada;
        const atualizarPropria = (remover: boolean) => comRegistro(dados => {
          const registro = dados.find(i => i.escopo === escopo);
          if (!registro || identidadeRegistro(registro) !== identidadeRegistro(atual))
            throw new ErroProtecaoFrete("O registro local desta intenção mudou. Os registros existentes foram preservados; solicite a verificação da operação.");
          gravar(destino, remover ? dados.filter(i => i.escopo !== escopo) :
            dados.map(i => i.escopo === escopo ? { ...i, estado: "incerta" } : i));
        });
        try {
          exigirSessao();
          const resultado = await enviar(atual.chave);
          const confirmacao = identidadeRegistro(atual);
          confirmadasNestaPagina.add(confirmacao);
          // Falha de limpeza não transforma confirmação do servidor em falha de gravação.
          try { await atualizarPropria(true); confirmadasNestaPagina.delete(confirmacao); }
          catch { window.dispatchEvent(new Event(EVENTO_INTENCOES_FRETE)); }
          return resultado;
        } catch (erro) {
          const rejeitada = erro instanceof ErroApi && erro.status >= 400 && erro.status < 500;
          try {
            await atualizarPropria(rejeitada && !repeticao);
          } catch { /* registro anterior permanece; não apagar certeza desconhecida */ }
          throw erro;
        }
      }); } catch (erro) {
        if (entrou || erro instanceof ErroApi) throw erro;
        throw new ErroProtecaoFrete("Não foi possível obter a coordenação segura entre abas. Nenhuma operação foi enviada.");
      }
    },
  };
}
