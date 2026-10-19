import { useState } from "react";
import { Link } from "react-router-dom";
import { postApi } from "../api/social";
import { useAuth } from "../context/AuthContext";
import { formatarData } from "../format";
import { useUnidades } from "../units";
import type { Catch } from "../types";
import { Avatar } from "./Avatar";
import { Icone } from "./Icone";
import { FollowButton } from "./FollowButton";
import { RarityBadge } from "./RarityBadge";
import { ReportDialog } from "./ReportDialog";
import { ModerationPanel } from "./ModerationPanel";
import "./CatchCard.css";

/**
 * Uma captura como post (REQ-27): fotos, autor, espécie, peso/tamanho, local
 * e data, com curtir, comentar, compartilhar e denunciar (UC006).
 *
 * Usado no feed, no perfil público e no detalhe. `aoMudar` devolve a captura
 * atualizada (curtida) e `aoSeguir` avisa que o autor foi seguido/deixado,
 * para a tela atualizar os outros posts do mesmo autor.
 */
/** "1 curtida", "3 curtidas". */
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

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
  const unidades = useUnidades();
  const minha = captura.userId === user?.id;
  const [curtindo, setCurtindo] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [moderando, setModerando] = useState(false);
  const ehAdmin = user?.role === "admin";
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
          <Avatar id={captura.author.id} name={captura.author.name} avatarUrl={captura.author.avatarUrl} />
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
          {/* O autor vê "em análise"; o admin (único outro que enxerga uma
              captura oculta) vê o estado de moderação, "oculta". */}
          {captura.isHidden && (
            <span className="post-selo-analise">{minha ? "em análise" : "oculta"}</span>
          )}
        </div>
        <p className="post-medidas">
          {unidades.peso(captura.weight)} · {unidades.comprimento(captura.length)}
        </p>
        <p className="post-local">
          {[local, regiao].filter(Boolean).join(" · ") || "Local não informado"} ·{" "}
          {formatarData(captura.caughtAt)}
        </p>
      </div>

      {/* Ações só com ícone, como em rede social. Cada uma tem nome acessível
          completo (aria-label) — sem ele, o leitor de tela anunciaria só
          "botão" e não daria para distinguir curtir de denunciar — e o mesmo
          texto no title, de dica para quem usa mouse. Os números (curtidas,
          comentários) continuam à vista. */}
      <footer className="post-acoes">
        <button
          type="button"
          className={captura.likedByMe ? "post-acao ativa" : "post-acao"}
          onClick={curtir}
          disabled={curtindo}
          aria-pressed={captura.likedByMe}
          aria-label={`Curtir (${plural(captura.likeCount, "curtida", "curtidas")})`}
          title="Curtir"
        >
          {captura.likedByMe ? <Icone nome="feed-curtido" padrao="❤️" /> : <Icone nome="feed-curtir" padrao="🤍" />}
          <span aria-hidden="true">{captura.likeCount}</span>
        </button>
        <Link
          to={`/capturas/${captura.id}#comentarios`}
          className="post-acao botao"
          aria-label={`Comentários (${plural(captura.commentCount, "comentário", "comentários")})`}
          title="Comentários"
        >
          <Icone nome="feed-comentar" padrao="💬" />
          <span aria-hidden="true">{captura.commentCount}</span>
        </Link>
        <button type="button" className="post-acao" onClick={compartilhar} aria-label="Compartilhar" title="Compartilhar">
          <Icone nome="feed-compartilhar" padrao="↗" />
        </button>
        {ehAdmin && (
          <button
            type="button"
            className={moderando ? "post-acao post-moderar ativa" : "post-acao post-moderar"}
            onClick={() => setModerando((m) => !m)}
            aria-expanded={moderando}
            aria-label="Moderar captura"
            title="Moderar captura"
          >
            <Icone nome="feed-moderar" padrao="🛡" />
          </button>
        )}
        {!minha && (
          <button
            type="button"
            className="post-acao post-denunciar"
            onClick={() => setDenunciando(true)}
            aria-label="Denunciar captura"
            title="Denunciar captura"
          >
            <Icone nome="denunciar" padrao="⚑" />
          </button>
        )}
      </footer>
      {aviso && <p className="post-aviso">{aviso}</p>}
      {/* UC011: só admin vê; a API recusa para os demais de qualquer jeito. */}
      {ehAdmin && moderando && <ModerationPanel captura={captura} aoMudar={aoMudar} />}

      {denunciando && <ReportDialog catchId={captura.id} aoFechar={() => setDenunciando(false)} />}
    </article>
  );
}

/** Fotos do post: uma por vez, com setas e contador quando há mais de uma. */
function Galeria({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [indice, setIndice] = useState(0);
  if (fotos.length === 0)
    return (
      <div className="post-sem-foto" aria-hidden="true">
        <Icone nome="tambaqui" padrao="🐟" />
      </div>
    );

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
