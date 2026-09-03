import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { FishDexPage } from "./pages/FishDexPage";
import { LogCatchPage } from "./pages/LogCatchPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Tudo abaixo exige usuário logado e usa o Layout com a navegação. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<FishDexPage />} />
              <Route path="/registrar" element={<LogCatchPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
