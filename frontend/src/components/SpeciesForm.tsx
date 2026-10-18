import { useState, type FormEvent } from "react";
import { adminApi } from "../api/admin";
import { useAuth } from "../context/AuthContext";
import type { FishSpecies, Rarity, SpeciesInput } from "../types";
import "./SpeciesForm.css";

/**
 * Cadastro/edição de espécie do catálogo, para admin (UC010, RGN-16).
 * Sem `especie`, cria uma nova.
 *
 * - Raridade é obrigatória (RGN-11; no banco, o CHECK da migration 009).
 * - Faixas plausíveis em kg e cm, a unidade em que o catálogo é guardado —
 *   aqui não se converte para a preferência do admin, para não acumular erro
 *   de arredondamento a cada edição. Faixa vazia = sem faixa (nunca sinaliza).
 * - Não há "apagar": tirar do catálogo é desativar (RGN-17), fora daqui.
 */
const RARIDADES: { valor: Rarity; rotulo: string }[] = [
  { valor: "comum", rotulo: "Comum" },
  { valor: "incomum", rotulo: "Incomum" },
  { valor: "raro", rotulo: "Raro" },
  { valor: "muito_raro", rotulo: "Muito raro" },
];

const textoDe = (valor: number | null | undefined) => (valor == null ? "" : String(valor));

/** "" -> null; aceita vírgula decimal ("0,5"). NaN vira erro na API. */
const numeroOuNull = (texto: string) =>
  texto.trim() === "" ? null : Number(texto.trim().replace(",", "."));

/** Campo numérico com a unidade escrita dentro, à direita, para não ser esquecida. */
function CampoComUnidade(props: { rotulo: string; unidade: string; valor: string; mudar: (v: string) => void }) {
  return (
    <label>
      {props.rotulo} ({props.unidade})
      <span className="campo-unidade">
        <input inputMode="decimal" value={props.valor} onChange={(e) => props.mudar(e.target.value)} />
        <span aria-hidden="true">{props.unidade}</span>
      </span>
    </label>
  );
}

export function SpeciesForm({
  especie,
  aoSalvar,
  aoCancelar,
}: {
  especie?: FishSpecies;
  aoSalvar: (salva: FishSpecies) => void;
  aoCancelar: () => void;
}) {
  const [name, setName] = useState(especie?.name ?? "");
  const [scientificName, setScientificName] = useState(especie?.scientificName ?? "");
  const [habitat, setHabitat] = useState(especie?.habitat ?? "");
  const [baits, setBaits] = useState(especie?.recommendedBaits ?? "");
  const [rarity, setRarity] = useState<Rarity | "">(especie?.rarity ?? "");
  const [minWeight, setMinWeight] = useState(textoDe(especie?.minWeight));
  const [maxWeight, setMaxWeight] = useState(textoDe(especie?.maxWeight));
  const [minLength, setMinLength] = useState(textoDe(especie?.minLength));
  const [maxLength, setMaxLength] = useState(textoDe(especie?.maxLength));
  const imperial = useAuth().user?.measurementUnit === "lb";
  const [curiosities, setCuriosities] = useState(especie?.curiosities ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rarity) {
      setErro("Escolha a raridade");
      return;
    }
    const dados: SpeciesInput = {
      name: name.trim(),
      scientificName: scientificName.trim(),
      habitat: habitat.trim(),
      recommendedBaits: baits.trim() || null,
      rarity,
      minWeight: numeroOuNull(minWeight),
      maxWeight: numeroOuNull(maxWeight),
      minLength: numeroOuNull(minLength),
      maxLength: numeroOuNull(maxLength),
      curiosities: curiosities.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    try {
      const salva = especie
        ? await adminApi.updateSpecies(especie.id, dados)
        : await adminApi.createSpecies(dados);
      aoSalvar(salva);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a espécie");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="especie-form" onSubmit={salvar}>
      <label>
        Nome *
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
      </label>
      <label>
        Nome científico *
        <input value={scientificName} onChange={(e) => setScientificName(e.target.value)} required minLength={2} maxLength={180} />
      </label>
      <label>
        Raridade *
        <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)} required>
          <option value="" disabled>
            Escolha…
          </option>
          {RARIDADES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label>
        Habitat *
        <textarea rows={2} value={habitat} onChange={(e) => setHabitat(e.target.value)} required minLength={2} />
      </label>
      <label>
        Iscas recomendadas
        <input value={baits} onChange={(e) => setBaits(e.target.value)} maxLength={255} placeholder="massa, milho, minhoca" />
      </label>

      <p className="campo-dica">Faixa plausível — vazio = sem faixa. Sempre em kg e cm.</p>
      {imperial && (
        <p className="aviso">
          Seu app está em libras e polegadas, mas o catálogo é editado em <strong>quilos e centímetros</strong>.
        </p>
      )}
      <div className="especie-faixas">
        <CampoComUnidade rotulo="Peso mín." unidade="kg" valor={minWeight} mudar={setMinWeight} />
        <CampoComUnidade rotulo="Peso máx." unidade="kg" valor={maxWeight} mudar={setMaxWeight} />
        <CampoComUnidade rotulo="Compr. mín." unidade="cm" valor={minLength} mudar={setMinLength} />
        <CampoComUnidade rotulo="Compr. máx." unidade="cm" valor={maxLength} mudar={setMaxLength} />
      </div>

      <label>
        Curiosidades
        <textarea rows={3} value={curiosities} onChange={(e) => setCuriosities(e.target.value)} />
      </label>

      {erro && <p className="erro">{erro}</p>}
      <div className="especie-form-botoes">
        <button type="button" className="secundario" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : especie ? "Salvar alterações" : "Cadastrar espécie"}
        </button>
      </div>
    </form>
  );
}
