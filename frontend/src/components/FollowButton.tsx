import { useState } from "react";
import { usersApi } from "../api/social";

/**
 * Seguir / deixar de seguir (UC008). A API é idempotente e devolve o estado
 * final, então um toque duplo não dá erro — o botão só reflete o que voltou.
 * `aoMudar` avisa a tela para atualizar outros lugares com o mesmo autor.
 */
export function FollowButton({
  userId,
  seguindo,
  aoMudar,
  compacto = false,
}: {
  userId: string;
  seguindo: boolean;
  aoMudar?: (estado: { following: boolean; followers: number }) => void;
  compacto?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    setEnviando(true);
    setErro(null);
    try {
      const estado = seguindo ? await usersApi.unfollow(userId) : await usersApi.follow(userId);
      aoMudar?.(estado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={seguindo ? "secundario botao-seguir" : "botao-seguir"}
        onClick={alternar}
        disabled={enviando}
        style={compacto ? { padding: "0.3rem 0.7rem", fontSize: "0.8rem" } : undefined}
      >
        {seguindo ? "Seguindo" : "Seguir"}
      </button>
      {erro && <span className="campo-erro">{erro}</span>}
    </>
  );
}
