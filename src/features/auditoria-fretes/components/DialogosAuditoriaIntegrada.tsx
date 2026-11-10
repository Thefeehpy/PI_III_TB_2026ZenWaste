import { CampoAuditoria } from "./CampoAuditoria";
import { FormularioCadastroFrete } from "./FormularioCadastroFrete";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { SignaturePad } from "@/components/SignaturePad";
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
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.tratativaAberta}
        aoAbrir={painel.definirTratativaAberta}
        titulo="Registrar tratativa"
        descricao="Este registro ficará no histórico interno; não envia mensagens externas."
        aoConfirmar={painel.registrarTratativa}
        filhos={
          <CampoAuditoria
            rotulo="Observação da tratativa"
            valor={painel.textoTratativa}
            aoAlterar={painel.definirTextoTratativa}
          />
        }
      />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.resolucaoAberta}
        aoAbrir={painel.definirResolucaoAberta}
        titulo="Aceitar diferença"
        descricao="O aceite preserva a cobrança e a diferença originais no histórico."
        aoConfirmar={painel.resolverDivergencia}
        filhos={
          <CampoAuditoria
            rotulo="Justificativa do aceite"
            valor={painel.justificativaResolucao}
            aoAlterar={painel.definirJustificativaResolucao}
          />
        }
      />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.cancelamentoAberto}
        aoAbrir={painel.definirCancelamentoAberto}
        titulo="Cancelar frete"
        descricao="O cancelamento do frete não cancela a compra nem estorna pagamentos."
        aoConfirmar={painel.cancelarFrete}
        filhos={
          <CampoAuditoria
            rotulo="Justificativa do cancelamento"
            valor={painel.justificativaCancelamento}
            aoAlterar={painel.definirJustificativaCancelamento}
          />
        }
      />
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.entregaAberta}
        aoAbrir={painel.definirEntregaAberta}
        titulo="Confirmar recebimento"
        descricao="Confirmação pela compradora. A auditoria continuará pendente se houver divergência aberta."
        aoConfirmar={painel.confirmarEntrega}
        filhos={
          <>
            <CampoAuditoria
              rotulo="Nome do recebedor"
              valor={painel.nomeRecebedor}
              aoAlterar={painel.definirNomeRecebedor}
            />
            <label className="block space-y-2">
              <span>Tipo de recebimento</span>
              <select
                className={classeCampo}
                value={painel.tipoRecebimento}
                onChange={(evento) =>
                  painel.definirTipoRecebimento(
                    evento.target.value as typeof painel.tipoRecebimento,
                  )
                }
              >
                <option value="complete">Completo</option>
                <option value="with_reservation">Com ressalva</option>
              </select>
            </label>
            {painel.tipoRecebimento === "with_reservation" && (
              <CampoAuditoria
                rotulo="Ressalva"
                valor={painel.textoRessalva}
                aoAlterar={painel.definirTextoRessalva}
              />
            )}
            <div role="group" aria-label="Assinatura do recebedor">
              <p className="mb-2 text-sm font-medium">Assinatura obrigatória</p>
              <SignaturePad
                value={painel.dadosAssinatura}
                onChange={painel.definirDadosAssinatura}
              />
            </div>
          </>
        }
      />
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
