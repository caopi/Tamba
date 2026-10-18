import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { feedApi, usersApi } from "../api/social";
import { useAuth } from "../context/AuthContext";
import { CatchCard } from "../components/CatchCard";
import { PersonCard } from "../components/PersonCard";
import { PeopleSearch } from "../components/PeopleSearch";
import type { Catch, FeedOrder, FeedScope, UserCard } from "../types";
import "./FeedPage.css";
import "../components/PersonCard.css";

/**
 * Feed (UC005).
 *
 * - Padrão "Seguindo" (REQ-26), com "Descobrir" para ver todo mundo (REQ-28).
 * - Ordem cronológica ou por engajamento (REQ-35).
 * - Rolagem infinita (REQ-32): um sentinela no fim da lista pede a próxima
 *   página quando aparece na tela. O botão "Atualizar" faz o papel do
 *   "puxar para atualizar" do celular.
 * - Sem ninguém seguido, o estado vazio sugere perfis (REQ-36).
 * - Aba "Pessoas": busca e sugestões de quem seguir (REQ-41/42), aqui dentro
 *   em vez de numa tela à parte. A aba fica na URL (?aba=pessoas), então link
 *   e recarregar a página voltam para ela.
 *
 * Quem decide o que aparece é a API (RGN-12: só autor ativo e captura não
 * oculta; RGN-13: coordenada só se o autor compartilha).
 */
const POR_PAGINA = 10;

/** Aba da URL -> escopo do feed. "pessoas" não é feed: é a busca. */
const ESCOPO_DA_ABA: Record<string, FeedScope> = {
  seguindo: "following",
  descobrir: "all",
  denunciadas: "reported",
};

