import { useState } from "react";
import { Link } from "react-router-dom";
import { postApi } from "../api/social";
import { useAuth } from "../context/AuthContext";
import { formatarData } from "../format";
import type { Catch } from "../types";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { RarityBadge } from "./RarityBadge";
import { ReportDialog } from "./ReportDialog";
import "./CatchCard.css";

/**
 * Uma captura como post (REQ-27): fotos, autor, espécie, peso/tamanho, local
 * e data, com curtir, comentar, compartilhar e denunciar (UC006).
 *
 * Usado no feed, no perfil público e no detalhe. `aoMudar` devolve a captura
 * atualizada (curtida) e `aoSeguir` avisa que o autor foi seguido/deixado,
 * para a tela atualizar os outros posts do mesmo autor.
 */
export function CatchCard({
  captura,
  aoMudar,
  aoSeguir,
  mostrarSeguir = true,
  linkParaDetalhe = true,
}: {
  captura: Catch;
  aoMudar?: (nova: Catch) => void;
  aoSeguir?: (autorId: string, seguindo: boolean) => void;
  mostrarSeguir?: boolean;
  linkParaDetalhe?: boolean;
}) {
  const { user } = useAuth();
  const minha = captura.userId === user?.id;
  const [curtindo, setCurtindo] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const linkAutor = minha ? "/perfil" : `/u/${captura.author.id}`;
  const local = captura.spot?.name ?? captura.spotName;
  const regiao = captura.spot?.location ?? captura.region;

  async function curtir() {
    setCurtindo(true);
    try {
      const estado = captura.likedByMe
        ? await postApi.unlike(captura.id)
        : await postApi.like(captura.id);
      aoMudar?.({ ...captura, likedByMe: estado.liked, likeCount: estado.likeCount });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível curtir");
    } finally {
      setCurtindo(false);
    }
  }

  /** REQ-33: Web Share API no celular; no computador, copia o link. */
  async function compartilhar() {
    const url = `${window.location.origin}/capturas/${captura.id}`;
    const titulo = `${captura.species.name} de @${captura.author.nickname} no Tamba`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado!");
    } catch (e) {
      // Fechar a janela de compartilhar do celular também cai aqui: não é erro.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAviso(`Copie o link: ${url}`);
    }
  }

  return (
    <article className="post">
      <header className="post-cabecalho">
        <Link to={linkAutor} className="post-autor">
          <Avatar name={captura.author.name} avatarUrl={captura.author.avatarUrl} />
          <span className="post-autor-textos">
            <strong>{captura.author.name}</strong>
            <span className="post-apelido">@{captura.author.nickname}</span>
          </span>
        </Link>
        {mostrarSeguir && !minha && (
          <FollowButton
            userId={captura.author.id}
            seguindo={captura.author.isFollowedByMe}
            compacto
            aoMudar={(estado) => aoSeguir?.(captura.author.id, estado.following)}
          />
        )}
      </header>

      <Galeria fotos={captura.photos.map((f) => f.url)} alt={captura.species.name} />

      <div className="post-corpo">
        <div className="post-especie">
          {linkParaDetalhe ? (
            <Link to={`/capturas/${captura.id}`}>
              <strong>{captura.species.name}</strong>
            </Link>
          ) : (
            <strong>{captura.species.name}</strong>
          )}
          <RarityBadge rarity={captura.species.rarity} />
          {captura.isHidden && <span className="post-selo-analise">em análise</span>}
        </div>
        <p className="post-medidas">
          {captura.weight.toLocaleString("pt-BR")} kg · {captura.length.toLocaleString("pt-BR")} cm
        </p>
        <p className="post-local">
          {[local, regiao].filter(Boolean).join(" · ") || "Local não informado"} ·{" "}
          {formatarData(captura.caughtAt)}
        </p>
      </div>

      <footer className="post-acoes">
        <button
          type="button"
          className={captura.likedByMe ? "post-acao ativa" : "post-acao"}
          onClick={curtir}
          disabled={curtindo}
          aria-pressed={captura.likedByMe}
        >
          {captura.likedByMe ? "❤️" : "🤍"} {captura.likeCount}
        </button>
        <Link to={`/capturas/${captura.id}#comentarios`} className="post-acao">
          💬 {captura.commentCount}
        </Link>
        <button type="button" className="post-acao" onClick={compartilhar}>
          ↗ Compartilhar
        </button>
        {!minha && (
          <button type="button" className="post-acao post-denunciar" onClick={() => setDenunciando(true)}>
            ⚑ Denunciar
          </button>
        )}
      </footer>
      {aviso && <p className="post-aviso">{aviso}</p>}

      {denunciando && <ReportDialog catchId={captura.id} aoFechar={() => setDenunciando(false)} />}
    </article>
  );
}

/** Fotos do post: uma por vez, com setas e contador quando há mais de uma. */
function Galeria({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [indice, setIndice] = useState(0);
  if (fotos.length === 0) return <div className="post-sem-foto">🐟</div>;

  const atual = Math.min(indice, fotos.length - 1);
  return (
    <div className="post-galeria">
      <img src={fotos[atual]} alt={`${alt} — foto ${atual + 1}`} loading="lazy" />
      {fotos.length > 1 && (
        <>
          <button
            type="button"
            className="post-seta esquerda"
            onClick={() => setIndice((atual - 1 + fotos.length) % fotos.length)}
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="post-seta direita"
            onClick={() => setIndice((atual + 1) % fotos.length)}
            aria-label="Próxima foto"
          >
            ›
          </button>
          <span className="post-contador">
            {atual + 1}/{fotos.length}
          </span>
        </>
      )}
    </div>
  );
}
