import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { speciesApi, spotsApi } from "../api/species";
import { catchesApi } from "../api/catches";
import type { FishSpecies, FishingSpot } from "../types";
import "./LogCatchPage.css";

//Formulário de registro de uma captura
export function LogCatchPage() {
  const [especies, setEspecies] = useState<FishSpecies[]>([]);
  const [pesqueiros, setPesqueiros] = useState<FishingSpot[]>([]);

  const [speciesId, setSpeciesId] = useState("");
  const [spotId, setSpotId] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [caughtAt, setCaughtAt] = useState(() => new Date().toISOString().slice(0, 16));

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([speciesApi.list(), spotsApi.list()])
      .then(([especies, pesqueiros]) => {
        setEspecies(especies);
        setPesqueiros(pesqueiros);
      })
      .catch((e) => setErro(e.message));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await catchesApi.create({
        speciesId,
        // Campos opcionais vão como null quando o usuário não preenche
        spotId: spotId || null,
        weight: Number(weight),
        length: Number(length),
        photoUrl: photoUrl || null,
        caughtAt: new Date(caughtAt).toISOString(),
      });
      navigate("/perfil");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h2>Registrar captura</h2>

      <form className="captura-form" onSubmit={handleSubmit}>
        <label>
          Espécie
          <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} required>
            <option value="">Selecione…</option>
            {especies.map((especie) => (
              <option key={especie.id} value={especie.id}>
                {especie.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Pesqueiro (opcional)
          <select value={spotId} onChange={(e) => setSpotId(e.target.value)}>
            <option value="">Não informar</option>
            {pesqueiros.map((pesqueiro) => (
              <option key={pesqueiro.id} value={pesqueiro.id}>
                {pesqueiro.name} — {pesqueiro.location}
              </option>
            ))}
          </select>
        </label>

        <label>
          Peso (kg)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </label>

        <label>
          Comprimento (cm)
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            required
          />
        </label>

        <label>
          URL da foto (opcional)
          <input
            type="url"
            placeholder="https://…"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </label>

        <label>
          Quando pescou
          <input
            type="datetime-local"
            value={caughtAt}
            onChange={(e) => setCaughtAt(e.target.value)}
            required
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar captura"}
        </button>
      </form>
    </section>
  );
}
