import { ErroApi, requisitar } from "@/services/cliente-http";
import type { CadastroEmpresa, EmpresaAutenticada } from "@/types/empresa";

function validarEmpresa(resposta: unknown): { user: EmpresaAutenticada } {
  const user = resposta && typeof resposta === "object" && "user" in resposta ? resposta.user : null;
  const campos = ["id", "razaoSocial", "cnpj", "email", "telefone", "segmento"] as const;
  if (!user || typeof user !== "object" || !campos.every((campo) => campo in user && typeof user[campo] === "string") ||
      !("ativo" in user) || user.ativo !== true || !("roles" in user) || !Array.isArray(user.roles) ||
      !user.roles.every((papel: unknown) => typeof papel === "string" && ["vendedora", "compradora", "transportadora"].includes(papel))) {
    throw new ErroApi("Não foi possível confirmar os dados da empresa. Tente novamente.", 200, { tipo: "resposta_invalida" });
  }
  const empresa = user as EmpresaAutenticada;
  if (!empresa.id.trim() || !empresa.razaoSocial.trim() || !/^\d{14}$/.test(empresa.cnpj.replace(/\D/g, ""))) {
    throw new ErroApi("Não foi possível confirmar os dados da empresa. Tente novamente.", 200, { tipo: "resposta_invalida" });
  }
  return { user: empresa };
}

export const servicoAutenticacao = {
  async cadastrar(entrada: CadastroEmpresa, opcoes: Pick<RequestInit, "signal"> = {}) {
    return validarEmpresa(await requisitar<unknown>("/auth/register/", {
      ...opcoes,
      method: "POST",
      body: JSON.stringify(entrada),
    }));
  },

  async entrar(email: string, senha: string, opcoes: Pick<RequestInit, "signal"> = {}) {
    const resposta = await requisitar<unknown>("/auth/login/", {
      ...opcoes,
      method: "POST",
      body: JSON.stringify({ email, password: senha }),
    });
    const { user } = validarEmpresa(resposta);
    if (!resposta || typeof resposta !== "object" || !("token" in resposta) || typeof resposta.token !== "string" || !resposta.token.trim()) {
      throw new ErroApi("A autenticação não retornou uma credencial válida.", 200, { tipo: "resposta_invalida" });
    }
    return { user, token: resposta.token };
  },

  async obterEmpresaAtual(opcoes: Pick<RequestInit, "signal"> = {}) {
    return validarEmpresa(await requisitar<unknown>("/auth/me/", opcoes));
  },

  sair() {
    return requisitar<{ message: string }>("/auth/logout/", { method: "POST" });
  },
};
