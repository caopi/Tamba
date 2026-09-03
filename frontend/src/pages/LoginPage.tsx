import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

//login e cadastro na mesma tela, alternando por botão
export function LoginPage() {
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      if (modo === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigate("/");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-pagina">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>🎣 Tamba</h1>
        <p className="login-subtitulo">Seu diário de pescarias</p>

        {modo === "cadastro" && (
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
        )}

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : modo === "login" ? "Entrar" : "Criar conta"}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => {
            setModo(modo === "login" ? "cadastro" : "login");
            setErro(null);
          }}
        >
          {modo === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
