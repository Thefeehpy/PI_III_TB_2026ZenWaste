import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronRight, Sparkles, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useMarketplace } from "@/contexts/MarketplaceContext";
import { locations } from "@/data/mockData";
import { getMarketInsight, getSuggestedPriceByWasteType } from "@/lib/market-intelligence";

const steps = ["Selecionar Item", "Detalhes do Anúncio", "Precificação", "Revisão"];

export default function CreateAd() {
  const { items } = useInventory();
  const { user } = useAuth();
  const { addItem } = useMarketplace();
  const { toast } = useToast();
  const availableItems = items.filter((item) => item.quantity > 0);
  const [currentStep, setCurrentStep] = useState(0);
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

    setForm((current) => ({
      ...current,
      suggestedPrice: getSuggestedPriceByWasteType(current.type).toFixed(2),
    }));
  }, [form.type]);

  const handlePublish = () => {
    const selectedInventory = items.find((item) => item.id === form.inventoryId);
    if (!selectedInventory || !user) {
      return;
    }

    addItem({
      name: form.title,
      type: selectedInventory.type,
      description: form.description || `Material disponível no estoque da ${user.razaoSocial}.`,
      quantity: Number(form.quantity),
      unit: form.unit,
      location: form.location,
      price: Number(form.price || form.suggestedPrice),
      company: user.razaoSocial,
    });

    toast({
      title: "Anúncio publicado",
      description: "Seu resíduo já está disponível no marketplace.",
    });

    setCurrentStep(0);
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Criar Anúncio</h2>
        <p className="text-muted-foreground">Publique um resíduo do seu estoque no marketplace</p>
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
                    setForm({
                      ...form,
                      inventoryId: value,
                      title: selectedItem.name,
                      type: selectedItem.type,
                      quantity: String(selectedItem.quantity),
                      unit: selectedItem.unit,
                      suggestedPrice: getSuggestedPriceByWasteType(selectedItem.type).toFixed(2),
                    });
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
                  Nenhum item disponível no estoque. Cadastre um resíduo antes de criar um anúncio.
                </p>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Detalhes do Anúncio</CardTitle>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descreva as especificações técnicas do material..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantidade para Venda</Label>
                  <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
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
                <Label>Fotos do Material</Label>
                <div className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:bg-muted/50">
                  <ImagePlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload visual ainda ilustrativo. O anúncio já publica normalmente sem foto.</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Precificação</CardTitle>
              <Card className="border-primary/30 bg-accent/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Sugestão Inteligente de Preço (IA)</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      R$ {form.suggestedPrice.replace(".", ",")}
                      <span className="text-sm font-normal text-muted-foreground"> / {form.unit}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getMarketInsight()}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Seu Preço (R$ / {form.unit})</Label>
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
                  A recomendação é calculada a partir do histórico de preços do tipo de resíduo selecionado.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, price: form.suggestedPrice })}>
                Usar preço sugerido
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Revisão do Anúncio</CardTitle>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Título</span>
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
                  <span className="text-muted-foreground">Localização</span>
                  <span className="font-medium">{form.location || "-"}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-border py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Preço</span>
                  <span className="text-lg font-bold text-primary">
                    R$ {(form.price || form.suggestedPrice).replace(".", ",")} / {form.unit}
                  </span>
                </div>
                {form.description && (
                  <div className="py-2">
                    <p className="mb-1 text-muted-foreground">Descrição</p>
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
                Próximo
              </Button>
            ) : (
              <Button onClick={handlePublish} disabled={!form.quantity || !form.location}>
                Publicar Anúncio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
