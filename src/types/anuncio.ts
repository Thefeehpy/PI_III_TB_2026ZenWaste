/** Retrato do material preservado pelo pedido, independente do anúncio atual. */
export interface MaterialNegociado {
  id: string;
  name: string;
  type: string;
  description: string;
  quantity: number;
  unit: string;
  /** Preço em reais por unidade de medida. */
  price: number;
  location: string;
  company: string;
  imageUrl: string;
}

export interface ImagemAnuncio {
  id: string;
  url: string;
  isCover: boolean;
  order: number;
}

export interface Anuncio extends MaterialNegociado {
  images: ImagemAnuncio[];
  createdAt: string;
  contactPhone: string;
  whatsappUrl: string;
}

export interface AnuncioVendedor extends Anuncio {
  itemId: string;
  status: "ativo" | "inativo" | "vendido";
  availableQuantity: number;
}

export interface EntradaImagemAnuncio {
  url: string;
  isCover?: boolean;
  order?: number;
}

/** O backend aceita a imagem legada ou a coleção, sem combinar os dois formatos. */
type ImagensCadastroAnuncio =
  | { imageUrl?: string; images?: never }
  | { imageUrl?: never; images: EntradaImagemAnuncio[] };

export type CadastroAnuncio = {
  inventoryId?: string;
  name: string;
  type: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number;
  location?: string;
} & ImagensCadastroAnuncio;

export type AtualizacaoAnuncio = Partial<Omit<CadastroAnuncio, "inventoryId" | "images" | "imageUrl">> &
  ImagensCadastroAnuncio;

export interface FinalizacaoVendaAnuncio {
  soldQuantity: number;
  buyerName?: string;
  buyerPhone?: string;
  buyerCompanyId?: number;
  reservationQuantity?: number | null;
  reservationUnitPrice?: number | null;
  reservationNote?: string;
}
