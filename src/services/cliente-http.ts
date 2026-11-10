const URL_API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const CHAVE_TOKEN = "zenwaste.auth-token";
export const EVENTO_SESSAO_ALTERADA = "zenwaste:sessao-alterada";

type TipoErroApi = "http" | "transporte" | "resposta_invalida";
interface OpcoesErroApi {
  detalhes?: unknown;
  codigo?: string;
  tipo?: TipoErroApi;
  causa?: unknown;
}

export class ErroApi extends Error {
  readonly detalhes: unknown;
  readonly codigo?: string;
  readonly tipo: TipoErroApi;
  readonly causa: unknown;

  constructor(mensagem: string, public readonly status: number, opcoes: OpcoesErroApi = {}) {
    super(mensagem);
    this.name = "ErroApi";
    this.detalhes = opcoes.detalhes;
    this.codigo = opcoes.codigo;
    this.tipo = opcoes.tipo ?? (status === 0 ? "transporte" : "http");
    this.causa = opcoes.causa;
  }

  mensagemCampo(...caminho: string[]): string | undefined {
    let valor = this.detalhes;
    for (const campo of caminho) {
      if (!valor || typeof valor !== "object" || !(campo in valor)) return undefined;
      valor = (valor as Record<string, unknown>)[campo];
    }
    return primeiraMensagem(valor);
  }
}

function primeiraMensagem(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor.trim() || undefined;
  if (Array.isArray(valor)) {
    for (const elemento of valor) {
      const mensagem = primeiraMensagem(elemento);
      if (mensagem) return mensagem;
    }
  } else if (valor && typeof valor === "object") {
    const campos = valor as Record<string, unknown>;
    const valores = [campos.message, campos.detail, campos.error,
      ...Object.entries(campos).filter(([chave]) => chave !== "code" && chave !== "codigo").map(([, elemento]) => elemento)];
    for (const elemento of valores) {
      const mensagem = primeiraMensagem(elemento);
      if (mensagem) return mensagem;
    }
  }
  return undefined;
}

export function obterTokenAutenticacao(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(CHAVE_TOKEN);
}

export function armazenarTokenAutenticacao(token: string): void {
  window.localStorage.setItem(CHAVE_TOKEN, token);
  window.dispatchEvent(new Event(EVENTO_SESSAO_ALTERADA));
}

export function removerTokenAutenticacao(): void {
  window.localStorage.removeItem(CHAVE_TOKEN);
  window.dispatchEvent(new Event(EVENTO_SESSAO_ALTERADA));
}

/** Transporte compartilhado. O token de empresa é enviado sem interpretar seu formato. */
export async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const cabecalhos = new Headers(opcoes.headers);
  const token = obterTokenAutenticacao();
  if (opcoes.body && !cabecalhos.has("Content-Type") && !(opcoes.body instanceof FormData)) {
    cabecalhos.set("Content-Type", "application/json");
  }
  if (token) cabecalhos.set("Authorization", `Bearer ${token}`);

  let resposta: Response;
  let conteudo: string;
  try {
    if (opcoes.signal?.aborted) throw opcoes.signal.reason ?? new DOMException("Requisição cancelada.", "AbortError");
    resposta = await fetch(`${URL_API}${caminho}`, { ...opcoes, headers: cabecalhos });
    conteudo = await resposta.text();
  } catch (erro) {
    if (opcoes.signal?.aborted || (erro && typeof erro === "object" && "name" in erro && erro.name === "AbortError")) throw erro;
    throw new ErroApi("Não foi possível conectar ao sistema. Tente novamente.", 0, { tipo: "transporte", causa: erro });
  }

  if (resposta.status === 204) return undefined as T;

  let dados: unknown;
  try {
    dados = conteudo ? JSON.parse(conteudo) : undefined;
  } catch {
    if (resposta.ok) throw new ErroApi("O backend retornou uma resposta inválida.", resposta.status, { tipo: "resposta_invalida" });
  }

  if (!resposta.ok) {
    const campos = dados && typeof dados === "object" ? dados as Record<string, unknown> : {};
    const codigo = campos.code ?? campos.codigo;
    throw new ErroApi(primeiraMensagem(dados) || "A requisição não pôde ser concluída.", resposta.status, {
      detalhes: dados, codigo: typeof codigo === "string" ? codigo : undefined,
    });
  }
  if (dados === undefined) throw new ErroApi("O backend retornou uma resposta vazia.", resposta.status, { tipo: "resposta_invalida" });

  // O service define o contrato JSON; validações de domínio permanecem no backend.
  return dados as T;
}
