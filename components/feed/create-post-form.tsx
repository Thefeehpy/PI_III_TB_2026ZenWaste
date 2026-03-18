"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import type { ResiduePost } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Plus, ImagePlus, X } from "lucide-react"

const residueTypes = [
  "Alumínio",
  "Cobre",
  "Ferro",
  "Aço Inox",
  "Papelão",
  "Papel Branco",
  "PET",
  "PEAD",
  "Vidro Transparente",
  "Vidro Colorido",
  "Óleo de Cozinha",
  "Resíduo Eletrônico",
  "Madeira",
  "Borracha",
  "Têxtil",
  "Outro",
]

interface CreatePostFormProps {
  onPostCreated: () => void
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState("")
  const [formData, setFormData] = useState({
    type: "",
    customType: "",
    quantity: "",
    unit: "kg" as "kg" | "ton" | "litros" | "unidades",
    price: "",
    description: "",
    location: "",
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddImage = () => {
    if (newImageUrl && imageUrls.length < 4) {
      setImageUrls((prev) => [...prev, newImageUrl])
      setNewImageUrl("")
    }
  }

  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)

    const newPost: ResiduePost = {
      id: crypto.randomUUID(),
      companyId: user.id,
      companyName: user.name,
      type: formData.type === "Outro" ? formData.customType : formData.type,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      price: parseFloat(formData.price),
      description: formData.description,
      location: formData.location || `${user.city}, ${user.state}`,
      images: imageUrls,
      createdAt: new Date().toISOString(),
      status: "disponivel",
    }

    const existingPosts: ResiduePost[] = JSON.parse(
      localStorage.getItem("residuos_posts") || "[]"
    )
    existingPosts.unshift(newPost)
    localStorage.setItem("residuos_posts", JSON.stringify(existingPosts))

    setIsLoading(false)
    setOpen(false)
    setFormData({
      type: "",
      customType: "",
      quantity: "",
      unit: "kg",
      price: "",
      description: "",
      location: "",
    })
    setImageUrls([])
    onPostCreated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Publicar Resíduo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar Resíduo para Venda</DialogTitle>
          <DialogDescription>
            Preencha as informações do resíduo que deseja comercializar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de Resíduo</FieldLabel>
              <Select
                value={formData.type}
                onValueChange={(value) => handleChange("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {residueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {formData.type === "Outro" && (
              <Field>
                <FieldLabel>Especifique o tipo</FieldLabel>
                <Input
                  placeholder="Digite o tipo de resíduo"
                  value={formData.customType}
                  onChange={(e) => handleChange("customType", e.target.value)}
                  required
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Quantidade</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Unidade</FieldLabel>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => handleChange("unit", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="ton">Tonelada (ton)</SelectItem>
                    <SelectItem value="litros">Litros</SelectItem>
                    <SelectItem value="unidades">Unidades</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>Preço por {formData.unit}</FieldLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                placeholder="Descreva as características do resíduo, condições, etc."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Localização</FieldLabel>
              <Input
                placeholder={user ? `${user.city}, ${user.state}` : "Cidade, Estado"}
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Imagens (URLs)</FieldLabel>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cole a URL da imagem"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddImage}
                    disabled={!newImageUrl || imageUrls.length >= 4}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                </div>
                {imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imageUrls.map((url, index) => (
                      <div
                        key={index}
                        className="relative h-16 w-16 overflow-hidden rounded-md border border-border"
                      >
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Máximo de 4 imagens
                </p>
              </div>
            </Field>
          </FieldGroup>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading || !formData.type || !formData.quantity || !formData.price}
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
