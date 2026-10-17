import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { speciesApi } from "../api/species";
import { catchesApi } from "../api/catches";
import type { FishSpecies } from "../types";
import "./LogCatchPage.css";

/**
 * Formulário de registro de uma captura.
 *
 * A espécie é escolhida por um <input list> ligado a um <datalist>: o navegador
 * já filtra enquanto o usuário digita, então a busca sai de graça, sem
 * biblioteca e sem componente novo. Como `fish_species.name` é UNIQUE, dá para
 * voltar do nome digitado para o id com segurança.
 */

/** Data de hoje no formato que o <input type="date"> espera (aaaa-mm-dd). */
function hoje() {
  const agora = new Date();
  // toISOString() converteria para UTC e, de madrugada, cairia no dia anterior.
  return [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Tira caixa e acento para comparar o que foi digitado com o nome do catálogo. */
function normalizar(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Campo = "especie" | "weight" | "length" | "caughtAt" | "photoUrl";
type Erros = Partial<Record<Campo, string>>;

export function LogCatchPage() {
  const [especies, setEspecies] = useState<FishSpecies[]>([]);
  const [carregandoEspecies, setCarregandoEspecies] = useState(true);

  const [nomeEspecie, setNomeEspecie] = useState("");
  const [spotName, setSpotName] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [caughtAt, setCaughtAt] = useState(hoje);

  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    speciesApi
      .list()
      .then(setEspecies)
      .catch((e) =>
        setErroGeral(
          e instanceof Error ? e.message : "Não foi possível carregar as espécies",
        ),
      )
      .finally(() => setCarregandoEspecies(false));
  }, []);

  // Nome digitado -> espécie do catálogo. A collation do banco é
  // accent-insensitive, mas a comparação aqui é no navegador: normalizamos
  // caixa e acento na mão para "matrinxa" achar "Matrinxã".
  const especieEscolhida = useMemo(
    () => especies.find((e) => normalizar(e.name) === normalizar(nomeEspecie)) ?? null,
    [especies, nomeEspecie],
  );

  /** Valida tudo de uma vez e devolve os erros encontrados. */
  function validar(): Erros {
    const encontrados: Erros = {};

    if (!nomeEspecie.trim()) {
      encontrados.especie = "Escolha a espécie";
    } else if (!especieEscolhida) {
      encontrados.especie = "Espécie não encontrada no catálogo";
    }

    const peso = Number(weight);
    if (!weight.trim()) {
      encontrados.weight = "Informe o peso";
    } else if (!Number.isFinite(peso) || peso <= 0) {
      encontrados.weight = "O peso precisa ser maior que zero";
    }

    const comprimento = Number(length);
    if (!length.trim()) {
      encontrados.length = "Informe o comprimento";
    } else if (!Number.isFinite(comprimento) || comprimento <= 0) {
      encontrados.length = "O comprimento precisa ser maior que zero";
    }

    if (!caughtAt) {
      encontrados.caughtAt = "Informe a data";
    } else if (caughtAt > hoje()) {
      encontrados.caughtAt = "A data não pode estar no futuro";
    }

    // O backend exige URL válida (Zod .url()), então barramos aqui antes de mandar.
    if (photoUrl.trim() && !URL.canParse(photoUrl.trim())) {
      encontrados.photoUrl = "URL inválida (comece com https://)";
    }

    return encontrados;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErroGeral(null);

    const encontrados = validar();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      await catchesApi.create({
        speciesId: especieEscolhida!.id,
        // Texto livre por enquanto; o Google Places entra depois e preenche o spotId.
        spotName: spotName.trim() || null,
        weight: Number(weight),
        length: Number(length),
        photoUrl: photoUrl.trim() || null,
        // O <input type="date"> só dá o dia. Fixando meio-dia local, a conversão
        // para UTC não empurra o registro para o dia anterior ou seguinte.
        caughtAt: new Date(`${caughtAt}T12:00:00`).toISOString(),
      });
      navigate("/perfil");
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Não foi possível salvar a captura");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h2>Registrar captura</h2>
      <p className="captura-ajuda">
        Todo peixe registrado desbloqueia a espécie na sua Dex.
      </p>

      {/* noValidate: a validação é a nossa, para as mensagens saírem em português. */}
      <form className="captura-form" onSubmit={handleSubmit} noValidate>
        <label>
          Espécie *
          <input
            list="lista-especies"
            value={nomeEspecie}
            onChange={(e) => setNomeEspecie(e.target.value)}
            placeholder={
              carregandoEspecies ? "Carregando espécies…" : "Digite para buscar…"
            }
            disabled={carregandoEspecies}
            aria-invalid={Boolean(erros.especie)}
          />
          <datalist id="lista-especies">
            {especies.map((especie) => (
              <option key={especie.id} value={especie.name}>
                {especie.scientificName}
              </option>
            ))}
          </datalist>
          {erros.especie && <span className="campo-erro">{erros.especie}</span>}
          {especieEscolhida && (
            <span className="campo-dica">✓ {especieEscolhida.scientificName}</span>
          )}
        </label>

        <div className="captura-dupla">
          <label>
            Peso (kg) *
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="3.40"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-invalid={Boolean(erros.weight)}
            />
            {erros.weight && <span className="campo-erro">{erros.weight}</span>}
          </label>

          <label>
            Comprimento (cm) *
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder="52"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              aria-invalid={Boolean(erros.length)}
            />
            {erros.length && <span className="campo-erro">{erros.length}</span>}
          </label>
        </div>

        <label>
          Local da pescaria
          <input
            value={spotName}
            onChange={(e) => setSpotName(e.target.value)}
            placeholder="Pesqueiro Recanto Azul"
            maxLength={180}
          />
          <span className="campo-dica">
            Texto livre por enquanto — vira busca do Google Places depois.
          </span>
        </label>

        <label>
          Data da captura *
          <input
            type="date"
            value={caughtAt}
            max={hoje()}
            onChange={(e) => setCaughtAt(e.target.value)}
            aria-invalid={Boolean(erros.caughtAt)}
          />
          {erros.caughtAt && <span className="campo-erro">{erros.caughtAt}</span>}
        </label>

        <label>
          Foto (URL, opcional)
          <input
            type="url"
            placeholder="https://…"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            aria-invalid={Boolean(erros.photoUrl)}
          />
          {erros.photoUrl && <span className="campo-erro">{erros.photoUrl}</span>}
        </label>

        {photoUrl.trim() && !erros.photoUrl && (
          <img className="captura-previa" src={photoUrl.trim()} alt="Prévia da foto" />
        )}

        {erroGeral && <p className="erro">{erroGeral}</p>}

        <button type="submit" disabled={enviando || carregandoEspecies}>
          {enviando ? "Salvando…" : "Salvar captura"}
        </button>
      </form>
    </section>
  );
}
