export interface EnderecoCep {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/** Serviço externo separado: o token da empresa nunca é enviado ao ViaCEP. */
export const servicoEnderecos = {
  async consultarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep> {
    if (!/^\d{8}$/.test(cep)) throw new Error("Informe um CEP com 8 números.");
    let resposta: Response;
    try {
      resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
    } catch (erro) {
      if (signal?.aborted) throw erro;
      throw new Error("Não foi possível consultar o CEP.");
    }
    if (!resposta.ok) throw new Error("Não foi possível consultar o CEP.");

    let dados: unknown;
    try {
      dados = await resposta.json();
    } catch {
      throw new Error("Resposta inválida na consulta do CEP.");
    }
    if (!dados || typeof dados !== "object") throw new Error("Resposta inválida na consulta do CEP.");
    const endereco = dados as Record<string, unknown>;
    if (endereco.erro || typeof endereco.localidade !== "string" || !endereco.localidade || typeof endereco.uf !== "string" || !endereco.uf) {
      throw new Error("CEP não encontrado.");
    }
    return {
      street: typeof endereco.logradouro === "string" ? endereco.logradouro : "",
      neighborhood: typeof endereco.bairro === "string" ? endereco.bairro : "",
      city: endereco.localidade,
      state: endereco.uf,
    };
  },
};
