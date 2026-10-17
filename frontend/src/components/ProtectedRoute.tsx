import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Segura as rotas privadas até sabermos se há usuário logado. Sem login,
 * manda para /login lembrando de onde veio — assim um link compartilhado de
 * captura (REQ-33) abre a captura depois de entrar, e não a Dex.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="estado-carregando">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}
