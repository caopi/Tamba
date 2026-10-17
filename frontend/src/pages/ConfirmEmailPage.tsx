import { Link, useLocation } from "react-router-dom";
import { ResendVerification } from "../components/ResendVerification";
import "./LoginPage.css";

/** Logo depois do cadastro: a conta existe, mas só ativa ao confirmar o e-mail. */
export function ConfirmEmailPage() {
  // O e-mail vem do cadastro. Abrindo a URL direto ele não existe, e a tela
  // continua funcionando — só pede o e-mail no reenvio.
  const email = (useLocation().state as { email?: string } | null)?.email ?? "";

  return (
    <div className="login-pagina">
      <div className="login-card">
        <h1>📬 Confirme seu e-mail</h1>
        <p>
          Conta criada! Enviamos um link de confirmação
          {email ? (
            <>
              {" "}para <strong>{email}</strong>
            </>
          ) : null}
          . Abra o link para ativar a conta — ele vale por 24 horas.
        </p>

        {/* Só em desenvolvimento: não há SMTP, o "e-mail" sai no terminal da API. */}
        {import.meta.env.DEV && (
          <p className="campo-dica">
            Em desenvolvimento o e-mail não é enviado de verdade: o link aparece no
            terminal onde a API está rodando.
          </p>
        )}

        <hr className="login-separador" />
        <p className="campo-dica">Não chegou?</p>
        <ResendVerification emailInicial={email} />

        <Link to="/login" className="login-link">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
