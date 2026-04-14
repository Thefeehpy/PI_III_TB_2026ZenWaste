import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useInventory } from "@/contexts/InventoryContext";
import { wasteTypes } from "@/data/mockData";

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialForm = {
  name: "",
  type: "",
  quantity: "",
  unit: "kg",
  target: "",
  deadline: "",
};

export function CreateItemModal({ open, onOpenChange }: CreateItemModalProps) {
  const [form, setForm] = useState(initialForm);
  const { addItem } = useInventory();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await addItem({
      name: form.name,
      type: form.type,
      quantity: Number(form.quantity),
      unit: form.unit,
      targetQuantity: Number(form.target),
      deadline: form.deadline,
    });

    if (!result.success) {
      toast({
        title: "Item nao cadastrado",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Item cadastrado",
      description: result.message,
    });

    onOpenChange(false);
    setForm(initialForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-muted/40 px-6 py-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl">Cadastrar item de estoque</DialogTitle>
            <DialogDescription className="max-w-xl leading-6">
              Crie um novo item para começar a controlar saldo, meta e movimentações operacionais.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do resíduo</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo de resíduo</Label>
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {wasteTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Saldo inicial</Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ton">ton</SelectItem>
                  <SelectItem value="L">Litros</SelectItem>
                  <SelectItem value="un">Unidades</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Meta do item</Label>
              <Input
                id="target"
                type="number"
                min="1"
                step="0.01"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                required
              />
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              O saldo inicial será registrado automaticamente como a primeira entrada do item, o que
              ajuda a manter o histórico operacional mais claro desde o cadastro.
            </div>
          </div>

          <DialogFooter className="gap-3 border-t border-border pt-5 sm:justify-between sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!form.type}>
              Cadastrar item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
