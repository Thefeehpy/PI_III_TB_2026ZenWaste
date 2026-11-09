import { ClipboardCheck, Plus, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePainelAuditoriaIntegrada } from "./use-painel-auditoria-integrada";
import {
  apresentarMedida,
  apresentarMoeda,
  apresentarTitulo,
  rotulosSituacao,
} from "./apresentacao-api";
import { IndicadoresFretes } from "./components/IndicadoresFretes";
import {
  CampoAuditoria,
  DialogosAuditoriaIntegrada,
} from "./components/DialogosAuditoriaIntegrada";
import {
  classeCampo,
  PaginacaoAuditoria,
} from "./components/ControlesAuditoriaIntegrada";
import type { ServicoHttpAuditoriaFretes } from "./servico-http-auditoria-fretes";
import type { SituacaoAuditoriaFrete } from "./tipos-api";

export function AuditoriaIntegrada({
  servico,
}: {
  servico?: ServicoHttpAuditoriaFretes;
}) {
  const painel = usePainelAuditoriaIntegrada(servico);
  const { dados } = painel;
  const frete =
    dados.detalhe?.id === dados.idSelecionado ? dados.detalhe : null;
  const encerrado =
    frete?.situacao === "concluido" || frete?.situacao === "cancelado";
  const gerenciar = frete?.permissoes.gerenciar ?? false;
  const podeConferir =
    gerenciar &&
    !encerrado &&
    frete?.modalidade !== "retirada_cliente" &&
    [
      "aguardando_conferencia",
      "com_divergencia",
      "aguardando_entrega",
    ].includes(frete?.situacao);
  const documento = painel.formularioDocumento;
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-[34px] border-primary/20 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#071b18_0%,#0f766e_54%,#35d399_100%)] text-white shadow-[0_26px_76px_rgba(6,95,70,0.24)]">
        <CardContent className="grid gap-7 p-6 md:p-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="space-y-5">
            <Badge className="rounded-full bg-white/15 text-white">
              Processo logístico centralizado
            </Badge>
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Auditoria de fretes
            </h2>
            <p>
              Acompanhe cotações, documentos e recebimentos registrados para sua
              empresa.
            </p>
          </div>
          {painel.podeCadastrar && (
            <Button
              className="rounded-2xl bg-white text-emerald-900 hover:bg-white/90"
              onClick={() => painel.definirCadastroAberto(true)}
              disabled={dados.executando}
            >
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar frete
            </Button>
          )}
        </CardContent>
      </Card>
      {dados.erro && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 p-4"
        >
          {dados.erro}{" "}
          <Button variant="outline" onClick={() => void dados.recarregar()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {dados.erroComando && (
        <p role="alert" className="text-destructive">
          {dados.erroComando}
        </p>
      )}
      {dados.carregando && <p role="status">Atualizando auditoria…</p>}
      {dados.fretes && (
        <>
          <IndicadoresFretes
            indicadores={painel.indicadores}
            rotuloConcluidos="Auditorias concluídas"
          />
          <Card className="rounded-[34px] border-border/70 bg-card/95 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-2xl">Processos de frete</CardTitle>
              <CardDescription>
                Remessas vinculadas a pedidos e fretes avulsos, com histórico
                preservado.
              </CardDescription>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm">Buscar fretes</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      className={`${classeCampo} pl-9`}
                      value={painel.termoBusca}
                      onChange={(evento) =>
                        painel.definirTermoBusca(evento.target.value)
                      }
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm">Situação da auditoria</span>
                  <select
                    className={classeCampo}
                    value={dados.consulta.situacao ?? ""}
                    onChange={(evento) =>
                      dados.alterarConsulta({
                        situacao: (evento.target.value || undefined) as
                          | SituacaoAuditoriaFrete
                          | undefined,
                      })
                    }
                  >
                    <option value="">Todas</option>
                    {Object.entries(rotulosSituacao).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm">Data inicial</span>
                  <input
                    type="date"
                    className={classeCampo}
                    value={dados.consulta.data_inicio ?? ""}
                    onChange={(evento) =>
                      dados.alterarConsulta({
                        data_inicio: evento.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm">Data final</span>
                  <input
                    type="date"
                    className={classeCampo}
                    value={dados.consulta.data_fim ?? ""}
                    onChange={(evento) =>
                      dados.alterarConsulta({
                        data_fim: evento.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm">ID da transportadora</span>
                  <input
                    type="number"
                    min="1"
                    className={classeCampo}
                    value={dados.consulta.transportadora_id ?? ""}
                    onChange={(evento) =>
                      dados.alterarConsulta({
                        transportadora_id: evento.target.value
                          ? Number(evento.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm">Registros por página</span>
                  <select
                    className={classeCampo}
                    value={dados.consulta.tamanho_pagina ?? 10}
                    onChange={(evento) =>
                      dados.alterarConsulta({
                        tamanho_pagina: Number(evento.target.value),
                      })
                    }
                  >
                    {[5, 10, 20].map((tamanho) => (
                      <option key={tamanho} value={tamanho}>
                        {tamanho}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {dados.fretes.resultados.length === 0 && (
                <p role="status">
                  Nenhum processo encontrado para os filtros selecionados.
                </p>
              )}
              {dados.fretes.resultados.map((registro) => (
                <article
                  key={registro.id}
                  className="grid gap-4 rounded-[26px] border border-border/70 bg-background/80 p-5 xl:grid-cols-[1fr_1fr_auto] xl:items-center"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {apresentarTitulo(registro)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {registro.cliente} · {registro.material}
                    </p>
                    <Badge variant="outline" className="mt-2 rounded-full">
                      {rotulosSituacao[registro.situacao]}
                    </Badge>
                  </div>
                  <div className="rounded-[22px] bg-muted/20 p-3 text-sm">
                    <p>
                      {registro.transportadora?.razao_social ??
                        "Transportadora não definida"}
                    </p>
                    <p>
                      {registro.quantidade} {registro.unidade} · Referência:{" "}
                      {apresentarMoeda(registro.valor_referencia)}
                    </p>
                    <p>CT-e: {apresentarMoeda(registro.valor_cte)}</p>
                    {registro.recebimento_confirmado && (
                      <p className="font-medium text-primary">
                        Recebimento confirmado
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={dados.executando}
                    onClick={() => void painel.abrirDetalhes(registro.id)}
                  >
                    Detalhes
                  </Button>
                </article>
              ))}
              <PaginacaoAuditoria
                dados={dados.fretes.paginacao}
                aoMudar={(pagina) => dados.alterarConsulta({ pagina })}
                desabilitada={dados.carregando || dados.executando}
              />
            </CardContent>
          </Card>
        </>
      )}
      <Card className="rounded-[30px]">
        <CardHeader>
          <CardTitle>Demandas internas de transporte</CardTitle>
          <CardDescription>
            Registros internos, sem envio automático ou contratação externa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dados.demandas?.resultados.map((demanda) => (
            <article key={demanda.id} className="mb-3 rounded-2xl border p-4">
              <p className="font-medium">
                {demanda.numero_pedido} · {demanda.material}
              </p>
              <p className="text-sm">
                {demanda.origem} → {demanda.destino} · {demanda.janela_coleta} ·{" "}
                {demanda.tipo_veiculo}
              </p>
              <p>
                {apresentarMoeda(demanda.valor_sugerido)} · {demanda.propostas}{" "}
                cotação(ões) interna(s)
              </p>
            </article>
          ))}
          {dados.demandas?.resultados.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma demanda registrada.
            </p>
          )}
          <PaginacaoAuditoria
            dados={dados.demandas?.paginacao}
            aoMudar={dados.alterarPaginaDemandas}
            desabilitada={dados.carregando}
          />
        </CardContent>
      </Card>
      <Dialog
        open={painel.detalhesAbertos}
        onOpenChange={painel.definirDetalhesAbertos}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[30px] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {frete ? apresentarTitulo(frete) : "Detalhes do frete"}
            </DialogTitle>
            <DialogDescription>
              Cotação, conferência e recebimento do mesmo processo.
            </DialogDescription>
          </DialogHeader>
          {dados.carregandoDetalhe && <p role="status">Carregando detalhes…</p>}
          {dados.erroDetalhe && (
            <p role="alert">
              {dados.erroDetalhe}{" "}
              <Button
                variant="outline"
                onClick={() => void dados.abrirDetalhe(dados.idSelecionado)}
              >
                Tentar novamente
              </Button>
            </p>
          )}
          {frete && !dados.carregandoDetalhe && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{rotulosSituacao[frete.situacao]}</Badge>
                <span className="text-sm">
                  {frete.entrega
                    ? "Recebimento confirmado"
                    : "Recebimento ainda não confirmado"}
                </span>
                {frete.divergencia_aberta && (
                  <span className="text-sm font-medium text-destructive">
                    Auditoria pendente: divergência aberta
                  </span>
                )}
              </div>
              {gerenciar && (
                <div className="flex flex-wrap gap-2">
                  {frete.situacao === "aguardando_classificacao" && (
                    <Button
                      onClick={() => painel.definirClassificacaoAberta(true)}
                    >
                      Classificar frete
                    </Button>
                  )}
                  {!encerrado && (
                    <Button
                      variant="outline"
                      disabled={dados.executando}
                      onClick={() =>
                        void painel.abrirPublicacaoTransporte(frete.id)
                      }
                    >
                      Registrar demanda interna
                    </Button>
                  )}
                  {!encerrado && !frete.retirada && !frete.entrega && (
                    <Button
                      variant="outline"
                      onClick={() => painel.definirCancelamentoAberto(true)}
                    >
                      Cancelar frete
                    </Button>
                  )}
                </div>
              )}
              <Tabs defaultValue="resumo">
                <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl">
                  {(
                    [
                      "Resumo",
                      "Cotações",
                      "Documentos",
                      "Divergências",
                      "Histórico",
                      "Entrega",
                    ] as const
                  ).map((rotulo) => (
                    <TabsTrigger
                      key={rotulo}
                      value={rotulo === "Resumo" ? "resumo" : rotulo}
                    >
                      {rotulo}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="resumo" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Cliente", frete.cliente],
                      [
                        "Material",
                        `${frete.material} · ${frete.quantidade} ${frete.unidade}`,
                      ],
                      ["Origem", frete.origem],
                      ["Destino", frete.destino],
                      ["Peso", apresentarMedida(frete.peso_toneladas, "t")],
                      ["Cubagem", apresentarMedida(frete.cubagem_m3, "m³")],
                      [
                        "Transportadora",
                        frete.transportadora?.razao_social ?? "Não definida",
                      ],
                      ["Referência", apresentarMoeda(frete.valor_referencia)],
                      ["Cobrança atual", apresentarMoeda(frete.valor_cte)],
                    ].map(([rotulo, valor]) => (
                      <div
                        key={rotulo}
                        className="rounded-2xl border bg-muted/20 p-4"
                      >
                        <p className="text-xs text-muted-foreground">
                          {rotulo}
                        </p>
                        <p className="font-semibold">{valor}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os dados comerciais e o saldo de estoque não são alterados
                    por esta auditoria.
                  </p>
                </TabsContent>
                <TabsContent value="Cotações" className="space-y-4">
                  {gerenciar && frete.situacao === "em_cotacao" && (
                    <Button onClick={() => painel.definirCotacaoAberta(true)}>
                      Registrar cotação
                    </Button>
                  )}
                  {frete.cotacoes.length === 0 && (
                    <p>Nenhuma cotação disponível para este participante.</p>
                  )}
                  {frete.cotacoes.map((cotacao) => (
                    <article
                      key={cotacao.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {cotacao.transportadora.razao_social}
                        </p>
                        <p>
                          {apresentarMoeda(cotacao.valor)} ·{" "}
                          {cotacao.prazo_dias} dia(s)
                        </p>
                        <p className="text-sm">{cotacao.observacao}</p>
                      </div>
                      {cotacao.aprovada ? (
                        <Badge>Aprovada</Badge>
                      ) : (
                        gerenciar &&
                        frete.situacao === "em_cotacao" && (
                          <Button
                            variant="outline"
                            disabled={dados.executando}
                            onClick={() =>
                              void painel.aprovarCotacao(cotacao.id)
                            }
                          >
                            Aprovar cotação
                          </Button>
                        )
                      )}
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="Documentos" className="space-y-4">
                  {frete.modalidade === "retirada_cliente" && (
                    <p>
                      Retirada pelo cliente: cotação e CT-e dispensados neste
                      fluxo.
                    </p>
                  )}
                  {podeConferir && (
                    <form
                      onSubmit={(evento) => {
                        evento.preventDefault();
                        void painel.registrarDocumentos();
                      }}
                    >
                      <fieldset
                        disabled={dados.executando}
                        className="space-y-3 rounded-[24px] border p-4"
                      >
                        <h3 className="font-semibold">
                          {frete.documentos.length
                            ? "Registrar correção do CT-e"
                            : "Registrar CT-e"}
                        </h3>
                        {(
                          [
                            ["numeroCte", "Número do CT-e"],
                            ["valorCte", "Valor do CT-e"],
                            ["nomeArquivo", "Nome do arquivo CT-e"],
                            ["arquivoNfe", "Nome do arquivo NF-e"],
                          ] as const
                        ).map(([campo, rotulo]) => (
                          <CampoAuditoria
                            key={campo}
                            rotulo={rotulo}
                            valor={documento[campo]}
                            tipo={campo === "valorCte" ? "number" : "text"}
                            obrigatorio={
                              campo === "numeroCte" || campo === "valorCte"
                            }
                            aoAlterar={(valor) =>
                              painel.definirFormularioDocumento({
                                ...documento,
                                [campo]: valor,
                              })
                            }
                          />
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Nomes de arquivos são metadados; não representam
                          upload ou emissão fiscal.
                        </p>
                        {dados.erroComando && (
                          <p role="alert" className="text-destructive">
                            {dados.erroComando}
                          </p>
                        )}
                        <Button type="submit">
                          {dados.executando ? "Salvando…" : "Salvar CT-e"}
                        </Button>
                      </fieldset>
                    </form>
                  )}
                  {frete.documentos.map((registro) => (
                    <article
                      key={registro.id}
                      className="rounded-2xl border p-4"
                    >
                      <p className="font-semibold">
                        Versão {registro.versao} · {registro.numero}
                      </p>
                      <p>
                        {apresentarMoeda(registro.valor)} ·{" "}
                        {registro.nome_arquivo || "Sem arquivo informado"}
                      </p>
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="Divergências" className="space-y-4">
                  {gerenciar && frete.divergencia_aberta && !encerrado && (
                    <Button onClick={() => painel.definirResolucaoAberta(true)}>
                      Aceitar diferença
                    </Button>
                  )}
                  {frete.divergencias.length === 0 && (
                    <p>Nenhuma análise de divergência disponível.</p>
                  )}
                  {frete.divergencias.map((analise) => (
                    <article
                      key={analise.id}
                      className="space-y-2 rounded-[24px] border p-4"
                    >
                      <p className="font-semibold">
                        {analise.tipo_resolucao === "cte_corrigido"
                          ? "Substituída por correção"
                          : analise.tipo_resolucao === "aceite_justificado"
                            ? "Aceita com justificativa"
                            : "Divergência aberta"}
                      </p>
                      <p>
                        Referência: {apresentarMoeda(analise.valor_referencia)}{" "}
                        · Cobrança: {apresentarMoeda(analise.valor_cobrado)} ·
                        Diferença: {apresentarMoeda(analise.diferenca)}
                      </p>
                      {analise.justificativa && <p>{analise.justificativa}</p>}
                      {analise.empresa_resolvedora && (
                        <p className="text-xs">
                          Responsável:{" "}
                          {analise.empresa_resolvedora.razao_social}
                        </p>
                      )}
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="Histórico" className="space-y-4">
                  {gerenciar && (
                    <Button
                      variant="outline"
                      onClick={() => painel.definirTratativaAberta(true)}
                    >
                      Registrar tratativa
                    </Button>
                  )}
                  {frete.historico.map((evento) => (
                    <article key={evento.id} className="rounded-2xl border p-4">
                      <p className="font-medium">
                        {evento.tipo.replace(/-/g, " ")} ·{" "}
                        {evento.autor.razao_social}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {evento.registrado_em} ·{" "}
                        {rotulosSituacao[evento.situacao_nova]}
                      </p>
                      {evento.detalhes.observacao && (
                        <p>{String(evento.detalhes.observacao)}</p>
                      )}
                      {evento.detalhes.justificativa && (
                        <p>{String(evento.detalhes.justificativa)}</p>
                      )}
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="Entrega" className="space-y-4">
                  <div className="rounded-[24px] border bg-muted/20 p-4">
                    <Truck className="mb-2 h-5 w-5 text-primary" />
                    <p>
                      {frete.retirada
                        ? `Retirada registrada · ${frete.retirada.nome_foto}`
                        : "Retirada ainda não registrada"}
                    </p>
                    <p>
                      {frete.entrega
                        ? `Recebido por ${frete.entrega.nome_recebedor}`
                        : "Recebimento ainda não confirmado"}
                    </p>
                    {frete.entrega?.ressalva && (
                      <p>Ressalva: {frete.entrega.ressalva}</p>
                    )}
                    {frete.entrega && (
                      <p>
                        Assinatura{" "}
                        {frete.entrega.assinatura_registrada
                          ? "registrada"
                          : "não registrada"}
                      </p>
                    )}
                  </div>
                  {frete.permissoes.registrar_retirada && (
                    <form
                      onSubmit={(evento) => {
                        evento.preventDefault();
                        void painel.registrarRetirada();
                      }}
                    >
                      <fieldset
                        disabled={dados.executando}
                        className="space-y-3"
                      >
                        <CampoAuditoria
                          rotulo="Nome da foto de retirada"
                          valor={painel.nomeFotoRetirada}
                          aoAlterar={painel.definirNomeFotoRetirada}
                        />
                        <p className="text-xs">
                          Registro de metadado, sem upload de foto.
                        </p>
                        <Button type="submit">Registrar retirada</Button>
                      </fieldset>
                    </form>
                  )}
                  {frete.permissoes.confirmar_entrega && (
                    <Button
                      disabled={dados.executando}
                      onClick={() => painel.definirEntregaAberta(true)}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Confirmar recebimento
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      <DialogosAuditoriaIntegrada painel={painel} />
    </div>
  );
}
