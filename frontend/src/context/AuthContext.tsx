import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { registrarPerdaDeSessao, tokenStorage } from "../api/client";
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
  /** Troca o usuário guardado depois de editar o perfil/configurações. */
  atualizarUsuario: (user: User) => void;
  /**
   * Motivo de o usuário ter caído para o login no meio do uso (sessão
   * expirada ou encerrada). A tela de login mostra; entrar de novo limpa.
   */
  avisoSessao: string | null;
}

const SESSAO_PERDIDA = "Sua sessão terminou (expirou ou a conta foi alterada). Entre novamente.";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Só ficamos em "carregando" se houver token para revalidar
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()));
  const [avisoSessao, setAvisoSessao] = useState<string | null>(null);
  const userAtual = useRef(user);
  useEffect(() => {
    userAtual.current = user;
  }, [user]);

  // Qualquer 401 de request com token (ver api/client.ts) derruba o login.
  // Sem usuário, o ProtectedRoute manda para /login lembrando a rota atual,
  // e lá aparece o aviso. Na abertura do app (token salvo já vencido) não há
  // aviso: a pessoa só chega na tela de login, como se tivesse saído.
  useEffect(() => {
    registrarPerdaDeSessao(() => {
      if (userAtual.current) setAvisoSessao(SESSAO_PERDIDA);
      setUser(null);
    });
    return () => registrarPerdaDeSessao(null);
  }, []);

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
    // Token velho guardado não pode ir junto: um 401 de senha errada seria
    // lido como "sessão perdida".
    tokenStorage.clear();
    const { user, token } = await authApi.login({ email, password });
    tokenStorage.set(token);
    setAvisoSessao(null);
    setUser(user);
  }

  async function signup(data: SignupInput) {
    tokenStorage.clear();
    const { user, token, requiresVerification } = await authApi.signup(data);
    if (token) {
      tokenStorage.set(token);
      setAvisoSessao(null);
      setUser(user);
    }
    return { requiresVerification };
  }

  function logout() {
    tokenStorage.clear();
    setAvisoSessao(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, atualizarUsuario: setUser, avisoSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
