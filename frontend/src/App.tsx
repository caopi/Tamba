import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { ConfirmEmailPage } from "./pages/ConfirmEmailPage";
import { VerificationPage } from "./pages/VerificationPage";
import { FishDexPage } from "./pages/FishDexPage";
import { LogCatchPage } from "./pages/LogCatchPage";
import { ProfilePage } from "./pages/ProfilePage";
import { FeedPage } from "./pages/FeedPage";
import { CatchDetailPage } from "./pages/CatchDetailPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { CreditsPage } from "./pages/CreditsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Públicas: quem chega aqui ainda não consegue entrar. */}
          <Route path="/confirme-email" element={<ConfirmEmailPage />} />
          {/* Destino do link do e-mail (a API redireciona com ?status=). */}
          <Route path="/verificacao" element={<VerificationPage />} />
          {/* Créditos das fotos: público, é o endereço citado no relatório. */}
          <Route path="/creditos" element={<CreditsPage />} />

          {/* Tudo abaixo exige usuário logado e usa o Layout com a navegação. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<FishDexPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/registrar" element={<LogCatchPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/capturas/:id" element={<CatchDetailPage />} />
              <Route path="/capturas/:id/editar" element={<LogCatchPage />} />
              <Route path="/u/:id" element={<PublicProfilePage />} />
              {/* A busca de pessoas virou aba do Feed; o endereço antigo leva para lá. */}
              <Route path="/pessoas" element={<Navigate to="/feed?aba=pessoas" replace />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route path="/notificacoes" element={<NotificationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
