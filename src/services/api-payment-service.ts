import { servicoPedidos } from "@/services/servico-pedidos";
import type { PaymentService } from "@/types/payment";
import type { EmpresaAutenticada } from "@/types/empresa";
import { ErroApi, obterTokenAutenticacao } from "@/services/cliente-http";
import { validarCompradorEmpresarial } from "@/lib/payment";

export function createApiPaymentService(empresa: EmpresaAutenticada | null = null): PaymentService {
  const tokenSessao = obterTokenAutenticacao();
  const exigirSessao = () => {
    if (!empresa?.ativo || !tokenSessao || obterTokenAutenticacao() !== tokenSessao) {
      throw new ErroApi("Confirme a sessão da empresa antes de continuar a compra.", 409);
    }
  };
  return {
    mode: "demo",
    async createOrder(entrada) {
      exigirSessao();
      const erros = validarCompradorEmpresarial(entrada.buyer, empresa);
      if (Object.keys(erros).length) throw new ErroApi("Revise os dados da compra empresarial.", 400, { detalhes: { buyer: erros } });
      const pedido = await servicoPedidos.criar(entrada);
      exigirSessao();
      return pedido;
    },
    getOrder: servicoPedidos.obter,
    listOrders: servicoPedidos.listar,
    payWithCard: servicoPedidos.pagarComCartao,
    createPix: servicoPedidos.criarPix,
    cancelOrder: servicoPedidos.cancelar,
    simulateResult: servicoPedidos.simularResultado,
  };
}
