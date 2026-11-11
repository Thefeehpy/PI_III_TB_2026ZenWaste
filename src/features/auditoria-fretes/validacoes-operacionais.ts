import { textoFrete, validarCamposFrete } from "./validacoes";

/** Verificação auxiliar do envelope e estrutura PNG; identidade/conteúdo e validação final pertencem ao servidor. */
export function validarAssinaturaFrete(valor: string) {
  if (!valor) throw new Error("Registre a assinatura manuscrita do recebedor. O aceite eletrônico ainda não está disponível.");
  if (valor.length > 700000) throw new Error("A assinatura excede o limite de 700000 caracteres. Limpe e assine novamente.");
  const prefixo = "data:image/png;base64,";
  if (!valor.startsWith(prefixo) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(valor.slice(prefixo.length)))
    throw new Error("A assinatura deve ser uma imagem PNG/base64 válida.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(valor.slice(prefixo.length)), c => c.charCodeAt(0)); }
  catch { throw new Error("A assinatura contém base64 inválido."); }
  const assinatura = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!assinatura.every((b, i) => bytes[i] === b)) throw new Error("A assinatura deve ser uma imagem PNG válida.");
  const view = new DataView(bytes.buffer);
  let pos = 8, cabecalho = false, imagem = false;
  while (pos + 12 <= bytes.length) {
    const tamanho = view.getUint32(pos), fim = pos + tamanho + 12;
    const tipo = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
    if (fim > bytes.length) break;
    if (!cabecalho) {
      if (tipo !== "IHDR" || tamanho !== 13) break;
      const largura = view.getUint32(pos + 8), altura = view.getUint32(pos + 12);
      if (!largura || !altura || largura > 4096 || altura > 4096 || largura * altura > 4194304)
        throw new Error("As dimensões da assinatura ultrapassam o limite permitido.");
      cabecalho = true;
    } else if (["IHDR", "acTL", "fcTL", "fdAT"].includes(tipo)) break;
    if (tipo === "IDAT") imagem = true;
    if (tipo === "IEND" && tamanho === 0 && fim === bytes.length && imagem) return valor;
    pos = fim;
  }
  throw new Error("A imagem da assinatura está incompleta ou inválida. Limpe e assine novamente.");
}
export function validarRecebimentoFrete(f: { nome: string; assinatura: string; tipo: "complete" | "with_reservation"; ressalva: string }) {
  return validarCamposFrete({
    nomeRecebedor: () => textoFrete(f.nome, 120),
    dadosAssinatura: () => validarAssinaturaFrete(f.assinatura),
    textoRessalva: () => textoFrete(f.ressalva, 1000, f.tipo === "with_reservation"),
  });
}