export function FeedPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const pedida = params.get("aba") ?? "seguindo";
  // Aba desconhecida, ou "denunciadas" para quem não é admin: Seguindo.
  const aba =
    pedida === "pessoas" || (pedida in ESCOPO_DA_ABA && (pedida !== "denunciadas" || user?.role === "admin"))
      ? pedida
      : "seguindo";
  const pessoas = aba === "pessoas";
  const scope: FeedScope = ESCOPO_DA_ABA[aba] ?? "following";
  const irPara = (nova: string) => setParams(nova === "seguindo" ? {} : { aba: nova }, { replace: true });
  const [order, setOrder] = useState<FeedOrder>("recent");
  const [itens, setItens] = useState<Catch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<UserCard[] | null>(null);
  const [seguindoAlguem, setSeguindoAlguem] = useState<boolean | null>(null);

  // Cada carga ganha um número; resposta de uma carga antiga (o usuário
  // trocou de aba no meio) é descartada.
  const geracao = useRef(0);
  const sentinela = useRef<HTMLDivElement>(null);

  const carregar = useCallback(
    async (doZero: boolean) => {
      const minha = doZero ? ++geracao.current : geracao.current;
      setCarregando(true);
      setErro(null);
      try {
        const pagina = await feedApi.get({
          scope,
          order,
          cursor: doZero ? null : cursor,
          limit: POR_PAGINA,
        });
        if (minha !== geracao.current) return;
        setItens((atuais) => (doZero ? pagina.items : [...atuais, ...pagina.items]));
        setCursor(pagina.nextCursor);
        setAcabou(pagina.nextCursor === null);
      } catch (e) {
        if (minha === geracao.current) {
          setErro(e instanceof Error ? e.message : "Não foi possível carregar o feed");
        }
      } finally {
        if (minha === geracao.current) setCarregando(false);
      }
    },
    [scope, order, cursor],
  );

  // Trocar aba ou ordem recomeça do topo.
  useEffect(() => {
    if (pessoas) return;
    setItens([]);
    setCursor(null);
    setAcabou(false);
    carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a aba/ordem
  }, [scope, order, pessoas]);

  // Rolagem infinita: quando o sentinela entra na tela, busca a próxima página.
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || acabou || pessoas) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas[0].isIntersecting && !carregando && cursor) carregar(false);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [carregar, carregando, cursor, acabou, pessoas]);

  const vazio = !carregando && !erro && itens.length === 0 && acabou;

  // Feed "Seguindo" vazio: sugestões de quem seguir (REQ-36).
  useEffect(() => {
    if (!vazio || pessoas || scope !== "following" || !user) return;
    usersApi.profile(user.id).then((p) => setSeguindoAlguem(p.following > 0)).catch(() => {});
    usersApi.suggestions().then(setSugestoes).catch(() => setSugestoes([]));
  }, [vazio, pessoas, scope, user]);

  /** Seguir/deixar de seguir num post vale para todos os posts do mesmo autor. */
  function aoSeguir(autorId: string, seguindo: boolean) {
    setItens((atuais) =>
      atuais.map((c) =>
        c.author.id === autorId ? { ...c, author: { ...c.author, isFollowedByMe: seguindo } } : c,
      ),
    );
  }

  return (
    <section className="feed">
      <header className="feed-cabecalho">
        <div className="feed-abas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "seguindo"}
            className={aba === "seguindo" ? "feed-aba ativa" : "feed-aba"}
            onClick={() => irPara("seguindo")}
          >
            Seguindo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "descobrir"}
            className={aba === "descobrir" ? "feed-aba ativa" : "feed-aba"}
            onClick={() => irPara("descobrir")}
          >
            Descobrir
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pessoas}
            className={pessoas ? "feed-aba ativa" : "feed-aba"}
            onClick={() => irPara("pessoas")}
          >
            Pessoas
          </button>
          {/* Fila de moderação (UC011): só admin. Sem área de admin separada,
              é por aqui que ele acha o que foi denunciado — inclusive o que
              já sumiu do feed por denúncias (RGN-14). */}
          {user?.role === "admin" && (
            <button
              type="button"
              role="tab"
              aria-selected={aba === "denunciadas"}
              className={aba === "denunciadas" ? "feed-aba ativa feed-aba-admin" : "feed-aba feed-aba-admin"}
              onClick={() => irPara("denunciadas")}
              title="Denunciadas (só admin)"
            >
              {/* No celular estreito, o escudo some e sobra só a palavra. */}
              <span className="feed-aba-escudo" aria-hidden="true">
                🛡{" "}
              </span>
              Denunciadas
            </button>
          )}
        </div>

        {!pessoas && (
        <div className="feed-controles">
          <label className="feed-ordem">
            Ordem
            <select value={order} onChange={(e) => setOrder(e.target.value as FeedOrder)}>
              <option value="recent">Mais recentes</option>
              <option value="engagement">Mais curtidas e comentários</option>
            </select>
          </label>
          <button type="button" className="secundario" onClick={() => carregar(true)} disabled={carregando}>
            ↻ Atualizar
          </button>
        </div>
        )}
      </header>

      {pessoas ? (
        <PeopleSearch />
      ) : (
        <>
      {erro && <p className="erro">{erro}</p>}

      {vazio && scope === "following" ? (
        <div className="feed-vazio">
          <h3>
            {seguindoAlguem
              ? "Quem você segue ainda não postou nenhuma captura"
              : "Você ainda não segue ninguém"}
          </h3>
          <p>Siga outros pescadores para ver as capturas deles aqui. Algumas sugestões:</p>
          {sugestoes === null ? (
            <p className="estado-carregando">Buscando sugestões…</p>
          ) : sugestoes.length === 0 ? (
            <p className="campo-dica">Ainda não há sugestões. Veja a aba Descobrir.</p>
          ) : (
            <ul className="pessoas">
              {sugestoes.map((p) => (
                <PersonCard
                  key={p.id}
                  pessoa={p}
                  aoMudar={(nova) => setSugestoes((lista) => lista!.map((x) => (x.id === nova.id ? nova : x)))}
                />
              ))}
            </ul>
          )}
          <button type="button" className="link" onClick={() => irPara("descobrir")}>
            Ver todas as capturas em Descobrir
          </button>
          {sugestoes?.some((p) => p.isFollowedByMe) && (
            <button type="button" onClick={() => carregar(true)}>
              Pronto, atualizar meu feed
            </button>
          )}
        </div>
      ) : vazio ? (
        <p className="feed-vazio">
          {scope === "reported" ? "Nenhuma denúncia pendente. 🎉" : "Nenhuma captura por aqui ainda."}
        </p>
      ) : (
        <ul className="feed-lista">
          {itens.map((captura) => (
            <li key={captura.id}>
              <CatchCard
                captura={captura}
                aoMudar={(nova) => setItens((atuais) => atuais.map((c) => (c.id === nova.id ? nova : c)))}
                aoSeguir={aoSeguir}
              />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinela} className="feed-sentinela" aria-hidden="true" />
      {carregando && <p className="estado-carregando">Carregando…</p>}
      {acabou && itens.length > 0 && <p className="feed-fim">Você chegou ao fim.</p>}
        </>
      )}
    </section>
  );
}
