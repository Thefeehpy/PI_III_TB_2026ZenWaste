import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { createDemoPaymentService } from "@/services/demo-payment-service";

export function usePayments() {
  const { user } = useAuth();
  const scope = user?.id ?? "guest";
  const service = useMemo(() => createDemoPaymentService(scope), [scope]);
  return { service, scope };
}

export function usePaymentOrder(id: string | undefined) {
  const { service, scope } = usePayments();
  const query = useQuery({
    queryKey: ["payment-order", scope, id],
    queryFn: () => service.getOrder(id!),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 5000 : false,
  });
  return { ...query, service, scope };
}
