import { Link, useSearchParams } from "react-router-dom";
import { ResendVerification } from "../components/ResendVerification";
import type { VerificationStatus } from "../types";
import "./LoginPage.css";

/**
 * Destino do link de confirmação. A API confere o token e redireciona para cá
 * com `?status=ok|expired|invalid`; esta tela só mostra o resultado.
 */
const MENSAGENS: Record<VerificationStatus, { titulo: string; texto: string }> = {
  ok: {
    titulo: "✅ E-mail confirmado!",
    texto: "Sua conta está ativa. Já pode entrar e registrar a primeira captura.",
  },
  expired: {
    titulo: "⌛ Link expirado",
    texto: "O link de confirmação vale por 24 horas e esse já passou do prazo. Peça um novo abaixo.",
  },
  invalid: {
    titulo: "⚠️ Link inválido",
    texto:
      "Esse link não é válido ou já foi usado. Se a conta já foi confirmada, é só entrar; se não, peça um novo link.",
  },
};

export function VerificationPage() {
  const [params] = useSearchParams();
  const bruto = params.get("status");
  // Qualquer coisa fora dos três valores (URL editada à mão) cai em "inválido".
  const status: VerificationStatus =
    bruto === "ok" || bruto === "expired" ? bruto : "invalid";
  const { titulo, texto } = MENSAGENS[status];

  return (
    <div className="login-pagina">
      <div className="login-card">
        <h1>{titulo}</h1>
        <p>{texto}</p>

        {status === "ok" ? (
          <Link to="/login" className="login-botao-link">
            Entrar
          </Link>
        ) : (
          <>
            <ResendVerification />
            <Link to="/login" className="login-link">
              Ir para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
