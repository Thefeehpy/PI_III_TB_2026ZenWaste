import { CampoAuditoria } from "./CampoAuditoria";
import { FormularioCadastroFrete } from "./FormularioCadastroFrete";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { RecebimentoFrete } from "./RecebimentoFrete";
import type { usePainelAuditoriaIntegrada } from "../use-painel-auditoria-integrada";
import {
  classeCampo,
  DialogoOperacaoFrete,
  SeletorEmpresaFrete,
} from "./ControlesAuditoriaIntegrada";

export function DialogosAuditoriaIntegrada({
  painel,
}: {
  painel: ReturnType<typeof usePainelAuditoriaIntegrada>;
}) {
  const { dados } = painel;
  const comum = { executando: dados.executando, erro: dados.erroComando, aoAtualizar: () => {
    void dados.recarregar();
    if (!painel.cadastroAberto && dados.idSelecionado) void dados.abrirDetalhe(dados.idSelecionado);
  } };
  const cadastro = painel.formularioCadastro;
  const cotacao = painel.formularioCotacao;
  const classificacao = painel.formularioClassificacao;
  const publicacao = painel.formularioPublicacao;
  const documento = painel.formularioDocumento;
  const ops = painel.operacoes;
  return (
    <>
      <AlertDialog open={Boolean(painel.descarte)} onOpenChange={aberto => { if (!aberto) painel.cancelarDescarte(); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Descartar dados preenchidos?</AlertDialogTitle>
            <AlertDialogDescription>{painel.descarte?.descricao}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction onClick={painel.confirmarDescarte}>Descartar e continuar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DialogoOperacaoFrete {...comum} validarLocalmente amplo
        aberto={painel.cadastroAberto} aoAbrir={painel.definirCadastroAberto}
        titulo="Cadastrar frete" descricao="Organize a remessa, confira os dados e confirme o cadastro."
        rotuloConfirmar="Criar frete" erros={painel.errosCadastro} aoConfirmar={painel.cadastrarFrete}
        filhos={<FormularioCadastroFrete formulario={cadastro} alterar={painel.definirFormularioCadastro}
          trocarTipo={painel.trocarTipoCadastro} selecionarPedido={painel.selecionarPedido}
          pedidos={dados.pedidos} carregando={dados.carregando} erroConsulta={dados.erroPedidos}
          aoRecarregar={() => { void dados.recarregar(); }} aoPaginar={dados.alterarPaginaPedidos}
          consultarCompradoras={dados.consultarCompradoras} erros={painel.errosCadastro} />}
      />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.classificacaoAberta}
        aoAbrir={painel.definirClassificacaoAberta}
        titulo="Classificar frete"
        validarLocalmente
        erros={painel.errosClassificacao}
        rotuloConfirmar="Salvar classificação"
        descricao="Frete cadastrado; classificação pendente. Defina a modalidade em uma operação separada. Retirada pelo cliente dispensa cotação e CT-e neste fluxo."
        aoConfirmar={painel.classificarFrete}
        filhos={
          <>
            <label className="block space-y-2">
              <span>Modalidade</span>
              <select
                className={classeCampo}
                value={classificacao.modalidade}
                onChange={evento => painel.trocarModalidadeClassificacao(evento.target.value as typeof classificacao.modalidade)}
                aria-invalid={Boolean(painel.errosClassificacao.modalidade)}
                aria-describedby={painel.errosClassificacao.modalidade ? "erro-modalidade" : undefined}
              >
                <option value="cotar">Cotar frete</option>
                <option value="contratado">Frete já contratado</option>
                <option value="retirada_cliente">Retirada pelo cliente</option>
              </select>
            </label>
            {painel.errosClassificacao.modalidade && <p id="erro-modalidade" className="text-sm text-destructive">{painel.errosClassificacao.modalidade}</p>}
            {classificacao.modalidade === "contratado" && (
              <>
                <SeletorEmpresaFrete
                  rotulo="Transportadora"
                  valor={classificacao.transportadoraId}
                  erroCampo={painel.errosClassificacao.transportadoraId}
                  aoAlterar={(valor) =>
                    painel.definirFormularioClassificacao({
                      ...classificacao,
                      transportadoraId: valor,
                    })
                  }
                  consultar={dados.consultarTransportadoras}
                />
                <CampoAuditoria
                  rotulo="Valor de referência"
                  formato="moeda"
                  erro={painel.errosClassificacao.valorReferencia}
                  valor={classificacao.valorReferencia}
                  aoAlterar={(valor) =>
                    painel.definirFormularioClassificacao({
                      ...classificacao,
                      valorReferencia: valor,
                    })
                  }
                />
              </>
            )}
          </>
        }
      />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.cotacaoAberta}
        aoAbrir={painel.definirCotacaoAberta}
        titulo="Registrar cotação"
        validarLocalmente
        erros={painel.errosCotacao}
        descricao="Selecione uma transportadora cadastrada e registre sua proposta."
        aoConfirmar={painel.cadastrarCotacao}
        filhos={
          <>
            <SeletorEmpresaFrete
              rotulo="Transportadora"
              valor={cotacao.transportadora}
              erroCampo={painel.errosCotacao.transportadora}
              aoAlterar={(valor) =>
                painel.definirFormularioCotacao({
                  ...cotacao,
                  transportadora: valor,
                })
              }
              consultar={dados.consultarTransportadoras}
            />
            {(
              [
                ["valor", "Valor da cotação"],
                ["prazoDias", "Prazo em dias"],
                ["observacao", "Observação"],
              ] as const
            ).map(([campo, rotulo]) => (
              <CampoAuditoria
                key={campo}
                rotulo={rotulo}
                valor={cotacao[campo]}
                formato={campo === "observacao" ? undefined : campo === "prazoDias" ? "inteiro" : "moeda"}
                limite={campo === "observacao" ? 1000 : undefined}
                erro={painel.errosCotacao[campo]}
                obrigatorio={campo !== "observacao"}
                aoAlterar={(valor) =>
                  painel.definirFormularioCotacao({
                    ...cotacao,
                    [campo]: valor,
                  })
                }
              />
            ))}
          </>
        }
      />
      <DialogoOperacaoFrete {...comum} validarLocalmente aberto={painel.documentoAberto} aoAbrir={painel.definirDocumentoAberto}
        titulo={painel.dados.detalhe?.documentos.length ? "Registrar correção do CT-e" : "Registrar CT-e"}
        descricao="Registre dados comerciais para auditoria. Uma correção preserva as versões anteriores, substitui a pendência anterior e pode abrir outra divergência. Não emite CT-e fiscal."
        erros={painel.errosDocumento} aoConfirmar={painel.registrarDocumentos} rotuloConfirmar="Confirmar registro do CT-e"
        filhos={<>
          {([["numeroCte", "Número do CT-e"], ["valorCte", "Valor do CT-e"], ["nomeArquivo", "Nome do arquivo CT-e"], ["arquivoNfe", "Referência NF-e"]] as const).map(([campo, rotulo]) =>
            <CampoAuditoria key={campo} rotulo={rotulo} valor={documento[campo]} formato={campo === "valorCte" ? "moeda" : undefined}
              limite={campo === "valorCte" ? undefined : campo === "numeroCte" ? 60 : 255} obrigatorio={campo === "numeroCte" || campo === "valorCte"}
              erro={painel.errosDocumento[campo]} aoAlterar={valor => painel.definirFormularioDocumento({ ...documento, [campo]: valor })} />)}
          <p className="rounded-xl border p-3 text-sm">Revise o número e o valor antes de confirmar. Nomes de arquivos são somente metadados: não há upload, download, emissão oficial ou consulta à SEFAZ.</p>
        </>} />
      <DialogoOperacaoFrete {...comum} validarLocalmente aberto={painel.tratativaAberta} aoAbrir={painel.definirTratativaAberta}
        titulo="Registrar tratativa interna" descricao="Este registro integra o histórico interno, com autoria e data do servidor. Não envia e-mail, mensagem ou notificação externa."
        erros={ops.tratativa.erros} aoConfirmar={painel.registrarTratativa} rotuloConfirmar="Confirmar registro interno"
        filhos={<CampoAuditoria rotulo="Observação da tratativa" linhas={4} limite={1000} valor={painel.textoTratativa} erro={ops.tratativa.erros.observacao} aoAlterar={painel.definirTextoTratativa} />} />
      <DialogoOperacaoFrete {...comum} validarLocalmente aberto={painel.resolucaoAberta} aoAbrir={painel.definirResolucaoAberta}
        titulo="Aceitar diferença com justificativa" descricao="Resolve a pendência financeira registrada. O valor cobrado e a diferença factual serão preservados, com autoria e justificativa no histórico. Não corrige o CT-e."
        erros={ops.aceite.erros} aoConfirmar={painel.resolverDivergencia} rotuloConfirmar="Confirmar aceite da diferença"
        filhos={<CampoAuditoria rotulo="Justificativa do aceite" linhas={4} limite={1000} valor={painel.justificativaResolucao} erro={ops.aceite.erros.justificativa} aoAlterar={painel.definirJustificativaResolucao} />} />
      <DialogoOperacaoFrete {...comum} validarLocalmente destrutiva aberto={painel.cancelamentoAberto} aoAbrir={painel.definirCancelamentoAberto}
        titulo="Cancelar frete" descricao="Confirme o cancelamento deste frete antes de retirada, recebimento ou encerramento. A ação não cancela o pedido, não estorna pagamento e não movimenta estoque."
        erros={ops.cancelamento.erros} aoConfirmar={painel.cancelarFrete} rotuloConfirmar="Confirmar cancelamento do frete"
        filhos={<CampoAuditoria rotulo="Justificativa do cancelamento" linhas={4} limite={1000} valor={painel.justificativaCancelamento} erro={ops.cancelamento.erros.justificativa} aoAlterar={painel.definirJustificativaCancelamento} />} />
      <DialogoOperacaoFrete {...comum} validarLocalmente aberto={ops.retirada.aberto} aoAbrir={ops.abrirRetirada}
        titulo="Registrar retirada" descricao="Registra a retirada comercial autorizada. Não resolve divergência financeira nem envia fotografia. Confira o metadado e confirme a operação."
        erros={ops.retirada.erros} aoConfirmar={painel.registrarRetirada} rotuloConfirmar="Confirmar registro de retirada"
        filhos={<CampoAuditoria rotulo="Nome da foto de retirada (metadado)" limite={255} valor={painel.nomeFotoRetirada} erro={ops.retirada.erros.nome_foto} aoAlterar={painel.definirNomeFotoRetirada} />} />
      <DialogoOperacaoFrete {...comum} validarLocalmente amplo aberto={painel.entregaAberta} aoAbrir={painel.definirEntregaAberta}
        titulo="Confirmar recebimento comercial" descricao="Ação da empresa compradora autorizada. Uma divergência financeira aberta permanece pendente após o recebimento. Não confirma MTR/SIGOR."
        erros={ops.recebimento.erros} aoConfirmar={painel.confirmarEntrega} rotuloConfirmar="Confirmar recebimento comercial"
        filhos={<RecebimentoFrete formulario={ops.recebimento.formulario} alterar={ops.recebimento.definir} erros={ops.recebimento.erros}
          empresa={dados.detalhe?.empresa_compradora.razao_social ?? "Não disponibilizada"} identificacao={dados.detalhe?.numero_pedido ?? "Não disponibilizado"} />} />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.publicacaoAberta}
        aoAbrir={painel.definirPublicacaoAberta}
        titulo="Registrar demanda interna"
        validarLocalmente
        erros={painel.errosPublicacao}
        descricao="A demanda ficará vinculada a este frete, sem envio automático a transportadoras."
        aoConfirmar={painel.publicarTransporte}
        filhos={
          <>
            {(
              [
                ["valorSugerido", "Valor sugerido"],
                ["janelaColeta", "Janela de coleta"],
                ["tipoVeiculo", "Tipo de veículo"],
                ["observacoes", "Observações da demanda"],
              ] as const
            ).map(([campo, rotulo]) => (
              <CampoAuditoria
                key={campo}
                rotulo={rotulo}
                valor={publicacao[campo]}
                formato={campo === "valorSugerido" ? "moeda" : undefined}
                limite={campo === "valorSugerido" ? undefined : campo === "observacoes" ? 1000 : 120}
                erro={painel.errosPublicacao[campo]}
                obrigatorio={campo !== "observacoes"}
                aoAlterar={(valor) =>
                  painel.definirFormularioPublicacao({
                    ...publicacao,
                    [campo]: valor,
                  })
                }
              />
            ))}
          </>
        }
      />
    </>
  );
}
