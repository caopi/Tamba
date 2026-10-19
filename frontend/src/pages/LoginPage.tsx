import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ResendVerification } from "../components/ResendVerification";
import { Icone } from "../components/Icone";
import "./LoginPage.css";

//login e cadastro na mesma tela, alternando por botão
export function LoginPage() {
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // Login recusado porque a conta ainda não confirmou o e-mail (RGN-04).
  const [naoConfirmada, setNaoConfirmada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const { login, signup, avisoSessao } = useAuth();
  const navigate = useNavigate();
  // Veio de uma rota privada (ex.: link compartilhado)? Volta para lá depois.
  const destino = (useLocation().state as { from?: string } | null)?.from ?? "/";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setNaoConfirmada(false);
    setEnviando(true);

    try {
      if (modo === "login") {
        await login(email, password);
        navigate(destino);
      } else {
        // Com a confirmação de e-mail ligada no backend, o cadastro não loga
        // e vai para "confirme seu e-mail"; desligada, já entra direto.
        const { requiresVerification } = await signup({ name, nickname, email, password });
        if (requiresVerification) {
          navigate("/confirme-email", { state: { email: email.trim() } });
        } else {
          navigate(destino);
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") {
        setNaoConfirmada(true);
      } else {
        setErro(e instanceof Error ? e.message : "Não foi possível entrar");
      }
    } finally {
      setEnviando(false);
    }
  }

  function trocarModo() {
    setModo(modo === "login" ? "cadastro" : "login");
    setErro(null);
    setNaoConfirmada(false);
  }

  return (
    <div className="login-pagina">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>
          <Icone nome="barra-dex" padrao="🎣" /> Tamba
        </h1>
        <p className="login-subtitulo">Seu diário de pescarias</p>

        {avisoSessao && !erro && <p className="aviso">{avisoSessao}</p>}

        {modo === "cadastro" && (
          <>
            <label>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
            <label>
              Apelido
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_.]+"
                title="Letras, números, ponto e sublinhado"
                placeholder="pescador_do_tiete"
              />
              <span className="campo-dica">É como os outros vão te ver. Letras, números, _ e .</span>
            </label>
          </>
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
            // RGN-03 no cadastro; no login qualquer tamanho vai para a API.
            minLength={modo === "cadastro" ? 8 : undefined}
          />
          {modo === "cadastro" && <span className="campo-dica">Mínimo de 8 caracteres.</span>}
        </label>

        {erro && <p className="erro">{erro}</p>}

        {naoConfirmada && (
          <p className="aviso">
            Sua conta ainda não foi confirmada. Abra o link que enviamos para{" "}
            <strong>{email.trim()}</strong> — ou peça um novo logo abaixo.
          </p>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : modo === "login" ? "Entrar" : "Criar conta"}
        </button>

        <button type="button" className="link" onClick={trocarModo}>
          {modo === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
      </form>

      {/* Fora do <form> do login: é outro formulário, com submit próprio. */}
      {naoConfirmada && (
        <div className="login-card login-reenvio">
          <ResendVerification emailInicial={email.trim()} />
        </div>
      )}
    </div>
  );
}
