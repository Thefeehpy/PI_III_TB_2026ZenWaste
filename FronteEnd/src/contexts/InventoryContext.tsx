import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { InventoryItem, InventoryMovement, Reservation, ReservationStatus, SellerAd } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface CreateInventoryItemInput {
  name: string;
  type: string;
  quantity: number;
  unit: string;
}

interface AdjustInventoryQuantityInput {
  itemId: string;
  quantity: number;
  type: InventoryMovement["type"];
  note?: string;
}

interface CreateReservationInput {
  itemId: string;
  quantity: number;
  unitPrice: number;
  buyerName: string;
  buyerPhone: string;
  note?: string;
}

interface FinalizeAdInput {
  adId: string;
  soldQuantity: number;
  buyerName?: string;
  buyerPhone?: string;
  reservationQuantity?: number;
  reservationUnitPrice?: number;
  reservationNote?: string;
}

interface InventoryActionResult {
  success: boolean;
  message: string;
}

interface InventoryContextValue {
  items: InventoryItem[];
  movements: InventoryMovement[];
  reservations: Reservation[];
  sellerAds: SellerAd[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  addItem: (item: CreateInventoryItemInput) => Promise<InventoryActionResult>;
  adjustItemQuantity: (input: AdjustInventoryQuantityInput) => Promise<InventoryActionResult>;
  createReservation: (input: CreateReservationInput) => Promise<InventoryActionResult>;
  updateReservationStatus: (reservationId: string, status: ReservationStatus) => Promise<InventoryActionResult>;
  finalizeAd: (input: FinalizeAdInput) => Promise<InventoryActionResult>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

function sortItems(items: InventoryItem[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortMovements(movements: InventoryMovement[]) {
  return [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortReservations(reservations: Reservation[]) {
  return [...reservations].sort((a, b) => new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime());
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sellerAds, setSellerAds] = useState<SellerAd[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshInventory = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setMovements([]);
      setReservations([]);
      setSellerAds([]);
      return;
    }

    setIsLoading(true);
    try {
      const [itemsResponse, movementsResponse, reservationsResponse, sellerAdsResponse] = await Promise.all([
        api.listInventoryItems(),
        api.listInventoryMovements(),
        api.listReservations(),
        api.listSellerAds(),
      ]);

      setItems(sortItems(itemsResponse.items));
      setMovements(sortMovements(movementsResponse.movements));
      setReservations(sortReservations(reservationsResponse.items));
      setSellerAds(sellerAdsResponse.items);
    } catch {
      setItems([]);
      setMovements([]);
      setReservations([]);
      setSellerAds([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      movements,
      reservations,
      sellerAds,
      isLoading,
      refreshInventory,
      addItem: async (item) => {
        try {
          const quantity = Math.max(0, Number(item.quantity) || 0);
          const response = await api.createInventoryItem({
            name: item.name.trim(),
            type: item.type,
            quantity,
            unit: item.unit,
          });

          setItems((current) => sortItems([response.item, ...current]));

          const movementsResponse = await api.listInventoryMovements();
          setMovements(sortMovements(movementsResponse.movements));

          return {
            success: true,
            message: "Item cadastrado com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel cadastrar o item.",
          };
        }
      },
      adjustItemQuantity: async (input) => {
        try {
          const quantity = Number(input.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return {
              success: false,
              message: "Informe uma quantidade valida para registrar a movimentacao.",
            };
          }

          const response = await api.adjustInventoryItemQuantity({
            ...input,
            quantity,
          });

          setItems((current) => sortItems([response.item, ...current.filter((item) => item.id !== response.item.id)]));
          setMovements((current) => sortMovements([response.movement, ...current]));

          const reservationsResponse = await api.listReservations();
          setReservations(sortReservations(reservationsResponse.items));

          return {
            success: true,
            message: input.type === "entrada" ? "Entrada registrada com sucesso." : "Saida registrada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel registrar a movimentacao.",
          };
        }
      },
      createReservation: async (input) => {
        try {
          const response = await api.createReservation(input);
          setReservations((current) => sortReservations([response.reservation, ...current]));

          return {
            success: true,
            message: "Reserva criada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel criar a reserva.",
          };
        }
      },
      updateReservationStatus: async (reservationId, status) => {
        try {
          const response = await api.updateReservationStatus({ reservationId, status });
          setReservations((current) =>
            sortReservations(
              current.map((reservation) => (reservation.id === response.reservation.id ? response.reservation : reservation)),
            ),
          );

          if (status === "finalizada") {
            await refreshInventory();
          }

          return {
            success: true,
            message: "Reserva atualizada com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel atualizar a reserva.",
          };
        }
      },
      finalizeAd: async (input) => {
        try {
          const response = await api.finalizeMarketplaceAd(input);
          setItems((current) => sortItems([response.item, ...current.filter((item) => item.id !== response.item.id)]));
          setMovements((current) => sortMovements([response.movement, ...current]));
          setSellerAds((current) => current.map((ad) => (ad.id === response.ad.id ? response.ad : ad)));

          if (response.reservation) {
            setReservations((current) => sortReservations([response.reservation!, ...current]));
          }

          return {
            success: true,
            message: "Anuncio finalizado com sucesso.",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Nao foi possivel finalizar o anuncio.",
          };
        }
      },
    }),
    [isLoading, items, movements, refreshInventory, reservations, sellerAds],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }

  return context;
}
