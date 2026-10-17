import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { tokenStorage } from "../api/client";
import type { SignupInput, User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Cadastra. Se o backend não exige confirmação de e-mail, já deixa o
   * usuário logado. Devolve se a confirmação é exigida (aí ninguém é logado).
   */
  signup: (data: SignupInput) => Promise<{ requiresVerification: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Só ficamos em "carregando" se houver token para revalidar
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()));

  // Ao abrir o app, se existe token salvo, confirma com a API quem é o usuário.
  // Se o token expirou (7 dias), descartamos e o usuário volta para o login.
  useEffect(() => {
    if (!tokenStorage.get()) return;

    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { user, token } = await authApi.login({ email, password });
    tokenStorage.set(token);
    setUser(user);
  }

  async function signup(data: SignupInput) {
    const { user, token, requiresVerification } = await authApi.signup(data);
    if (token) {
      tokenStorage.set(token);
      setUser(user);
    }
    return { requiresVerification };
  }

  function logout() {
    tokenStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
