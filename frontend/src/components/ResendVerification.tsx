import { useState, type FormEvent } from "react";
import { authApi } from "../api/auth";

/**
 * "Reenviar link de confirmação". Usado no login (conta não confirmada), na
 * tela de "confirme seu e-mail" e na página de link expirado/inválido.
 *
 * A API responde igual exista o e-mail ou não, então a mensagem de sucesso
 * também é neutra.
 */
export function ResendVerification({ emailInicial = "" }: { emailInicial?: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEstado("enviando");
    try {
      await authApi.resendVerification(email.trim());
      setEstado("enviado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reenviar");
      setEstado("parado");
    }
  }

  if (estado === "enviado") {
    return (
      <p className="reenvio-ok">
        Se houver uma conta pendente com <strong>{email.trim()}</strong>, enviamos um
        link novo. O anterior deixou de valer.
      </p>
    );
  }

  return (
    <form className="reenvio" onSubmit={reenviar}>
      <label>
        E-mail da conta
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button type="submit" disabled={estado === "enviando" || !email.trim()}>
        {estado === "enviando" ? "Enviando…" : "Reenviar link de confirmação"}
      </button>
    </form>
  );
}
