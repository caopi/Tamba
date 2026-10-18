import { useEffect, useMemo, useState } from "react";
import { dexApi } from "../api/species";
import { catchesApi } from "../api/catches";
import { RarityBadge } from "../components/RarityBadge";
import { formatarData } from "../format";
import { useUnidades } from "../units";
import { useAuth } from "../context/AuthContext";
import { adminApi } from "../api/admin";
import { SpeciesForm } from "../components/SpeciesForm";
import { SpeciesImage } from "../components/SpeciesImage";
import { PhotoCredit } from "../components/PhotoCredit";
import { Link } from "react-router-dom";
import type { Catch, Dex, DexSpecies } from "../types";
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

  const porcentagem = dex.total ? Math.round((dex.captured / dex.total) * 100) : 0;

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
            {dex.captured}/{dex.total} espécies capturadas
          </strong>
          <Link to="/creditos" className="dex-creditos">
            Créditos das fotos
          </Link>
        </div>

        <div
          className="dex-barra"
          role="progressbar"
          aria-valuenow={dex.captured}
          aria-valuemin={0}
          aria-valuemax={dex.total}
        >
          <div className="dex-barra-preenchida" style={{ width: `${porcentagem}%` }} />
        </div>
      </header>

      <ul className="dex-grade">
        {dex.species.map((especie) => {
          const recorde = recordes.get(especie.id);
          const classes = [
            "dex-card",
            !especie.captured && "bloqueado",
            especie.archived && "arquivada",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={especie.id}>
              <button type="button" className={classes} onClick={() => setSelecionada(especie)}>
                <div className="dex-figura">
                  <SpeciesImage especie={especie} bloqueada={!especie.captured} />
                  {!especie.captured && <span className="dex-cadeado">🔒</span>}
                </div>

                <h3>{especie.name}</h3>
                {/* Mostra o escopo: "Pseudoplatystoma spp." é o gênero inteiro. */}
                <span className="dex-card-cientifico" title={especie.scientificName}>
                  {especie.scientificName}
                </span>
                <RarityBadge rarity={especie.rarity} />
                <span className="dex-status">
                  {especie.archived && !especie.captured
                    ? "Desativada · só admin vê"
                    : especie.archived
                    ? "Arquivada · fora da contagem"
                    : recorde
                      ? `Recorde: ${unidades.peso(recorde.melhorPeso)}`
                      : "Ainda não capturado"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
              🔒 Você ainda não registrou nenhum <strong>{especie.name}</strong>.
            </p>
          )}
          </>
        )}
      </article>
    </div>
  );
}
