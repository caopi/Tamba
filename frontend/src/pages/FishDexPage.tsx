import { useEffect, useMemo, useState } from "react";
import { dexApi } from "../api/species";
import { catchesApi } from "../api/catches";
import { RarityBadge } from "../components/RarityBadge";
import { Icone } from "../components/Icone";
import { formatarData } from "../format";
import { useUnidades } from "../units";
import { useAuth } from "../context/AuthContext";
import { adminApi } from "../api/admin";
import { SpeciesForm } from "../components/SpeciesForm";
import { SpeciesImage } from "../components/SpeciesImage";
import { PhotoCredit } from "../components/PhotoCredit";
import { Link, useSearchParams } from "react-router-dom";
import type { Catch, Dex, DexSpecies, Rarity } from "../types";
import "./FishDexPage.css";

/**
 * A "Dex": o catálogo com o que o usuário já pescou de cada espécie.
 *
 * O "capturada ou não" e o contador X/Y vêm prontos de GET /dex — é lá que
 * moram as regras (RGN-10: captura oculta não conta; REQ-09: espécie
 * arquivada fica fora do X e do Y). O recorde pessoal sai das capturas do
 * próprio usuário, cruzadas aqui.
 */

/** O que o usuário fez com uma espécie. Só existe para espécie já pescada. */
interface Recorde {
  total: number;
  /** Maior peso já registrado, em kg — o "recorde pessoal" da espécie. */
  melhorPeso: number;
  maiorComprimento: number;
  ultimaCaptura: string;
}

/** Ordem da grade: a mais rara primeiro. */
const PESO_RARIDADE: Record<Rarity, number> = { muito_raro: 0, raro: 1, incomum: 2, comum: 3 };

/**
 * Ordena a grade. Por raridade (padrão): da mais rara para a mais comum e,
 * dentro de cada uma, pelo nome; "nome": só alfabética, para achar um peixe
 * específico. Nos dois casos as desativadas (só o admin vê) vão para o fim.
 * O nome compara em português (acento não muda a ordem: Cará fica entre
 * Cachara e Carpa).
 */
function ordenar(especies: DexSpecies[], ordem: "raridade" | "nome") {
  const nome = (a: DexSpecies, b: DexSpecies) => a.name.localeCompare(b.name, "pt-BR");
  return [...especies].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      (ordem === "raridade" ? PESO_RARIDADE[a.rarity] - PESO_RARIDADE[b.rarity] : 0) ||
      nome(a, b),
  );
}

/** 'massa, milho, minhoca' -> ['massa', 'milho', 'minhoca'] */
const separarIscas = (iscas: string | null) =>
  (iscas ?? "")
    .split(",")
    .map((isca) => isca.trim())
    .filter(Boolean);

