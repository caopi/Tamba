import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { postApi } from "../api/social";
import { useAuth } from "../context/AuthContext";
import { CatchCard } from "../components/CatchCard";
import { Avatar } from "../components/Avatar";
import { Icone } from "../components/Icone";
import { formatarData } from "../format";
import type { Catch, Comment } from "../types";
import "./CatchDetailPage.css";

/**
 * Detalhe de uma captura (REQ-30): o post completo, observações, localização
 * e comentários (REQ-29). É também o destino do link compartilhado (REQ-33).
 */
export function CatchDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  // Dados marcados com o id da captura: navegar para outra mostra
  // "carregando" até a nova chegar, sem zerar o estado à mão.
  const [dados, setDados] = useState<{ id: string; captura: Catch; comentarios: Comment[] } | null>(null);
  const [falha, setFalha] = useState<{ id: string; mensagem: string } | null>(null);
  const captura = dados?.id === id ? dados.captura : null;
  const comentarios = dados?.id === id ? dados.comentarios : [];
  const erro = falha?.id === id ? falha.mensagem : null;
  const setCaptura = (mudar: Catch | ((c: Catch) => Catch)) =>
    setDados((d) => d && { ...d, captura: typeof mudar === "function" ? mudar(d.captura) : mudar });
  const setComentarios = (mudar: (lista: Comment[]) => Comment[]) =>
    setDados((d) => d && { ...d, comentarios: mudar(d.comentarios) });
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroComentario, setErroComentario] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([postApi.get(id), postApi.comments(id)])
      .then(([c, lista]) => setDados({ id, captura: c, comentarios: lista }))
      // 404 também para captura oculta ou de conta inativa (RGN-12).
      .catch((e) => setFalha({ id, mensagem: e instanceof Error ? e.message : "Captura não encontrada" }));
  }, [id]);

  async function comentar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErroComentario(null);
    try {
      const novo = await postApi.addComment(id, texto.trim());
      setComentarios((lista) => [...lista, novo]);
      setCaptura((c) => ({ ...c, commentCount: c.commentCount + 1 }));
      setTexto("");
    } catch (e) {
      setErroComentario(e instanceof Error ? e.message : "Não foi possível comentar");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(comentarioId: string) {
    if (!confirm("Apagar este comentário?")) return;
    try {
      await postApi.deleteComment(comentarioId);
      setComentarios((lista) => lista.filter((c) => c.id !== comentarioId));
      setCaptura((c) => ({ ...c, commentCount: c.commentCount - 1 }));
    } catch (e) {
      setErroComentario(e instanceof Error ? e.message : "Não foi possível apagar");
    }
  }

  if (erro) {
    return (
      <section className="detalhe">
        <p className="erro">{erro}</p>
        <Link to="/feed">Voltar ao feed</Link>
      </section>
    );
  }
  if (!captura) return <p className="estado-carregando">Carregando…</p>;

  const minha = captura.userId === user?.id;

  return (
    <section className="detalhe">
      <CatchCard
        captura={captura}
        aoMudar={setCaptura}
        aoSeguir={(_, seguindo) =>
          setCaptura((c) => ({ ...c, author: { ...c.author, isFollowedByMe: seguindo } }))
        }
        linkParaDetalhe={false}
      />

      <div className="detalhe-bloco">
        {captura.notes && (
          <>
            <h3>Observações</h3>
            <p>{captura.notes}</p>
          </>
        )}

        <h3>Localização</h3>
        <Localizacao captura={captura} minha={minha} compartilha={Boolean(user?.shareExactLocation)} />
        <p className="campo-dica">Registrada em {formatarData(captura.createdAt)}</p>
      </div>

      <div className="detalhe-bloco" id="comentarios">
        <h3>Comentários ({comentarios.length})</h3>
        {comentarios.length === 0 && <p className="campo-dica">Ninguém comentou ainda.</p>}
        <ul className="comentarios">
          {comentarios.map((c) => (
            <li key={c.id}>
              <Avatar id={c.author.id} name={c.author.name} avatarUrl={c.author.avatarUrl} tamanho={30} />
              <div>
                <Link to={c.author.id === user?.id ? "/perfil" : `/u/${c.author.id}`}>
                  <strong>@{c.author.nickname}</strong>
                </Link>{" "}
                <span className="campo-dica">{formatarData(c.createdAt)}</span>
                <p>{c.body}</p>
              </div>
              {c.author.id === user?.id && (
                <button type="button" className="link" onClick={() => apagar(c.id)}>
                  apagar
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="comentar" onSubmit={comentar}>
          <textarea
            rows={2}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva um comentário…"
          />
          <button type="submit" disabled={enviando || !texto.trim()}>
            {enviando ? "Enviando…" : "Comentar"}
          </button>
        </form>
        {erroComentario && <p className="erro">{erroComentario}</p>}
      </div>
    </section>
  );
}

/**
 * RGN-13 na tela. A API só manda latitude/longitude para o próprio autor ou
 * quando o autor liga "compartilhar localização exata"; para os outros, a
 * chave nem vem — e aqui sobra só a região.
 */
function Localizacao({ captura, minha, compartilha }: { captura: Catch; minha: boolean; compartilha: boolean }) {
  const regiao = captura.spot?.location ?? captura.region;
  const local = captura.spot?.name ?? captura.spotName;
  const temCoordenada = captura.latitude != null && captura.longitude != null;

  return (
    <div className="localizacao">
      <p>
        {[local, regiao].filter(Boolean).join(" · ") || "Local não informado"}
      </p>
      {temCoordenada ? (
        <p>
          <Icone nome="local" padrao="📍" /> {captura.latitude!.toFixed(5)}, {captura.longitude!.toFixed(5)}{" "}
          <a
            href={`https://www.openstreetmap.org/?mlat=${captura.latitude}&mlon=${captura.longitude}#map=14/${captura.latitude}/${captura.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            ver no mapa
          </a>
          {minha && !compartilha && (
            <span className="campo-dica">
              {" "}
              — só você vê a coordenada; os outros veem só a região.
            </span>
          )}
        </p>
      ) : (
        !minha && (
          <p className="campo-dica">O autor não compartilha a localização exata — só a região.</p>
        )
      )}
    </div>
  );
}
