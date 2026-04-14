import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ImagePlus, Sparkles, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useMarketplace } from "@/contexts/MarketplaceContext";
import { locations } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getMarketInsight, getSuggestedPriceByWasteType } from "@/lib/market-intelligence";

const steps = ["Selecionar Item", "Detalhes do Anuncio", "Precificacao", "Revisao"];
const MAX_IMAGE_DIMENSION = 1600;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel processar a imagem selecionada."));
    image.src = src;
  });
}

async function processMarketplaceImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem valido.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A imagem deve ter no maximo 10 MB.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const compressedDataUrl = canvas.toDataURL("image/webp", 0.86);

  return compressedDataUrl.length < originalDataUrl.length ? compressedDataUrl : originalDataUrl;
}

export default function CreateAd() {
  const { items } = useInventory();
  const { user } = useAuth();
  const { addItem } = useMarketplace();
  const { toast } = useToast();
  const availableItems = items.filter((item) => item.quantity > 0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [form, setForm] = useState({
    inventoryId: "",
    title: "",
    type: "",
    description: "",
    quantity: "",
    unit: "kg",
    location: "",
    price: "",
    suggestedPrice: "0.00",
    photos: [] as string[],
  });

  const next = () => setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  const prev = () => setCurrentStep((step) => Math.max(step - 1, 0));

  useEffect(() => {
    if (!form.type) {
      return;
    }

    let active = true;
    const fallbackPrice = getSuggestedPriceByWasteType(form.type).toFixed(2);

    setForm((current) => ({
      ...current,
      suggestedPrice: fallbackPrice,
    }));

    api
      .getSuggestedPrice(form.type)
      .then((response) => {
        if (active) {
          setForm((current) => ({
            ...current,
            suggestedPrice: response.suggestedPrice.toFixed(2),
          }));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [form.type]);

  const resetForm = () => {
  const handlePublish = async () => {
    const selectedInventory = items.find((item) => item.id === form.inventoryId);
    if (!selectedInventory || !user) {
      return;
    }

    const result = await addItem({
      inventoryId: selectedInventory.id,
      name: form.title,
      type: selectedInventory.type,
      description: form.description || `Material disponível no estoque da ${user.razaoSocial}.`,
      quantity: Number(form.quantity),
      unit: form.unit,
      location: form.location,
      price: Number(form.price || form.suggestedPrice),
    });

    if (!result.success) {
      toast({
        title: "Anuncio nao publicado",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Anúncio publicado",
      description: "Seu resíduo já está disponível no marketplace.",
    });

    setCurrentStep(0);
    setSelectedPhotoName("");
    setIsDraggingImage(false);
    setIsProcessingImage(false);
    setForm({
      inventoryId: "",
      title: "",
      type: "",
      description: "",
      quantity: "",
      unit: "kg",
      location: "",
      price: "",
      suggestedPrice: "0.00",
      photos: [],
    });
  };

  const attachPhoto = async (file: File) => {
    setIsProcessingImage(true);

    try {
      const processedImage = await processMarketplaceImage(file);

      setForm((current) => ({
        ...current,
        photos: [processedImage],
      }));
      setSelectedPhotoName(file.name);

      toast({
        title: "Imagem anexada",
        description: "A imagem foi adicionada ao anuncio e sera publicada junto com ele.",
      });
    } catch (error) {
      toast({
        title: "Nao foi possivel anexar a imagem",
        description: error instanceof Error ? error.message : "Tente novamente com outra imagem.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingImage(false);
      setIsDraggingImage(false);
    }
  };

  const handleFileSelection = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    await attachPhoto(files[0]);
  };

  const handlePublish = () => {
    const selectedInventory = items.find((item) => item.id === form.inventoryId);
    if (!selectedInventory || !user) {
      return;
    }

    addItem({
      name: form.title,
      type: selectedInventory.type,
      description: form.description || `Material disponivel no estoque da ${user.razaoSocial}.`,
      quantity: Number(form.quantity),
      unit: form.unit,
      location: form.location,
      price: Number(form.price || form.suggestedPrice),
      company: user.razaoSocial,
      imageUrl: form.photos[0],
    });

    toast({
      title: "Anuncio publicado",
      description: "Seu residuo ja esta disponivel no marketplace.",
    });

    resetForm();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Criar Anuncio</h2>
        <p className="text-muted-foreground">Publique um residuo do seu estoque no marketplace</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 gap-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`hidden text-sm sm:inline ${
                index === currentStep ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
            {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Selecionar do Estoque</CardTitle>
              <Select
                value={form.inventoryId}
                onValueChange={(value) => {
                  const selectedItem = items.find((item) => item.id === value);
                  if (selectedItem) {
                    setForm((current) => ({
                      ...current,
                      inventoryId: value,
                      title: selectedItem.name,
                      type: selectedItem.type,
                      quantity: String(selectedItem.quantity),
                      unit: selectedItem.unit,
                      suggestedPrice: getSuggestedPriceByWasteType(selectedItem.type).toFixed(2),
                    }));
                  }
                }}
                disabled={availableItems.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um item do estoque" />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} - {item.quantity.toLocaleString("pt-BR")} {item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum item disponivel no estoque. Cadastre um residuo antes de criar um anuncio.
                </p>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Detalhes do Anuncio</CardTitle>

              <div className="space-y-2">
                <Label>Titulo</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descreva as especificacoes tecnicas do material..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantidade para Venda</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Localizacao</Label>
                  <Select value={form.location} onValueChange={(value) => setForm({ ...form, location: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem do Material</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    await handleFileSelection(event.target.files);
                    event.target.value = "";
                  }}
                />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(false);
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    await handleFileSelection(event.dataTransfer.files);
                  }}
                  className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-5 transition-all ${
                    isDraggingImage
                      ? "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(22,163,74,0.08)]"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  {isProcessingImage && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <p className="text-sm font-medium text-foreground">Processando imagem...</p>
                    </div>
                  )}

                  {form.photos[0] ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                        <img src={form.photos[0]} alt="Previa da imagem do anuncio" className="h-64 w-full object-cover" />
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {selectedPhotoName || "Imagem pronta para o anuncio"}
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
                              fileInputRef.current?.click();
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
                              setForm((current) => ({
                                ...current,
                                photos: [],
                              }));
                              setSelectedPhotoName("");
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
                        {isDraggingImage ? (
                          <UploadCloud className="h-8 w-8 text-primary" />
                        ) : (
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        Clique aqui ou arraste uma imagem para anexar ao anuncio
                      </p>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Aceita JPG, PNG, WEBP e outros formatos de imagem. A imagem anexada sera usada como foto do
                        anuncio publicado.
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  O upload e salvo no anuncio publicado. Se preferir, voce ainda pode publicar sem imagem e usar a
                  imagem padrao do marketplace.
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Precificacao</CardTitle>
              <Card className="border-primary/30 bg-accent/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Sugestao Inteligente de Preco (IA)</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      R$ {form.suggestedPrice.replace(".", ",")}
                      <span className="text-sm font-normal text-muted-foreground"> / {form.unit}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{getMarketInsight()}</p>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Seu Preco (R$ / {form.unit})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0 || e.target.value === "") {
                      setForm({ ...form, price: e.target.value });
                    }
                  }}
                  placeholder={form.suggestedPrice}
                />
                <p className="text-xs text-muted-foreground">
                  A recomendacao e calculada a partir do historico de precos do tipo de residuo selecionado.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, price: form.suggestedPrice })}>
                Usar preco sugerido
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Revisao do Anuncio</CardTitle>

              {form.photos[0] && (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                  <img src={form.photos[0]} alt="Previa final da imagem do anuncio" className="h-64 w-full object-cover" />
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Titulo</span>
                  <span className="font-medium">{form.title}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{user?.razaoSocial || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Quantidade</span>
                  <span className="font-medium">
                    {form.quantity} {form.unit}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Localizacao</span>
                  <span className="font-medium">{form.location || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Preco</span>
                  <span className="text-lg font-bold text-primary">
                    R$ {(form.price || form.suggestedPrice).replace(".", ",")} / {form.unit}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Imagem principal</span>
                  <span className="font-medium">{selectedPhotoName || "Imagem padrao do marketplace"}</span>
                </div>
                {form.description && (
                  <div className="py-2">
                    <p className="mb-1 text-muted-foreground">Descricao</p>
                    <p>{form.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={prev} disabled={currentStep === 0}>
              Voltar
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={next}
                disabled={
                  (currentStep === 0 && !form.inventoryId) ||
                  (currentStep === 1 && (!form.title || !form.quantity || !form.location))
                }
              >
                Proximo
              </Button>
            ) : (
              <Button onClick={handlePublish} disabled={!form.quantity || !form.location}>
                Publicar Anuncio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
