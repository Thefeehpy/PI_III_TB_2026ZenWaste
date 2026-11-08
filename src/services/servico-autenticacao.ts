import { requisitar } from "@/services/cliente-http";
import type { CadastroEmpresa, EmpresaAutenticada } from "@/types/empresa";

export const servicoAutenticacao = {
  cadastrar(entrada: CadastroEmpresa) {
    return requisitar<{ user: EmpresaAutenticada }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(entrada),
    });
  },

  entrar(email: string, senha: string) {
    return requisitar<{ token: string; user: EmpresaAutenticada }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password: senha }),
    });
  },

  obterEmpresaAtual() {
    return requisitar<{ user: EmpresaAutenticada }>("/auth/me/");
  },

  sair() {
    return requisitar<{ message: string }>("/auth/logout/", { method: "POST" });
  },
};
