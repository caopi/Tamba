import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { notificationsApi } from "../api/notifications";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import "./Layout.css";

// Ícones das abas: traço simples, herdam a cor da aba (currentColor).
const ICONE = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function IconeDex() {
  return (
    <svg {...ICONE}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconeRegistrar() {
  return (
    <svg {...ICONE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function IconeFeed() {
  return (
    <svg {...ICONE}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

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
  const { user } = useAuth();
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

        <div className="layout-user">
          <NavLink to="/notificacoes" className="layout-sino" title={rotuloSino} aria-label={rotuloSino}>
            🔔
            {naoLidas > 0 && <span className="layout-sino-contador">{naoLidas > 99 ? "99+" : naoLidas}</span>}
          </NavLink>
          {/* Perfil: pela foto, ou pelo @apelido de quem não tem foto. De lá
              saem Configurações, Créditos e Sair. */}
          <NavLink to="/perfil" className="layout-perfil" title="Meu perfil" aria-label="Meu perfil">
            {user?.avatarUrl ? (
              <Avatar name={user.name} avatarUrl={user.avatarUrl} tamanho={32} />
            ) : (
              <span className="layout-apelido">@{user?.nickname}</span>
            )}
            {user?.role === "admin" && <span className="layout-admin">admin</span>}
          </NavLink>
        </div>
      </header>

      <main className="layout-main">
        <Outlet context={{ definirNaoLidas: setNaoLidas } satisfies LayoutContexto} />
      </main>

      {/* Abas principais, embaixo, como em app de celular. Na tela larga
          continua embaixo, mas com largura limitada. */}
      <nav className="layout-abas" aria-label="Navegação principal">
        <NavLink to="/" end className="layout-aba">
          <IconeDex />
          <span>Dex</span>
        </NavLink>
        <NavLink to="/registrar" className="layout-aba">
          <IconeRegistrar />
          <span>Registrar Captura</span>
        </NavLink>
        <NavLink to="/feed" className="layout-aba">
          <IconeFeed />
          <span>Feed</span>
        </NavLink>
      </nav>
    </div>
  );
}
