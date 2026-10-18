import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications";
import { Avatar } from "../components/Avatar";
import { useLayout } from "../components/Layout";
import { tempoRelativo } from "../format";
import type { AppNotification } from "../types";
import "./NotificationsPage.css";

/**
 * Notificações (UC009, REQ-43): quem curtiu, comentou ou começou a seguir.
 *
 * - Clicar abre a captura (curtida, comentário) ou o perfil (follow) e marca
 *   como lida; dá para marcar uma sem abrir, ou todas de uma vez.
 * - Não lidas ficam destacadas, e o número do sino acompanha o desta tela.
 * - Rolagem infinita como no feed. Avisos de conta desativada não chegam
 *   aqui (a API filtra), então nenhum leva a perfil que não abre.
 */
const POR_PAGINA = 20;

function textoDa(n: AppNotification) {
  const captura = n.speciesName ? `sua captura de ${n.speciesName}` : "sua captura";
  if (n.type === "like") return `curtiu ${captura}`;
  if (n.type === "comment") return `comentou em ${captura}`;
  return "começou a seguir você";
}

const destinoDa = (n: AppNotification) =>
  n.type === "follow" || !n.catchId ? `/u/${n.actor.id}` : `/capturas/${n.catchId}`;

export function NotificationsPage() {
  const { definirNaoLidas } = useLayout();
  const navigate = useNavigate();
  const [itens, setItens] = useState<AppNotification[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const sentinela = useRef<HTMLDivElement>(null);

  // O sino do topo mostra o mesmo número desta tela.
  useEffect(() => definirNaoLidas(naoLidas), [naoLidas, definirNaoLidas]);

  // Só mexe no estado quando a resposta chega; quem marca "carregando" é `carregar`,
  // e a primeira carga já nasce com carregando = true.
  const buscar = useCallback(
    (de: string | null) =>
      notificationsApi
        .list({ cursor: de, limit: POR_PAGINA })
        .then((pagina) => {
          setItens((atuais) => (de ? [...atuais, ...pagina.items] : pagina.items));
          setNaoLidas(pagina.unreadCount);
          setCursor(pagina.nextCursor);
          setAcabou(pagina.nextCursor === null);
        })
        .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar as notificações"))
        .finally(() => setCarregando(false)),
    [],
  );

  const carregar = useCallback(
    (de: string | null) => {
      setCarregando(true);
      setErro(null);
      buscar(de);
    },
    [buscar],
  );

  useEffect(() => {
    buscar(null);
  }, [buscar]);

  // Rolagem infinita: quando o sentinela entra na tela, busca a próxima página.
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || acabou) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas[0].isIntersecting && !carregando && cursor) carregar(cursor);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [carregar, carregando, cursor, acabou]);

  async function marcarComoLida(n: AppNotification) {
    if (n.isRead) return;
    setItens((atuais) => atuais.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
    setNaoLidas((total) => Math.max(0, total - 1));
    try {
      await notificationsApi.markRead(n.id);
    } catch {
      // Se falhar, a próxima carga mostra de novo como não lida.
    }
  }

  function abrir(n: AppNotification) {
    marcarComoLida(n);
    navigate(destinoDa(n));
  }

  async function marcarTodas() {
    try {
      await notificationsApi.markAllRead();
      setItens((atuais) => atuais.map((n) => ({ ...n, isRead: true })));
      setNaoLidas(0);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar como lidas");
    }
  }

  const vazio = !carregando && !erro && itens.length === 0 && acabou;

  return (
    <section className="notificacoes">
      <div className="notificacoes-topo">
        <h1>Notificações</h1>
        <button type="button" className="secundario" onClick={marcarTodas} disabled={naoLidas === 0}>
          Marcar todas como lidas
        </button>
      </div>

      {vazio && (
        <div className="notificacoes-vazio">
          <p>Nada por aqui ainda.</p>
          <p className="campo-dica">
            Quando alguém curtir ou comentar suas capturas, ou começar a seguir você, aparece aqui.
            Você escolhe o que quer receber em <Link to="/configuracoes">Configurações</Link>.
          </p>
        </div>
      )}

      <ul className="notificacoes-lista">
        {itens.map((n) => (
          <li key={n.id} className={n.isRead ? "notificacao" : "notificacao nao-lida"}>
            <button type="button" className="notificacao-abrir" onClick={() => abrir(n)}>
              <Avatar name={n.actor.name} avatarUrl={n.actor.avatarUrl} tamanho={40} />
              <span className="notificacao-texto">
                <span>
                  <strong>{n.actor.name}</strong> {textoDa(n)}
                  {n.catchIsHidden && <span className="notificacao-oculta"> (em análise)</span>}
                </span>
                <time dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString("pt-BR")}>
                  {tempoRelativo(n.createdAt)}
                </time>
              </span>
            </button>
            {!n.isRead && (
              <button
                type="button"
                className="notificacao-marcar"
                onClick={() => marcarComoLida(n)}
                title="Marcar como lida"
                aria-label="Marcar como lida"
              >
                <span className="notificacao-ponto" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {carregando && <p className="estado-carregando">Carregando…</p>}
      {erro && (
        <p className="erro">
          {erro}{" "}
          <button type="button" className="link" onClick={() => carregar(itens.length ? cursor : null)}>
            Tentar de novo
          </button>
        </p>
      )}
      <div ref={sentinela} className="notificacoes-sentinela" aria-hidden="true" />
    </section>
  );
}