export function FishDexPage() {
  const [dex, setDex] = useState<Dex | null>(null);
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<DexSpecies | null>(null);
  const unidades = useUnidades();
  const { user } = useAuth();
  // UC010: o admin edita o catálogo daqui mesmo (não há área de admin).
  const ehAdmin = user?.role === "admin";
  const [criando, setCriando] = useState(false);
  // A ordem fica na URL (?ordem=nome), como a aba do Feed: sobrevive à
  // recarga e ao voltar da ficha.
  const [parametros, setParametros] = useSearchParams();
  const ordem = parametros.get("ordem") === "nome" ? "nome" : "raridade";
  const escolherOrdem = (nova: "raridade" | "nome") =>
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        if (nova === "raridade") novos.delete("ordem");
        else novos.set("ordem", nova);
        return novos;
      },
      { replace: true },
    );
  // "Ver Dex completa" (admin, aberta pelo Perfil): prévia em que toda espécie
  // aparece como pescada. Só na tela e só na URL (?previa=completa) — nada é
  // gravado, e a Dex de verdade (RGN-10: só conta captura válida) não muda.
  const previa = ehAdmin && parametros.get("previa") === "completa";
  const sairDaPrevia = () =>
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.delete("previa");
        return novos;
      },
      { replace: true },
    );

  useEffect(() => {
    Promise.all([dexApi.get(), catchesApi.list()])
      .then(([dex, capturas]) => {
        setDex(dex);
        setCapturas(capturas);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar a Dex"))
      .finally(() => setCarregando(false));
  }, []);

  /** Depois de uma ação de admin: recarrega a Dex e a ficha aberta. */
  async function recarregarDex() {
    const nova = await dexApi.get();
    setDex(nova);
    setSelecionada((atual) => (atual ? (nova.species.find((e) => e.id === atual.id) ?? null) : null));
  }

  // Um passe pelas capturas monta o recorde de cada espécie pescada. As
  // ocultas pela moderação ficam de fora, igual à contagem da Dex (RGN-10).
  const recordes = useMemo(() => {
    const mapa = new Map<string, Recorde>();

    for (const captura of capturas) {
      if (captura.isHidden) continue;
      const atual = mapa.get(captura.speciesId);

      mapa.set(captura.speciesId, {
        total: (atual?.total ?? 0) + 1,
        melhorPeso: Math.max(atual?.melhorPeso ?? 0, captura.weight),
        maiorComprimento: Math.max(atual?.maiorComprimento ?? 0, captura.length),
        // A API já devolve as capturas da mais recente para a mais antiga,
        // então a primeira que aparece de cada espécie é a última pescada.
        ultimaCaptura: atual?.ultimaCaptura ?? captura.caughtAt,
      });
    }

    return mapa;
  }, [capturas]);

  if (carregando) return <p className="estado-carregando">Carregando a Dex…</p>;
  if (erro || !dex) return <p className="erro">{erro ?? "Erro ao carregar a Dex"}</p>;

  // Na prévia, tudo como pescado: contador cheio, cards coloridos, sem cadeado.
  const capturadas = previa ? dex.total : dex.captured;
  const especiesDaTela = previa ? dex.species.map((e) => ({ ...e, captured: true })) : dex.species;
  const porcentagem = dex.total ? Math.round((capturadas / dex.total) * 100) : 0;
  const completa = dex.total > 0 && capturadas >= dex.total;

  return (
    <section>
      <header className="dex-cabecalho">
        <div className="dex-titulo">
          <h2>Fish Dex</h2>
          {ehAdmin && (
            <button type="button" className="secundario dex-nova" onClick={() => setCriando(true)}>
              + Nova espécie
            </button>
          )}
          <strong className="dex-contador">
            {capturadas}/{dex.total} espécies capturadas
          </strong>
        </div>

        {/* --progresso (0 a 1) é para o tema retrô, que arredonda a largura
            em blocos de pixel; a largura em % vale fora dele. */}
        <div
          className={completa ? "dex-barra dex-barra-completa" : "dex-barra"}
          role="progressbar"
          aria-label="Espécies capturadas"
          aria-valuenow={capturadas}
          aria-valuemin={0}
          aria-valuemax={dex.total}
        >
          <div
            className="dex-barra-preenchida"
            style={{ width: `${porcentagem}%`, "--progresso": porcentagem / 100 } as React.CSSProperties}
          />
        </div>

        <div className="feed-abas dex-ordem" role="group" aria-label="Ordem da Dex">
          <button
            type="button"
            className={ordem === "raridade" ? "feed-aba ativa" : "feed-aba"}
            aria-pressed={ordem === "raridade"}
            onClick={() => escolherOrdem("raridade")}
          >
            Raridade
          </button>
          <button
            type="button"
            className={ordem === "nome" ? "feed-aba ativa" : "feed-aba"}
            aria-pressed={ordem === "nome"}
            onClick={() => escolherOrdem("nome")}
          >
            A–Z
          </button>
        </div>
      </header>

      {previa && (
        <div className="aviso dex-previa" role="status">
          <span>
            <strong>Prévia da Dex completa</strong> — todas as espécies aparecem como pescadas. Só nesta tela: nada
            foi gravado e a sua Dex de verdade continua igual.
          </span>
          <button type="button" className="secundario" onClick={sairDaPrevia}>
            Sair da prévia
          </button>
        </div>
      )}

      <ul className="dex-grade">
        {ordenar(especiesDaTela, ordem).map((especie) => {
          const recorde = recordes.get(especie.id);
          const classes = [
            "dex-card",
            !especie.captured && "bloqueado",
            // A cor da raridade é a recompensa: só depois de pescada.
            especie.captured && `capturada-${especie.rarity}`,
            especie.archived && "arquivada",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={especie.id}>
              <button type="button" className={classes} onClick={() => setSelecionada(especie)}>
                <div className="dex-figura">
                  <SpeciesImage especie={especie} bloqueada={!especie.captured} />
                  {!especie.captured && (
                    <span className="dex-cadeado" aria-hidden="true">
                      <Icone nome="cadeado" padrao="🔒" />
                    </span>
                  )}
                </div>

                <h3>{especie.name}</h3>
                <RarityBadge rarity={especie.rarity} />
                <span className="dex-status">
                  {especie.archived && !especie.captured
                    ? "Desativada · só admin vê"
                    : especie.archived
                    ? "Arquivada · fora da contagem"
                    : recorde
                      ? `Recorde: ${unidades.peso(recorde.melhorPeso)}`
                      : previa
                        ? "Prévia"
                        : "Não capturado"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Texto sublinhado, como no Perfil — não botão: é referência, não ação. */}
      <p className="dex-creditos">
        <Link to="/creditos">Créditos das fotos</Link>
      </p>

      {selecionada && (
        <DetalheEspecie
          especie={selecionada}
          recorde={recordes.get(selecionada.id)}
          aoFechar={() => setSelecionada(null)}
          ehAdmin={ehAdmin}
          aoAtualizar={recarregarDex}
        />
      )}

      {criando && (
        <div className="dex-modal-fundo" onClick={() => setCriando(false)}>
          <article
            className="dex-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Nova espécie"
            onClick={(evento) => evento.stopPropagation()}
          >
            <h2>Nova espécie</h2>
            <SpeciesForm
              aoCancelar={() => setCriando(false)}
              aoSalvar={async () => {
                setCriando(false);
                await recarregarDex();
              }}
            />
          </article>
        </div>
      )}
    </section>
  );
}

/** Ficha da espécie, aberta ao clicar num card da grade. */
function DetalheEspecie({
  especie,
  recorde,
  aoFechar,
  ehAdmin,
  aoAtualizar,
}: {
  especie: DexSpecies;
  recorde: Recorde | undefined;
  aoFechar: () => void;
  ehAdmin: boolean;
  aoAtualizar: () => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [mudandoAtivo, setMudandoAtivo] = useState(false);
  const [erroAdmin, setErroAdmin] = useState<string | null>(null);

  /** RGN-17: tirar do catálogo é desativar; apagar não existe nesta tela. */
  async function alternarAtivo() {
    if (especie.isActive && !confirm(`Desativar ${especie.name}? Ela sai do catálogo e da contagem da Dex; as capturas antigas ficam.`)) {
      return;
    }
    setMudandoAtivo(true);
    setErroAdmin(null);
    try {
      await adminApi.setSpeciesActive(especie.id, !especie.isActive);
      await aoAtualizar();
    } catch (e) {
      setErroAdmin(e instanceof Error ? e.message : "Não foi possível alterar a espécie");
    } finally {
      setMudandoAtivo(false);
    }
  }

  // Fechar no Esc: é o que se espera de qualquer modal.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const iscas = separarIscas(especie.recommendedBaits);
  const unidades = useUnidades();
  const faixaPeso = unidades.faixaPeso(especie.minWeight, especie.maxWeight);
  const faixaTamanho = unidades.faixaComprimento(especie.minLength, especie.maxLength);

  return (
    // Clique no fundo escuro fecha; o clique dentro do cartão não sobe.
    <div className="dex-modal-fundo" onClick={aoFechar}>
      <article
        className="dex-modal"
        role="dialog"
        aria-modal="true"
        aria-label={especie.name}
        onClick={(evento) => evento.stopPropagation()}
      >
        <button type="button" className="dex-modal-fechar" onClick={aoFechar}>
          ✕
        </button>

        {/* Sem sombra na ficha: habitat, iscas e faixa são justamente o que
            se quer saber ANTES de pescar. A sombra é só da grade (progresso). */}
        <SpeciesImage especie={especie} tamanho="grande" />
        <PhotoCredit especie={especie} />

        <h2>{especie.name}</h2>
        <p className="dex-cientifico">{especie.scientificName}</p>
        <div className="dex-selos">
          <RarityBadge rarity={especie.rarity} />
          {especie.archived && <span className="dex-arquivada-selo">Arquivada</span>}
        </div>

        {especie.archived && (
          <p className="dex-arquivada-aviso">
            {especie.captured
              ? "Esta espécie saiu do catálogo. Suas capturas continuam aqui, mas ela não entra mais na contagem da Dex."
              : "Espécie desativada: fora do catálogo e da Dex dos usuários. Só administradores a veem aqui."}
          </p>
        )}

        {ehAdmin && !editando && (
          <div className="dex-admin">
            <span>🛡 Admin</span>
            <button type="button" className="secundario" onClick={() => setEditando(true)}>
              ✏️ Editar espécie
            </button>
            <button
              type="button"
              className={especie.isActive ? "perigo" : undefined}
              onClick={alternarAtivo}
              disabled={mudandoAtivo}
            >
              {especie.isActive ? "Desativar" : "Reativar"}
            </button>
            {erroAdmin && <span className="campo-erro">{erroAdmin}</span>}
          </div>
        )}

        {editando ? (
          <SpeciesForm
            especie={especie}
            aoCancelar={() => setEditando(false)}
            aoSalvar={async () => {
              setEditando(false);
              await aoAtualizar();
            }}
          />
        ) : (
          <>
          <dl className="dex-ficha">
            <dt>Habitat</dt>
            <dd>{especie.habitat}</dd>

            <dt>Iscas recomendadas</dt>
            <dd>
              {iscas.length === 0 ? (
                <span className="dex-vazio">Não informadas</span>
              ) : (
                <span className="dex-iscas">
                  {iscas.map((isca) => (
                    <span key={isca} className="dex-isca">
                      {isca}
                    </span>
                  ))}
                </span>
              )}
            </dd>

            <dt>Faixa plausível</dt>
            <dd>
              {faixaPeso || faixaTamanho ? (
                <>
                  {faixaPeso && <div>Peso: {faixaPeso}</div>}
                  {faixaTamanho && <div>Comprimento: {faixaTamanho}</div>}
                </>
              ) : (
                <span className="dex-vazio">Não cadastrada</span>
              )}
            </dd>

            {especie.curiosities && (
              <>
                <dt>Curiosidades</dt>
                <dd>{especie.curiosities}</dd>
              </>
            )}
          </dl>

          {recorde ? (
            <div className="dex-recorde">
              <h3>Seu recorde pessoal</h3>
              <div className="dex-recorde-numeros">
                <span>
                  <strong>{unidades.peso(recorde.melhorPeso)}</strong>maior peso
                </span>
                <span>
                  <strong>{unidades.comprimento(recorde.maiorComprimento)}</strong>maior tamanho
                </span>
                <span>
                  <strong>{recorde.total}</strong>
                  {recorde.total === 1 ? "captura" : "capturas"}
                </span>
              </div>
              <p className="dex-recorde-data">
                Última captura em {formatarData(recorde.ultimaCaptura)}
              </p>
            </div>
          ) : (
            <p className="dex-bloqueado-aviso">
              <Icone nome="cadeado" padrao="🔒" /> Você ainda não registrou nenhum <strong>{especie.name}</strong>.
            </p>
          )}
          </>
        )}
      </article>
    </div>
  );
}
