/** Os nomes dos atributos preservam o contrato JSON de /auth/. */
export type PapelEmpresa = "vendedora" | "compradora" | "transportadora";

export interface EmpresaAutenticada {
  id: string;
  razaoSocial: string;
  cnpj: string;
  segmento: string;
  email: string;
  telefone: string;
  ativo: boolean;
  roles: PapelEmpresa[];
}

export type CadastroEmpresa = Pick<
  EmpresaAutenticada,
  "razaoSocial" | "cnpj" | "segmento" | "email" | "telefone"
> & {
  password: string;
};
