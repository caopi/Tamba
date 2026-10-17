import { useEffect, useMemo, useState } from "react";
import { speciesApi } from "../api/species";
import { catchesApi } from "../api/catches";
import type { Catch, FishSpecies } from "../types";
import "./FishDexPage.css";

/**
 * A "Dex": catálogo completo de espécies, marcando as que o usuário já pescou.
 * O backend devolve o catálogo puro e as capturas do usuário; quem cruza os dois
 * é esta tela — com 34 espécies não compensa um endpoint agregado só para isso.
 */

/** O que o usuário fez com uma espécie. Só existe para espécie já pescada. */
interface Recorde {
  total: number;
  /** Maior peso já registrado, em kg — o "recorde pessoal" da espécie. */
  melhorPeso: number;
  maiorComprimento: number;
  ultimaCaptura: string;
}

const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** 'massa, milho, minhoca' -> ['massa', 'milho', 'minhoca'] */
const separarIscas = (iscas: string | null) =>
  (iscas ?? "")
    .split(",")
    .map((isca) => isca.trim())
    .filter(Boolean);

export function FishDexPage() {
  const [especies, setEspecies] = useState<FishSpecies[]>([]);
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<FishSpecies | null>(null);

  useEffect(() => {
    Promise.all([speciesApi.list(), catchesApi.list()])
      .then(([especies, capturas]) => {
        setEspecies(especies);
        setCapturas(capturas);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar a Dex"))
      .finally(() => setCarregando(false));
  }, []);

  // Um passe pelas capturas monta o recorde de cada espécie pescada. A chave do
  // mapa é o id da espécie, então "já pescou?" é só um `.has()`.
  const recordes = useMemo(() => {
    const mapa = new Map<string, Recorde>();

    for (const captura of capturas) {
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
  if (erro) return <p className="erro">{erro}</p>;

  const pescadas = recordes.size;
  const porcentagem = especies.length ? Math.round((pescadas / especies.length) * 100) : 0;

  return (
    <section>
      <header className="dex-cabecalho">
        <div className="dex-titulo">
          <h2>Fish Dex</h2>
          <strong className="dex-contador">
            {pescadas}/{especies.length} espécies capturadas
          </strong>
        </div>

        <div
          className="dex-barra"
          role="progressbar"
          aria-valuenow={pescadas}
          aria-valuemin={0}
          aria-valuemax={especies.length}
        >
          <div className="dex-barra-preenchida" style={{ width: `${porcentagem}%` }} />
        </div>
      </header>

      <ul className="dex-grade">
        {especies.map((especie) => {
          const recorde = recordes.get(especie.id);

          return (
            <li key={especie.id}>
              <button
                type="button"
                className={recorde ? "dex-card" : "dex-card bloqueado"}
                onClick={() => setSelecionada(especie)}
              >
                <div className="dex-figura">
                  {especie.imageUrl ? (
                    <img src={especie.imageUrl} alt={especie.name} />
                  ) : (
                    <span className="dex-imagem-vazia">🐟</span>
                  )}
                  {!recorde && <span className="dex-cadeado">🔒</span>}
                </div>

                <h3>{especie.name}</h3>
                <span className="dex-status">
                  {recorde
                    ? `Recorde: ${recorde.melhorPeso.toFixed(2)} kg`
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
        />
      )}
    </section>
  );
}

/** Ficha da espécie, aberta ao clicar num card da grade. */
function DetalheEspecie({
  especie,
  recorde,
  aoFechar,
}: {
  especie: FishSpecies;
  recorde: Recorde | undefined;
  aoFechar: () => void;
}) {
  // Fechar no Esc: é o que se espera de qualquer modal.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const iscas = separarIscas(especie.recommendedBaits);

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

        <div className={recorde ? "dex-figura grande" : "dex-figura grande bloqueado"}>
          {especie.imageUrl ? (
            <img src={especie.imageUrl} alt={especie.name} />
          ) : (
            <span className="dex-imagem-vazia">🐟</span>
          )}
        </div>

        <h2>{especie.name}</h2>
        <p className="dex-cientifico">{especie.scientificName}</p>

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
        </dl>

        {recorde ? (
          <div className="dex-recorde">
            <h3>Seu recorde pessoal</h3>
            <div className="dex-recorde-numeros">
              <span>
                <strong>{recorde.melhorPeso.toFixed(2)} kg</strong>maior peso
              </span>
              <span>
                <strong>{recorde.maiorComprimento.toFixed(0)} cm</strong>maior tamanho
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
      </article>
    </div>
  );
}
