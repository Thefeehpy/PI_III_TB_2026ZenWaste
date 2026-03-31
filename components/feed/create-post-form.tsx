"use client"

import { useState, useRef } from "react"
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
import { Plus, Upload, X, ImageIcon } from "lucide-react"

const residueTypes = [
  "Aluminio",
  "Cobre",
  "Ferro",
  "Aco Inox",
  "Papelao",
  "Papel Branco",
  "PET",
  "PEAD",
  "Vidro Transparente",
  "Vidro Colorido",
  "Oleo de Cozinha",
  "Residuo Eletronico",
  "Madeira",
  "Borracha",
  "Textil",
  "Outro",
]

interface CreatePostFormProps {
  onPostCreated: () => void
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: { file: File; preview: string }[] = []
    const remainingSlots = 4 - images.length

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file)
        newImages.push({ file, preview })
      }
    })

    setImages((prev) => [...prev, ...newImages])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (!files) return

    const newImages: { file: File; preview: string }[] = []
    const remainingSlots = 4 - images.length

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const preview = URL.createObjectURL(file)
        newImages.push({ file, preview })
      }
    })

    setImages((prev) => [...prev, ...newImages])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)

    // Convert images to base64 for localStorage storage
    const imageUrls: string[] = []
    for (const img of images) {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(img.file)
      })
      imageUrls.push(base64)
    }

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

    // Cleanup previews
    images.forEach((img) => URL.revokeObjectURL(img.preview))

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
    setImages([])
    onPostCreated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-violet-600/30">
          <Plus className="mr-2 h-4 w-4" />
          Publicar Residuo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar Residuo para Venda</DialogTitle>
          <DialogDescription>
            Preencha as informacoes do residuo que deseja comercializar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de Residuo</FieldLabel>
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
                  placeholder="Digite o tipo de residuo"
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
              <FieldLabel>Preco por {formData.unit}</FieldLabel>
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
              <FieldLabel>Descricao</FieldLabel>
              <Textarea
                placeholder="Descreva as caracteristicas do residuo, condicoes, etc."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Localizacao</FieldLabel>
              <Input
                placeholder={user ? `${user.city}, ${user.state}` : "Cidade, Estado"}
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Imagens</FieldLabel>
              <div className="space-y-3">
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="relative border-2 border-dashed border-border rounded-lg p-6 hover:border-blue-500 hover:bg-muted/50 transition-all cursor-pointer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={images.length >= 4}
                  />
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Clique para selecionar ou arraste as imagens
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG ou WEBP (max. 4 imagens)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Image previews */}
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-square overflow-hidden rounded-lg border border-border group"
                      >
                        <img
                          src={img.preview}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {images.length < 4 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-blue-500 hover:bg-muted/50 transition-all flex items-center justify-center"
                      >
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                )}
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
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
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
