import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { notificationsApi } from "../api/notifications";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import "./Layout.css";

// O sino consulta o número de não lidas a cada minuto, ao trocar de tela e
// ao voltar para a aba. Sem WebSocket: para um diário de pesca, um minuto
// de atraso não faz diferença.
const INTERVALO_SINO = 60_000;

interface LayoutContexto {
  /** A tela de notificações avisa o topo quando marca algo como lido. */
  definirNaoLidas: (total: number) => void;
}

export function useLayout() {
  return useOutletContext<LayoutContexto>();
}

export function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [naoLidas, setNaoLidas] = useState(0);

  const atualizarSino = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    notificationsApi
      .unreadCount()
      .then((r) => setNaoLidas(r.unreadCount))
      // Falha do sino não atrapalha a tela; 401 já é tratado no client.
      .catch(() => {});
  }, []);

  useEffect(() => {
    atualizarSino();
  }, [atualizarSino, pathname]);

  useEffect(() => {
    const timer = setInterval(atualizarSino, INTERVALO_SINO);
    document.addEventListener("visibilitychange", atualizarSino);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizarSino);
    };
  }, [atualizarSino]);

  const rotuloSino = naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações";

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-logo">
          🎣 Tamba
        </Link>

        <nav className="layout-nav">
          <NavLink to="/feed">Feed</NavLink>
          <NavLink to="/" end>
            Dex
          </NavLink>
          <NavLink to="/registrar">Registrar captura</NavLink>
          <NavLink to="/pessoas">Pessoas</NavLink>
          <NavLink to="/perfil">Perfil</NavLink>
        </nav>

        <div className="layout-user">
          <NavLink to="/notificacoes" className="layout-sino" title={rotuloSino} aria-label={rotuloSino}>
            🔔
            {naoLidas > 0 && <span className="layout-sino-contador">{naoLidas > 99 ? "99+" : naoLidas}</span>}
          </NavLink>
          <Link to="/configuracoes" className="layout-config" title="Configurações">
            {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} tamanho={28} />}
            <span>@{user?.nickname}</span>
            {user?.role === "admin" && <span className="layout-admin">admin</span>}
          </Link>
          <button type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <main className="layout-main">
        <Outlet context={{ definirNaoLidas: setNaoLidas } satisfies LayoutContexto} />
      </main>
    </div>
  );
}
