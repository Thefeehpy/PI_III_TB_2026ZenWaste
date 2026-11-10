import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RecuperacaoSessao } from "@/components/RecuperacaoSessao";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div role="status" className="p-6 text-sm text-muted-foreground">Carregando sessão...</div>;
  }

  if (sessionError) return <RecuperacaoSessao mensagem={sessionError} tentarNovamente={() => void retrySession()} sair={logout} />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

