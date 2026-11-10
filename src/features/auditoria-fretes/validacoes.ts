import { ErroApi } from "@/services/cliente-http";
import type { CadastroFreteDTO, ClassificacaoFreteDTO, PedidoDisponivelFreteDTO } from "./tipos-api";

export type ErrosFrete = Record<string, string>;
export type CadastroFrete = {
  tipo: "pedido" | "avulso";
  pedidoId: string; compradoraId: string; compradoraNome?: string; quantidade: string;
  material: string; unidade: string; origem: string; destino: string;
  pesoToneladas: string; metrosCubicos: string; quantidadeVolumes: string;
  previsaoEntrega: string;
  pedido: PedidoDisponivelFreteDTO | null;
};
export const cadastroInicial: CadastroFrete = {
  tipo: "pedido", pedidoId: "", compradoraId: "", quantidade: "",
  material: "", unidade: "kg", origem: "", destino: "", pesoToneladas: "",
  metrosCubicos: "", quantidadeVolumes: "", previsaoEntrega: "", pedido: null,
};
export const classificacaoInicial = {
  modalidade: "cotar" as ClassificacaoFreteDTO["modalidade"],
  transportadoraId: "", valorReferencia: "",
};
type Resultado<T> = { entrada: T | null; erros: ErrosFrete };

/** Decimal textual: sem conversão binária, arredondamento ou separador de milhar. */
export function decimalFrete(texto: string, casas: 2 | 3, minimo = "0") {
  const valor = texto.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor))
    throw new Error("Informe um número positivo ou zero, com vírgula ou ponto e sem separador de milhar.");
  const [inteiroBruto, fracao = ""] = valor.split(".");
  const inteiro = inteiroBruto.replace(/^0+/, "") || "0";
  if (fracao.length > casas)
    throw new Error(`Use no máximo ${casas} casas decimais, sem arredondar.`);
  if (inteiro.length > 12 - casas)
    throw new Error(`Use no máximo ${12 - casas} dígitos antes da vírgula.`);
  const normalizado = fracao ? `${inteiro}.${fracao}` : inteiro;
  if (medidaInteira(normalizado) < medidaInteira(minimo))
    throw new Error(`O mínimo permitido é ${minimo.replace(".", ",")}.`);
  return normalizado;
}
function medidaInteira(valor: string) {
  const [inteiro, fracao = ""] = valor.split(".");
  return BigInt(inteiro) * 1000n + BigInt(fracao.padEnd(3, "0"));
}
export function inteiroFrete(texto: string, minimo: number) {
  const valor = texto.trim();
  // PositiveIntegerField no PostgreSQL: o limite é técnico, não comercial.
  if (!/^\d+$/.test(valor) || BigInt(valor) < BigInt(minimo) || BigInt(valor) > 2147483647n)
    throw new Error(`Informe um inteiro entre ${minimo} e 2147483647.`);
  return Number(valor);
}
export function identificadorEmpresa(texto: string) {
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) < 1)
    throw new Error("Selecione uma empresa cadastrada válida.");
  return Number(texto);
}
export function textoFrete(texto: string, limite: number, obrigatorio = true) {
  const valor = texto.trim();
  if (obrigatorio && !valor) throw new Error("Preencha este campo.");
  if (Array.from(valor).length > limite) throw new Error(`Use até ${limite} caracteres.`);
  return valor;
}
export function dataFrete(texto: string) {
  if (!texto) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error("Informe uma data válida.");
  const [ano, mes, dia] = texto.split("-").map(Number);
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > dias[mes - 1])
    throw new Error("Informe uma data válida.");
  return texto;
}

/** Acumula erros por campo sem interromper a revisão dos demais campos. */
export function validarCamposFrete<T extends Record<string, () => unknown>>(regras: T) {
  const erros: ErrosFrete = {};
  const valores = {} as { [K in keyof T]: ReturnType<T[K]> };
  for (const campo of Object.keys(regras) as (keyof T & string)[]) {
    try { valores[campo] = regras[campo]() as ReturnType<T[typeof campo]>; }
    catch (erro) { erros[campo] = erro instanceof Error ? erro.message : "Revise este campo."; }
  }
  return { erros, valores };
}

