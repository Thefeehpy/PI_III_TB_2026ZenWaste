import { existsSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raizRepositorio = fileURLToPath(new URL("../../", import.meta.url));
let pastaExecucao: string | undefined;
const versoes = new Map<string, number>();

function estaDentro(raiz: string, caminho: string): boolean {
  const trecho = relative(raiz, caminho);
  return trecho === "" || (trecho !== ".." && !trecho.startsWith(".." + sep) && !isAbsolute(trecho));
}

function caminhoCanonico(caminho: string): string {
  const absoluto = resolve(caminho);
  if (existsSync(absoluto)) return realpathSync.native(absoluto);
  const pai = dirname(absoluto);
  return resolve(caminhoCanonico(pai), relative(pai, absoluto));
}

export function diretorioResultados(): string {
  if (pastaExecucao) return pastaExecucao;
  const destino = resolve(
    raizRepositorio,
    process.env.ZENWASTE_DIRETORIO_EVIDENCIAS?.trim() || "test-results",
  );
  const repositorioReal = caminhoCanonico(raizRepositorio);
  const destinoReal = caminhoCanonico(destino);
  const padrao = join(repositorioReal, "test-results");
  if (
    estaDentro(destinoReal, repositorioReal) ||
    (estaDentro(repositorioReal, destinoReal) && !estaDentro(padrao, destinoReal))
  ) {
    throw new Error("Use test-results dentro do repositorio ou um destino externo exclusivo para testes.");
  }
  mkdirSync(destino, { recursive: true });
  // O runner limpa apenas uma subpasta nova, nunca o destino configurado inteiro.
  pastaExecucao = mkdtempSync(join(destino, "execucao-"));
  return pastaExecucao;
}

export function caminhoEvidencia(nome: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*\.png$/.test(nome)) {
    throw new Error("Use apenas um nome PNG simples, sem caminhos, espacos ou acentos.");
  }
  const pasta = join(diretorioResultados(), "evidencias");
  mkdirSync(pasta, { recursive: true });
  const versao = (versoes.get(nome) || 0) + 1;
  versoes.set(nome, versao);
  return join(pasta, versao === 1 ? nome : nome.slice(0, -4) + "_v" + versao + ".png");
}

