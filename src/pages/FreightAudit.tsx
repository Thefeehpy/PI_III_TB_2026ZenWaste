import { useAuth } from "@/contexts/AuthContext";
import { AuditoriaIntegrada } from "@/features/auditoria-fretes/AuditoriaIntegrada";

export default function AuditoriaDeFretes() {
  const { user: empresa } = useAuth();
  return <AuditoriaIntegrada key={empresa?.id ?? "visitante"} />;
}
