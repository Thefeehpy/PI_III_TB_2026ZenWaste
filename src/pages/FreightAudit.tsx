import { useAuth } from "@/contexts/AuthContext";
import { AuditoriaFretes } from "@/features/auditoria-fretes/AuditoriaFretes";

export default function AuditoriaDeFretes() {
  const { user: empresa } = useAuth();
  return <AuditoriaFretes key={empresa?.id ?? "visitante"} />;
}
