import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import "./Layout.css";

//place holder 
export function Layout() {
  const { user, logout } = useAuth();

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
        <Outlet />
      </main>
    </div>
  );
}
