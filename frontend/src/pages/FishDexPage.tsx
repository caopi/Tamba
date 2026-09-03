import { useEffect, useMemo, useState } from "react";
import { speciesApi } from "../api/species";
import { catchesApi } from "../api/catches";
import type { Catch, FishSpecies } from "../types";
import "./FishDexPage.css";


// A "Dex": catalogo completo de especies, marcando as que o usuario ja pescou.
//O backend devolve o catalogo puro, quem cruza com as capturas eh esta tela.

export function FishDexPage() {
  const [especies, setEspecies] = useState<FishSpecies[]>([]);
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([speciesApi.list(), catchesApi.list()])
      .then(([especies, capturas]) => {
        setEspecies(especies);
        setCapturas(capturas);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const idsPescados = useMemo(
    () => new Set(capturas.map((c) => c.speciesId)),
    [capturas],
  );

  if (carregando) return <p>Carregando a Dex…</p>;
  if (erro) return <p className="erro">{erro}</p>;

  return (
    <section>
      <header className="dex-cabecalho">
        <h2>Fish Dex</h2>
        <p>
          {idsPescados.size} de {especies.length} espécies registradas
        </p>
      </header>

      <ul className="dex-grade">
        {especies.map((especie) => {
          const pescado = idsPescados.has(especie.id);
          return (
            <li key={especie.id} className={pescado ? "dex-card" : "dex-card bloqueado"}>
              {especie.imageUrl ? (
                <img src={especie.imageUrl} alt={especie.name} />
              ) : (
                <div className="dex-imagem-vazia">🐟</div>
              )}
              <h3>{especie.name}</h3>
              <p className="dex-cientifico">{especie.scientificName}</p>
              <p className="dex-habitat">{especie.habitat}</p>
              <span className="dex-status">{pescado ? "Registrado" : "Não pescado"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
