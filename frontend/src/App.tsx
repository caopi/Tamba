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
import { PeopleSearchPage } from "./pages/PeopleSearchPage";

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

          {/* Tudo abaixo exige usuário logado e usa o Layout com a navegação. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<FishDexPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/registrar" element={<LogCatchPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/capturas/:id" element={<CatchDetailPage />} />
              <Route path="/u/:id" element={<PublicProfilePage />} />
              <Route path="/pessoas" element={<PeopleSearchPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
