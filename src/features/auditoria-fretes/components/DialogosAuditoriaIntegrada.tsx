import { useId, type HTMLInputTypeAttribute } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import type { usePainelAuditoriaIntegrada } from "../use-painel-auditoria-integrada";
import {
  classeCampo,
  DialogoOperacaoFrete,
  PaginacaoAuditoria,
  SeletorEmpresaFrete,
} from "./ControlesAuditoriaIntegrada";

export function CampoAuditoria({
  rotulo,
  valor,
  aoAlterar,
  tipo = "text",
  obrigatorio = true,
}: {
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  tipo?: HTMLInputTypeAttribute;
  obrigatorio?: boolean;
}) {
  const identificador = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={identificador} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={identificador}
        className={classeCampo}
        type={tipo}
        value={valor}
        required={obrigatorio}
        min={tipo === "number" ? "0" : undefined}
        step={tipo === "number" ? "0.001" : undefined}
        onChange={(evento) => aoAlterar(evento.target.value)}
      />
    </div>
  );
}

export function DialogosAuditoriaIntegrada({
  painel,
}: {
  painel: ReturnType<typeof usePainelAuditoriaIntegrada>;
}) {
  const { dados } = painel;
  const comum = { executando: dados.executando, erro: dados.erroComando };
  const cadastro = painel.formularioCadastro;
  const cotacao = painel.formularioCotacao;
  const classificacao = painel.formularioClassificacao;
  const publicacao = painel.formularioPublicacao;
  return (
    <>
      <DialogoOperacaoFrete
        {...comum}
        aberto={painel.cadastroAberto}
        aoAbrir={painel.definirCadastroAberto}
        titulo="Cadastrar frete"
        descricao="Crie uma remessa de um pedido existente ou um frete avulso entre empresas cadastradas."
        aoConfirmar={painel.cadastrarFrete}
        filhos={
          <>
            <label className="block space-y-2">
              <span>Origem do frete</span>
              <select
                className={classeCampo}
                value={cadastro.tipo}
                onChange={(evento) =>
                  painel.definirFormularioCadastro({
                    ...cadastro,
                    tipo: evento.target.value as "pedido" | "avulso",
                  })
                }
              >
                <option value="pedido">Pedido existente</option>
                <option value="avulso">Frete avulso</option>
              </select>
            </label>
            {cadastro.tipo === "pedido" ? (
              <section aria-label="Pedidos disponíveis" className="space-y-3">
                <label className="block space-y-2">
                  <span>Pedido</span>
                  <select
                    className={classeCampo}
                    required
                    value={cadastro.pedidoId}
                    onChange={(evento) =>
                      painel.selecionarPedido(evento.target.value)
                    }
                  >
                    <option value="">Selecione o pedido</option>
                    {cadastro.pedidoId &&
                      !dados.pedidos?.resultados.some(
                        (pedido) => pedido.id === cadastro.pedidoId,
                      ) && (
                        <option value={cadastro.pedidoId}>
                          Pedido selecionado
                        </option>
                      )}
                    {dados.pedidos?.resultados.map((pedido) => (
                      <option key={pedido.id} value={pedido.id}>
                        {pedido.numero} — {pedido.material} ·{" "}
                        {pedido.quantidade_restante} {pedido.unidade}{" "}
                        disponíveis
                      </option>
                    ))}
                  </select>
                </label>
                <PaginacaoAuditoria
                  dados={dados.pedidos?.paginacao}
                  aoMudar={dados.alterarPaginaPedidos}
                  desabilitada={dados.carregando}
                />
              </section>
            ) : (
              <>
                <SeletorEmpresaFrete
                  rotulo="Compradora"
                  valor={cadastro.compradoraId}
                  aoAlterar={(valor) =>
                    painel.definirFormularioCadastro({
                      ...cadastro,
                      compradoraId: valor,
                    })
                  }
                  consultar={dados.consultarCompradoras}
                />
                <CampoAuditoria
                  rotulo="Material"
                  valor={cadastro.material}
                  aoAlterar={(valor) =>
                    painel.definirFormularioCadastro({
                      ...cadastro,
                      material: valor,
                    })
                  }
                />
                <CampoAuditoria
                  rotulo="Unidade"
                  valor={cadastro.unidade}
                  aoAlterar={(valor) =>
                    painel.definirFormularioCadastro({
                      ...cadastro,
                      unidade: valor,
                    })
                  }
                />
              </>
            )}
            {(
              [
                ["quantidade", "Quantidade da remessa", "number"],
                ["origem", "Origem", "text"],
                ["destino", "Destino", "text"],
                ["pesoToneladas", "Peso (t)", "number"],
                ["metrosCubicos", "Cubagem (m³)", "number"],
                ["quantidadeVolumes", "Volumes", "number"],
                ["previsaoEntrega", "Previsão de entrega", "date"],
              ] as const
            ).map(([campo, rotulo, tipo]) => (
              <CampoAuditoria
                key={campo}
                rotulo={rotulo}
                tipo={tipo}
                obrigatorio={tipo !== "date"}
                valor={cadastro[campo]}
                aoAlterar={(valor) =>
                  painel.definirFormularioCadastro({
                    ...cadastro,
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
        aberto={painel.classificacaoAberta}
        aoAbrir={painel.definirClassificacaoAberta}
        titulo="Classificar frete"
        descricao="Defina a modalidade. Retirada pelo cliente dispensa cotação e CT-e."
        aoConfirmar={painel.classificarFrete}
        filhos={
          <>
            <label className="block space-y-2">
              <span>Modalidade</span>
              <select
                className={classeCampo}
                value={classificacao.modalidade}
                onChange={(evento) =>
                  painel.definirFormularioClassificacao({
                    ...classificacao,
                    modalidade: evento.target
                      .value as typeof classificacao.modalidade,
                  })
                }
              >
                <option value="cotar">Cotar frete</option>
                <option value="contratado">Frete já contratado</option>
                <option value="retirada_cliente">Retirada pelo cliente</option>
              </select>
            </label>
            {classificacao.modalidade === "contratado" && (
              <>
                <SeletorEmpresaFrete
                  rotulo="Transportadora"
                  valor={classificacao.transportadoraId}
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
                  tipo="number"
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
        descricao="Selecione uma transportadora cadastrada e registre sua proposta."
        aoConfirmar={painel.cadastrarCotacao}
        filhos={
          <>
            <SeletorEmpresaFrete
              rotulo="Transportadora"
              valor={cotacao.transportadora}
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
                tipo={campo === "observacao" ? "text" : "number"}
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
                tipo={campo === "valorSugerido" ? "number" : "text"}
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
