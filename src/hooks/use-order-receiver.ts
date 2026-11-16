import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  parseReceiverSnapshot,
  readReceiverSnapshot,
  RECEIVER_CHANGE_EVENT,
  RECEIVER_STORAGE_PREFIX,
} from "@/lib/order-receiver";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(RECEIVER_STORAGE_PREFIX)) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(RECEIVER_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RECEIVER_CHANGE_EVENT, onChange);
  };
}

export function useOrderReceiver(orderNumber: string) {
  const getSnapshot = useCallback(() => readReceiverSnapshot(orderNumber), [orderNumber]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return useMemo(() => parseReceiverSnapshot(raw), [raw]);
}
