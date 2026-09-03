import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Segura as rotas privadas até sabermos se há usuário logado. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <p className="estado-carregando">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