export function validarCadastroFrete(formulario: CadastroFrete): Resultado<CadastroFreteDTO> {
  const f = formulario;
  const { erros, valores } = validarCamposFrete({
    quantidade: () => decimalFrete(f.quantidade, 3, "0.001"),
    origem: () => textoFrete(f.origem, 255), destino: () => textoFrete(f.destino, 255),
    pesoToneladas: () => decimalFrete(f.pesoToneladas, 3),
    metrosCubicos: () => decimalFrete(f.metrosCubicos, 3),
    quantidadeVolumes: () => inteiroFrete(f.quantidadeVolumes, 0),
    previsaoEntrega: () => dataFrete(f.previsaoEntrega),
    ...(f.tipo === "avulso" ? {
      compradoraId: () => identificadorEmpresa(f.compradoraId),
      material: () => textoFrete(f.material, 256), unidade: () => textoFrete(f.unidade, 12),
    } : {}),
  });
  if (f.tipo === "pedido") {
    if (!f.pedido || f.pedido.id !== f.pedidoId)
      erros.pedidoId = "Selecione um pedido disponível para remessa.";
    else {
      const restante = decimalFrete(f.pedido.quantidade_restante, 3);
      if (medidaInteira(restante) === 0n) erros.pedidoId = "Este pedido está sem saldo para remessa. Atualize os pedidos.";
      else if (!erros.quantidade && medidaInteira(valores.quantidade) > medidaInteira(restante))
        erros.quantidade = `A quantidade supera o restante consultado: ${restante.replace(".", ",")} ${f.pedido.unidade}. Atualize os pedidos se necessário.`;
    }
  }
  if (Object.keys(erros).length) return { entrada: null, erros };
  return { erros, entrada: {
    quantidade: valores.quantidade, origem: valores.origem, destino: valores.destino,
    peso_toneladas: valores.pesoToneladas, cubagem_m3: valores.metrosCubicos,
    quantidade_volumes: valores.quantidadeVolumes, previsao_entrega: valores.previsaoEntrega,
    ...(f.tipo === "pedido" ? { pedido_id: f.pedidoId } : {
      empresa_compradora_id: valores.compradoraId!, material: valores.material!, unidade: valores.unidade!,
    }),
  } };
}
export function validarClassificacaoFrete(f: typeof classificacaoInicial): Resultado<ClassificacaoFreteDTO> {
  if (f.modalidade !== "contratado") return { erros: {}, entrada: { modalidade: f.modalidade } };
  const { erros, valores } = validarCamposFrete({
    transportadoraId: () => identificadorEmpresa(f.transportadoraId),
    valorReferencia: () => decimalFrete(f.valorReferencia, 2),
  });
  return { erros, entrada: Object.keys(erros).length ? null : {
    modalidade: f.modalidade, transportadora_id: valores.transportadoraId, valor_referencia: valores.valorReferencia,
  } };
}
export function errosCamposApi(erro: unknown, campos: Record<string, string>): ErrosFrete {
  if (!(erro instanceof ErroApi) || erro.status !== 400) return {};
  const erros: ErrosFrete = {};
  for (const [api, campo] of Object.entries(campos)) {
    const mensagem = erro.mensagemCampo(api);
    if (mensagem) erros[campo] = mensagem;
  }
  return erros;
}
export function mensagemErroFrete(erro: unknown) {
  if (erro instanceof ErroApi) {
    if (erro.status === 401) return "A sessão precisa ser verificada. Aguarde a confirmação do acesso.";
    if (erro.status === 403) return `Sua empresa não tem autorização para esta operação. ${erro.message}`;
    if (erro.status === 409) return `Conflito com o estado atual: ${erro.message} Atualize os dados antes de tentar novamente.`;
    if (erro.status >= 500 || erro.status === 0)
      return "Não foi possível confirmar o resultado. Preserve os dados e tente novamente; a proteção de idempotência será reutilizada.";
  }
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}
