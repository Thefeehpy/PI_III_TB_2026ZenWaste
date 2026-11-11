import { EstadoOperacoesFrete } from "./components/EstadoOperacoesFrete";
import { FinanceiroFrete, DivergenciasFrete } from "./components/FinanceiroFrete";
import { DocumentosFrete } from "./components/DocumentosFrete";
import { HistoricoFrete } from "./components/HistoricoFrete";
import { CotacoesFrete } from "./components/CotacoesFrete";
import { ClipboardCheck, Plus, Search } from "lucide-react";
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
  apresentarData,
} from "./apresentacao-api";
import { IndicadoresFretes } from "./components/IndicadoresFretes";
import {
  DialogosAuditoriaIntegrada,
} from "./components/DialogosAuditoriaIntegrada";
import {
  classeCampo,
  PaginacaoAuditoria,
  SeletorEmpresaFrete,
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
  const estadoOperacoes = <EstadoOperacoesFrete operacao={dados.operacao} erroConsulta={dados.erro}
    pendentes={painel.intencoes.pendentes} erroProtecao={painel.intencoes.erro}
    atualizar={() => { void dados.recarregar(); if (dados.idSelecionado) void dados.abrirDetalhe(dados.idSelecionado); }} />;
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
      {dados.erroComando && !painel.cadastroAberto && !painel.classificacaoAberta && !painel.cotacaoAberta && !painel.publicacaoAberta && !painel.detalhesAbertos && (
        <p role="alert" className="text-destructive">
          {dados.erroComando}
        </p>
      )}
      {estadoOperacoes}
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
                <SeletorEmpresaFrete rotulo="Transportadora" obrigatorio={false}
                  valor={String(dados.consulta.transportadora_id ?? "")}
                  consultar={dados.consultarTransportadoras}
                  aoAlterar={valor => dados.alterarConsulta({ transportadora_id: valor ? Number(valor) : undefined })} />
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
                      variant="destructive"
                      disabled={dados.executando}
                      onClick={() => painel.definirCancelamentoAberto(true)}
                    >
                      Cancelar frete
                    </Button>
                  )}
                </div>
              )}
              {frete.situacao === "aguardando_classificacao" && <p role="status" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">Cadastro confirmado. A classificação ainda está pendente. Use Classificar frete para continuar; o cadastro não será reenviado.</p>}
              {estadoOperacoes}
              {dados.erroComando && !painel.classificacaoAberta && !painel.cotacaoAberta && !painel.publicacaoAberta && !painel.operacoes.retirada.aberto && !painel.documentoAberto && !painel.tratativaAberta && !painel.entregaAberta && !painel.resolucaoAberta && !painel.cancelamentoAberto && <p role="alert" className="text-sm text-destructive">{dados.erroComando}</p>}
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
                  <FinanceiroFrete frete={frete} />
                  <p className="text-xs text-muted-foreground">
                    Os dados comerciais e o saldo de estoque não são alterados
                    por esta auditoria.
                  </p>
                </TabsContent>
                <TabsContent value="Cotações" className="space-y-4">
                  <CotacoesFrete key={frete.id} cotacoes={frete.cotacoes} podeGerenciar={painel.acoes.cotacao}
                    executando={dados.executando} erro={dados.erroComando}
                    registrar={() => painel.definirCotacaoAberta(true)} aprovar={painel.aprovarCotacao}
                    aoRevisar={() => dados.informarErroComando(null)}
                    atualizar={() => { void dados.abrirDetalhe(frete.id); }} />
                </TabsContent>
                <TabsContent value="Documentos" className="space-y-4">
                  {frete.modalidade === "retirada_cliente" && <p>Retirada pelo cliente: cotação e CT-e dispensados neste fluxo comercial. Isso não define obrigações ambientais.</p>}
                  {painel.acoes.documento && <Button disabled={dados.executando} onClick={() => painel.definirDocumentoAberto(true)}>
                    {frete.documentos.length ? "Registrar correção do CT-e" : "Registrar CT-e"}
                  </Button>}
                  <DocumentosFrete documentos={frete.documentos} documento={frete.documento} historico={frete.historico} />
                </TabsContent>
                <TabsContent value="Divergências" className="space-y-4">
                  <DivergenciasFrete frete={frete} />
                  {painel.acoes.aceitar && <div className="space-y-2 rounded-2xl border p-4 text-sm">
                    <p>Trate a pendência por aceite justificado ou registre um CT-e corrigido. O aceite preserva a diferença factual; a correção cria outra versão e pode abrir nova divergência.</p>
                    <div className="flex flex-wrap gap-2"><Button disabled={dados.executando} onClick={() => painel.definirResolucaoAberta(true)}>Aceitar diferença com justificativa</Button>
                      {painel.acoes.documento && <Button disabled={dados.executando} variant="outline" onClick={() => painel.definirDocumentoAberto(true)}>Corrigir CT-e</Button>}</div>
                  </div>}
                </TabsContent>
                <TabsContent value="Histórico" className="space-y-4">
                  {painel.acoes.tratativa && <Button variant="outline" disabled={dados.executando} onClick={() => painel.definirTratativaAberta(true)}>Registrar tratativa interna</Button>}
                  <HistoricoFrete eventos={frete.historico} />
                </TabsContent>
                <TabsContent value="Entrega" className="space-y-4">
                  <section aria-label="Retirada e recebimento comercial" className="space-y-3 rounded-2xl border p-4 text-sm">
                    <h3 className="font-semibold">Situação logística</h3>
                    <p>{frete.retirada ? `Retirada registrada em ${apresentarData(frete.retirada.registrada_em)}` : "Retirada ainda não registrada"}</p>
                    {frete.retirada && <p>Nome da foto (metadado, sem arquivo anexado): {frete.retirada.nome_foto}</p>}
                    <p>{frete.entrega ? `Recebimento comercial confirmado por ${frete.entrega.nome_recebedor}, em ${apresentarData(frete.entrega.confirmado_em)}` : "Recebimento comercial ainda não confirmado"}</p>
                    {frete.entrega && <><p>Tipo: {frete.entrega.tipo_recebimento === "com_ressalva" ? "Com ressalva" : "Completo"}</p>
                      {frete.entrega.ressalva && <p className="break-words">Ressalva: {frete.entrega.ressalva}</p>}
                      <p>Assinatura manuscrita {frete.entrega.assinatura_registrada ? "registrada" : "não disponibilizada"}.</p></>}
                    {frete.divergencia_aberta && <p className="font-medium">A pendência financeira não impede as ações logísticas autorizadas. Receber não resolve a auditoria.</p>}
                    <p>Esta confirmação é comercial, distinta do aceite ambiental de MTR/SIGOR. Não é exigida retirada prévia para confirmar quando o servidor permite.</p>
                  </section>
                  <div className="flex flex-wrap gap-3">
                    {painel.acoes.retirada && <Button disabled={dados.executando} onClick={() => painel.operacoes.abrirRetirada(true)}>Registrar retirada</Button>}
                    {painel.acoes.recebimento && <Button disabled={dados.executando} onClick={() => painel.definirEntregaAberta(true)}><ClipboardCheck className="mr-2 h-4 w-4" />Confirmar recebimento comercial</Button>}
                  </div>
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
