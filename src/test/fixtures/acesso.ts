import type { EmpresaAutenticada } from "@/types/empresa";

export const empresaR1: EmpresaAutenticada = {
  id: "101", razaoSocial: "Empresa FICTÍCIA R1", cnpj: "11222333000181",
  email: "compras@example.invalid", telefone: "11999999999", segmento: "Indústria",
  ativo: true, roles: ["compradora", "transportadora"],
};

export function promessaControlada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promessa, resolver, rejeitar };
}
