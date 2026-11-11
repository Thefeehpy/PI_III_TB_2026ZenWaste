import { useFormularioFrete, type PedirDescarte } from "./use-formulario-frete";
import { textoFrete, validarCamposFrete, errosCamposApi, type ErrosFrete } from "./validacoes";
import { validarRecebimentoFrete } from "./validacoes-operacionais";
import { acoesFrete } from "./permissoes-interface";
import type { FreteDetalheDTO } from "./tipos-api";
import type { useConsultaAuditoriaApi } from "./use-consulta-auditoria-api";

export type FormularioRecebimentoFrete = {
  nome: string; assinatura: string; tipo: "complete" | "with_reservation";
  ressalva: string; revisado: boolean;
};
const textoInicial = { texto: "" };
const recebimentoInicial: FormularioRecebimentoFrete = { nome: "", assinatura: "", tipo: "complete", ressalva: "", revisado: false };
type Consulta = Pick<ReturnType<typeof useConsultaAuditoriaApi>, "executar" | "informarErroComando" | "executando">;

export function useOperacoesFrete(contexto: object, frete: FreteDetalheDTO | null, dados: Consulta, pedirDescarte: PedirDescarte) {
  const tratativa = useFormularioFrete(contexto, textoInicial, pedirDescarte);
  const aceite = useFormularioFrete(contexto, textoInicial, pedirDescarte);
  const cancelamento = useFormularioFrete(contexto, textoInicial, pedirDescarte);
  const retirada = useFormularioFrete(contexto, textoInicial, pedirDescarte);
  const recebimento = useFormularioFrete(contexto, recebimentoInicial, pedirDescarte);
  const acoes = acoesFrete(frete);
  const autorizar = (permitida: boolean) => {
    if (permitida && frete) return true;
    dados.informarErroComando("A operação não está autorizada nos dados atuais. Atualize o frete para conferir permissões e situação.");
    return false;
  };
  const falha = (definir: (erros: ErrosFrete) => void, mapa: Record<string, string>) => (erro: unknown) => {
    const erros = errosCamposApi(erro, mapa); definir(erros); return Object.keys(erros).length > 0;
  };
  const abrir = (formulario: { abrir: (v: boolean) => void }) => (valor: boolean) => {
    if (dados.executando) return;
    dados.informarErroComando(null); formulario.abrir(valor);
  };
  const validarTexto = (formulario: typeof tratativa, limite: number, campo: string) => {
    const { valores, erros } = validarCamposFrete({ [campo]: () => textoFrete(formulario.formulario.texto, limite) });
    formulario.definirErros(erros);
    return Object.keys(erros).length ? null : valores[campo];
  };
  return {
    tratativa, aceite, cancelamento, retirada, recebimento,
    sujo: tratativa.sujo || aceite.sujo || cancelamento.sujo || retirada.sujo || recebimento.sujo,
    limpar: () => { tratativa.limpar(); aceite.limpar(); cancelamento.limpar(); retirada.limpar(); recebimento.limpar(); },
    abrirTratativa: abrir(tratativa), abrirAceite: abrir(aceite), abrirCancelamento: abrir(cancelamento),
    abrirRetirada: abrir(retirada), abrirRecebimento: abrir(recebimento),
    async registrarTratativa() {
      const texto = validarTexto(tratativa, 1000, "observacao");
      if (texto === null || !autorizar(acoes.tratativa)) return;
      if (await dados.executar(s => s.registrarTratativa(frete!.id, texto), falha(tratativa.definirErros, { observacao: "observacao" }), "Registro de tratativa interna")) tratativa.limpar();
    },
    async aceitarDiferenca() {
      const texto = validarTexto(aceite, 1000, "justificativa");
      if (texto === null || !autorizar(acoes.aceitar)) return;
      if (await dados.executar(s => s.resolverDivergencia(frete!.id, texto), falha(aceite.definirErros, { justificativa: "justificativa" }), "Aceite justificado")) aceite.limpar();
    },
    async cancelarFrete() {
      const texto = validarTexto(cancelamento, 1000, "justificativa");
      if (texto === null || !autorizar(acoes.cancelar)) return;
      if (await dados.executar(s => s.cancelar(frete!.id, texto), falha(cancelamento.definirErros, { justificativa: "justificativa" }), "Cancelamento de frete")) cancelamento.limpar();
    },
    async registrarRetirada() {
      const texto = validarTexto(retirada, 255, "nome_foto");
      if (texto === null || !autorizar(acoes.retirada)) return;
      if (await dados.executar(s => s.registrarRetirada(frete!.id, texto), falha(retirada.definirErros, { nome_foto: "nome_foto" }), "Registro de retirada")) retirada.limpar();
    },
    async confirmarRecebimento() {
      const f = recebimento.formulario;
      const { valores, erros } = validarRecebimentoFrete(f);
      if (!f.revisado) erros.revisado = "Revise os dados e a assinatura antes de confirmar o recebimento comercial.";
      recebimento.definirErros(erros);
      if (Object.keys(erros).length || !autorizar(acoes.recebimento)) return;
      if (await dados.executar(s => s.confirmarEntrega(frete!.id, {
        nome_recebedor: valores.nomeRecebedor, dados_assinatura: valores.dadosAssinatura,
        tipo_recebimento: f.tipo === "with_reservation" ? "com_ressalva" : "completo",
        ressalva: f.tipo === "with_reservation" ? valores.textoRessalva : "",
      }), falha(recebimento.definirErros, { nome_recebedor: "nomeRecebedor", dados_assinatura: "dadosAssinatura", ressalva: "textoRessalva", tipo_recebimento: "tipo" }), "Confirmação comercial de recebimento")) recebimento.limpar();
    },
  };
}
