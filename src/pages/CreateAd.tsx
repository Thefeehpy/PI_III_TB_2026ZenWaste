import {
  CalendarClock,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  MapPin,
  PackageCheck,
  Route,
  Send,
  Sparkles,
  Trash2,
  Truck,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useCriacaoAnuncio } from "@/hooks/use-criacao-anuncio";

export default function CreateAd() {
  const {
    itens, empresa, itensDisponiveis, entradaImagemRef,
    carregandoEstoque, erroEstoque, atualizarEstoque, publicando,
    etapaAtual, arrastandoImagem, definirArrastandoImagem, processandoImagem,
    sugerindoDescricao, sugerindoPreco, nomeFotoSelecionada,
    estadoConsultaCep, mensagemConsultaCep, analisePreco, simularTransporte,
    formulario, definirFormulario, formularioTransporte, definirFormularioTransporte, cidadeEstado, logradouroNumero, localizacaoCompleta,
    avancar, voltar, publicar, selecionarProduto, alterarCep, selecionarArquivo, removerFoto, alternarSimulacaoTransporte,
    sugerirDescricao, sugerirPreco, podeAvancarDetalhes, podePublicar, etapas,
  } = useCriacaoAnuncio();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Criar Anuncio</h2>
        <p className="text-muted-foreground">Publique um resíduo do seu estoque no marketplace</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 gap-y-3">
        {etapas.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index <= etapaAtual ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {index < etapaAtual ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`hidden text-sm sm:inline ${
                index === etapaAtual ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
            {index < etapas.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {etapaAtual === 0 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Selecionar do Estoque</CardTitle>
              <Select
                value={formulario.inventoryId}
                onValueChange={selecionarProduto}
                disabled={carregandoEstoque || itensDisponiveis.length === 0}
              >
                <SelectTrigger aria-label="Item do estoque">
                  <SelectValue placeholder="Selecione um item do estoque" />
                </SelectTrigger>
                <SelectContent>
                  {itensDisponiveis.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} - {item.availableQuantity.toLocaleString("pt-BR")} {item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {carregandoEstoque && <p role="status" className="text-sm text-muted-foreground">Carregando estoque...</p>}
              {erroEstoque && <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{erroEstoque}</p>
                <Button variant="outline" onClick={() => void atualizarEstoque()} disabled={carregandoEstoque}>Tentar novamente</Button>
              </div>}
              {!carregandoEstoque && !erroEstoque && itensDisponiveis.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum item disponível no estoque. Cadastre um resíduo antes de criar um anúncio.
                </p>
              )}
            </div>
          )}

          {etapaAtual === 1 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Detalhes do Anúncio</CardTitle>

              <div className="space-y-2">
                <Label htmlFor="anuncio-titulo">Título</Label>
                <Input id="anuncio-titulo" maxLength={256} value={formulario.title} onChange={(e) => definirFormulario({ ...formulario, title: e.target.value })} />
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="anuncio-descricao">Descrição</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-2"
                    onClick={sugerirDescricao}
                    disabled={sugerindoDescricao || !formulario.title || !formulario.type}
                  >
                    {sugerindoDescricao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Gerar com IA
                  </Button>
                </div>
                <Textarea
                  id="anuncio-descricao"
                  maxLength={500}
                  value={formulario.description}
                  onChange={(e) => definirFormulario({ ...formulario, description: e.target.value })}
                  placeholder="Descreva as especificações técnicas do material..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="anuncio-quantidade">Quantidade para Venda</Label>
                  <Input
                    id="anuncio-quantidade"
                    type="number"
                    min="0.001"
                    step="0.001"
                    max={itens.find((item) => item.id === formulario.inventoryId)?.availableQuantity}
                    value={formulario.quantity}
                    onChange={(e) => definirFormulario({ ...formulario, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anuncio-cep">CEP</Label>
                  <Input
                    id="anuncio-cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={formulario.cep}
                    onChange={(evento) => alterarCep(evento.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)))] p-4 shadow-[inset_0_1px_0_hsl(var(--primary)/0.12)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Endereço de origem</p>
                    <p className="text-xs text-muted-foreground">O CEP preenche rua, bairro, cidade e estado.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <div className="space-y-2">
                    <Label htmlFor="anuncio-rua">Rua</Label>
                    <Input id="anuncio-rua" value={formulario.street} placeholder="Preenchida automaticamente" readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anuncio-numero">Número</Label>
                    <Input
                      id="anuncio-numero"
                      value={formulario.number}
                      onChange={(event) => definirFormulario((atual) => ({ ...atual, number: event.target.value }))}
                      placeholder="Ex.: 120"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
                  <div className="space-y-2">
                    <Label htmlFor="anuncio-bairro">Bairro</Label>
                    <Input id="anuncio-bairro" value={formulario.neighborhood} placeholder="Preenchido automaticamente" readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anuncio-cidade">Cidade</Label>
                    <Input id="anuncio-cidade" value={formulario.city} placeholder="Preenchida automaticamente" readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anuncio-estado">Estado</Label>
                    <Input id="anuncio-estado" value={formulario.state} placeholder="UF" readOnly />
                  </div>
                </div>
              </div>

              {mensagemConsultaCep && (
                <p
                  role={estadoConsultaCep === "erro" ? "alert" : "status"}
                  className={`text-sm ${
                    estadoConsultaCep === "erro"
                      ? "text-destructive"
                      : estadoConsultaCep === "success"
                        ? "text-primary"
                        : "text-muted-foreground"
                  }`}
                >
                  {mensagemConsultaCep}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="anuncio-imagem">Imagem do Material</Label>
                <input
                  id="anuncio-imagem"
                  ref={entradaImagemRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    await selecionarArquivo(event.target.files);
                    event.target.value = "";
                  }}
                />

                <div
                  role="button"
                  aria-label="Selecionar imagem do anúncio"
                  tabIndex={0}
                  onClick={() => entradaImagemRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      entradaImagemRef.current?.click();
                    }
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    definirArrastandoImagem(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    definirArrastandoImagem(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    definirArrastandoImagem(false);
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    await selecionarArquivo(event.dataTransfer.files);
                  }}
                  className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-5 transition-all ${
                    arrastandoImagem
                      ? "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(22,163,74,0.08)]"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  {processandoImagem && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <p className="text-sm font-medium text-foreground">Processando imagem...</p>
                    </div>
                  )}

                  {formulario.photos[0] ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                        <img src={formulario.photos[0]} alt="Prévia da imagem do anúncio" className="h-64 w-full object-cover" />
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {nomeFotoSelecionada || "Imagem pronta para o anúncio"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Clique para trocar ou arraste outra imagem para substituir.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              entradaImagemRef.current?.click();
                            }}
                          >
                            Trocar imagem
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              removerFoto();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <div className="rounded-2xl bg-background/90 p-4 shadow-sm">
                        {arrastandoImagem ? (
                          <UploadCloud className="h-8 w-8 text-primary" />
                        ) : (
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        Clique aqui ou arraste uma imagem para anexar ao anúncio
                      </p>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Aceita JPG, PNG, WEBP e outros formatos de imagem. A imagem anexada será usada como foto do
                        anúncio publicado.
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  O upload é salvo no anúncio publicado. Se preferir, você ainda pode publicar sem imagem e usar a
                  imagem padrão do marketplace.
                </p>
              </div>
            </div>
          )}

          {etapaAtual === 2 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Precificação</CardTitle>
              <Card className="border-primary/30 bg-accent/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Sugestão Inteligente de Preço (IA)</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      R$ {formulario.suggestedPrice.replace(".", ",")}
                      <span className="text-sm font-normal text-muted-foreground"> / {formulario.unit}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{analisePreco}</p>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label htmlFor="anuncio-preco">Seu Preço (R$ / {formulario.unit})</Label>
                <Input
                  id="anuncio-preco"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.price}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0 || e.target.value === "") {
                      definirFormulario({ ...formulario, price: e.target.value });
                    }
                  }}
                  placeholder={formulario.suggestedPrice}
                />
                <p className="text-xs text-muted-foreground">
                  A recomendação é calculada a partir do histórico de preços do tipo de resíduo selecionado.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => definirFormulario({ ...formulario, price: formulario.suggestedPrice })}>
                Usar preço sugerido
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2 gap-2"
                onClick={sugerirPreco}
                disabled={sugerindoPreco || !formulario.type}
              >
                {sugerindoPreco ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Recalcular com IA
              </Button>
            </div>
          )}

          {etapaAtual === 3 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Revisão do Anuncio</CardTitle>

              {formulario.photos[0] && (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                  <img src={formulario.photos[0]} alt="Prévia final da imagem do anúncio" className="h-64 w-full object-cover" />
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Titulo</span>
                  <span className="font-medium">{formulario.title}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{empresa?.razaoSocial || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Quantidade</span>
                  <span className="font-medium">
                    {formulario.quantity} {formulario.unit}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">CEP</span>
                  <span className="font-medium">{formulario.cep || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Endereço de origem</span>
                  <span className="font-medium">{localizacaoCompleta || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Preço</span>
                  <span className="text-lg font-bold text-primary">
                    R$ {(formulario.price || formulario.suggestedPrice).replace(".", ",")} / {formulario.unit}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Imagem principal</span>
                  <span className="font-medium">{nomeFotoSelecionada || "Imagem padrão do marketplace"}</span>
                </div>
                {formulario.description && (
                  <div className="py-2">
                    <p className="mb-1 text-muted-foreground">Descrição</p>
                    <p>{formulario.description}</p>
                  </div>
                )}
              </div>

              <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--card)))]">
                <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Simular transporte para transportadoras</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Prepare uma simulação de frete. A integração com transportadoras ainda está em planejamento.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={simularTransporte ? "default" : "outline"}
                      className="shrink-0 rounded-2xl"
                      onClick={alternarSimulacaoTransporte}
                    >
                      {simularTransporte ? "Simulação ativa" : "Simular transporte"}
                    </Button>
                  </div>

                  {simularTransporte && (
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-primary/20 bg-background/70 p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                          <Route className="h-4 w-4" />
                          Rota inicial
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-4 w-4 text-primary" />
                              Origem
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{localizacaoCompleta || "Local do anúncio"}</p>
                          </div>
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                            <Send className="h-4 w-4 rotate-90 md:rotate-0" />
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <PackageCheck className="h-4 w-4 text-primary" />
                              Destino
                            </div>
                            <Input
                              aria-label="Destino da simulação de transporte"
                              value={formularioTransporte.destination}
                              onChange={(event) =>
                                definirFormularioTransporte((atual) => ({ ...atual, destination: event.target.value }))
                              }
                              className="mt-2 h-10 rounded-xl"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="anuncio-frete-simulado">Valor sugerido do frete</Label>
                          <Input
                            id="anuncio-frete-simulado"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formularioTransporte.suggestedFreight}
                            onChange={(event) =>
                              definirFormularioTransporte((atual) => ({ ...atual, suggestedFreight: event.target.value }))
                            }
                            placeholder="R$"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="anuncio-janela-coleta">Janela de coleta</Label>
                          <div className="relative">
                            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                            <Input
                              id="anuncio-janela-coleta"
                              value={formularioTransporte.pickupWindow}
                              onChange={(event) =>
                                definirFormularioTransporte((atual) => ({ ...atual, pickupWindow: event.target.value }))
                              }
                              className="pl-9"
                              placeholder="Ex.: Até 2 dias após confirmação"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="anuncio-veiculo">Tipo de veículo necessário</Label>
                          <Input
                            id="anuncio-veiculo"
                            value={formularioTransporte.vehicleType}
                            onChange={(event) =>
                              definirFormularioTransporte((atual) => ({ ...atual, vehicleType: event.target.value }))
                            }
                            placeholder="Ex.: Baú médio, truck, roll-on"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="anuncio-observacoes-transporte">Observações para a transportadora</Label>
                        <Textarea
                          id="anuncio-observacoes-transporte"
                          value={formularioTransporte.notes}
                          onChange={(event) =>
                            definirFormularioTransporte((atual) => ({ ...atual, notes: event.target.value }))
                          }
                          rows={3}
                        />
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        Demonstração local com distância de referência. Estes dados não são enviados às transportadoras
                        e não criam um transporte ou MTR no backend.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={voltar} disabled={etapaAtual === 0}>
              Voltar
            </Button>
            {etapaAtual < etapas.length - 1 ? (
              <Button
                onClick={avancar}
                disabled={(etapaAtual === 0 && !formulario.inventoryId) || (etapaAtual === 1 && !podeAvancarDetalhes)}
              >
                Proximo
              </Button>
            ) : (
              <Button onClick={publicar} disabled={!podePublicar}>
                {publicando ? "Publicando..." : "Publicar Anuncio"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

