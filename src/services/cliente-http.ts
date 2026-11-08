const URL_API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const CHAVE_TOKEN = "zenwaste.auth-token";

export class ErroApi extends Error {
  constructor(mensagem: string, public readonly status: number) {
    super(mensagem);
    this.name = "ErroApi";
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
    const valores = [campos.message, campos.detail, campos.error, ...Object.values(campos)];
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
}

export function removerTokenAutenticacao(): void {
  window.localStorage.removeItem(CHAVE_TOKEN);
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
    resposta = await fetch(`${URL_API}${caminho}`, { ...opcoes, headers: cabecalhos });
    conteudo = await resposta.text();
  } catch (erro) {
    if (opcoes.signal?.aborted || (erro && typeof erro === "object" && "name" in erro && erro.name === "AbortError")) throw erro;
    throw new ErroApi("Não foi possível conectar ao backend Django.", 0);
  }

  if (resposta.status === 204) return undefined as T;

  let dados: unknown;
  try {
    dados = conteudo ? JSON.parse(conteudo) : undefined;
  } catch {
    if (resposta.ok) throw new ErroApi("O backend retornou uma resposta inválida.", resposta.status);
  }

  if (!resposta.ok) {
    throw new ErroApi(primeiraMensagem(dados) || "A requisição não pôde ser concluída.", resposta.status);
  }
  if (dados === undefined) throw new ErroApi("O backend retornou uma resposta vazia.", resposta.status);

  // O service define o contrato JSON; validações de domínio permanecem no backend.
  return dados as T;
}
