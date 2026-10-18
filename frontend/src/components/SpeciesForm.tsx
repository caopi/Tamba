import { useState, type ChangeEvent, type FormEvent } from "react";
import { adminApi } from "../api/admin";
import { uploadPhoto } from "../api/uploads";
import { compressImage } from "../imageCompression";
import { SpeciesImage } from "./SpeciesImage";
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
 * - Foto: enviada pelo upload comum (comprimida no aparelho), como as de
 *   captura. Trocar a foto exige autor e licença — foto de terceiros sem
 *   crédito viola a licença. As fotos do catálogo inicial vêm do repositório
 *   (seed); para o formulário, as duas são só uma URL.
 */
const RARIDADES: { valor: Rarity; rotulo: string }[] = [
  { valor: "comum", rotulo: "Comum" },
  { valor: "incomum", rotulo: "Incomum" },
  { valor: "raro", rotulo: "Raro" },
  { valor: "muito_raro", rotulo: "Muito raro" },
];

// Sugestões do campo de licença (aceita qualquer texto).
const LICENCAS = ["Todos os direitos reservados", "Domínio público", "CC0", "CC BY 4.0", "CC BY 3.0", "CC BY 2.0"];

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
  const [imageUrl, setImageUrl] = useState(especie?.imageUrl ?? null);
  const [imageCredit, setImageCredit] = useState(especie?.imageCredit ?? "");
  const [imageLicense, setImageLicense] = useState(especie?.imageLicense ?? "");
  const [imageSourceUrl, setImageSourceUrl] = useState(especie?.imageSourceUrl ?? "");
  const [imageCaption, setImageCaption] = useState(especie?.imageCaption ?? "");
  const [enviandoFoto, setEnviandoFoto] = useState<number | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  async function escolherFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setErroFoto(null);
    setEnviandoFoto(0);
    try {
      const enviada = await uploadPhoto(await compressImage(arquivo), setEnviandoFoto);
      setImageUrl(enviada.url);
      // Foto nova, crédito novo: o da foto anterior não vale para esta.
      setImageCredit("");
      setImageLicense("");
      setImageSourceUrl("");
      setImageCaption("");
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Não foi possível enviar a foto");
    } finally {
      setEnviandoFoto(null);
    }
  }

  function removerFoto() {
    setImageUrl(null);
    setImageCredit("");
    setImageLicense("");
    setImageSourceUrl("");
    setImageCaption("");
  }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rarity) {
      setErro("Escolha a raridade");
      return;
    }
    if (imageUrl && (!imageCredit.trim() || !imageLicense.trim())) {
      setErro("Informe o autor e a licença da foto");
      return;
    }
    const dados: SpeciesInput = {
      name: name.trim(),
      scientificName: scientificName.trim(),
      habitat: habitat.trim(),
      imageUrl,
      imageCredit: imageUrl ? imageCredit.trim() : null,
      imageLicense: imageUrl ? imageLicense.trim() : null,
      imageSourceUrl: imageUrl ? imageSourceUrl.trim() || null : null,
      imageCaption: imageUrl ? imageCaption.trim() || null : null,
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
      <fieldset className="especie-foto-campos">
        <legend>Foto</legend>
        <div className="especie-foto-linha">
          <SpeciesImage especie={{ name, imageUrl }} tamanho="mini" />
          <div className="especie-foto-acoes">
            <label className="botao-arquivo">
              {enviandoFoto !== null
                ? `Enviando… ${Math.round(enviandoFoto * 100)}%`
                : imageUrl
                  ? "Trocar foto"
                  : "Enviar foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={escolherFoto}
                disabled={enviandoFoto !== null}
                hidden
              />
            </label>
            {imageUrl && (
              <button type="button" className="link" onClick={removerFoto}>
                Remover foto
              </button>
            )}
          </div>
        </div>
        {erroFoto && <p className="campo-erro">{erroFoto}</p>}
        {imageUrl && (
          <>
            <p className="campo-dica">
              Foto de outra pessoa precisa de autor, licença e link da origem. Prefira domínio público, CC0 ou CC BY.
            </p>
            <label>
              Autor da foto *
              <input value={imageCredit} onChange={(e) => setImageCredit(e.target.value)} maxLength={255} required />
            </label>
            <label>
              Licença *
              <input
                value={imageLicense}
                onChange={(e) => setImageLicense(e.target.value)}
                maxLength={60}
                list="licencas-foto"
                required
              />
              <datalist id="licencas-foto">
                {LICENCAS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label>
              Link da origem
              <input
                type="url"
                value={imageSourceUrl}
                onChange={(e) => setImageSourceUrl(e.target.value)}
                maxLength={500}
                placeholder="https://commons.wikimedia.org/wiki/File:..."
              />
            </label>
            <label>
              Legenda
              <input
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                maxLength={300}
                placeholder="Na foto: Cichla piquiti (para espécie de gênero, spp.)"
              />
            </label>
          </>
        )}
      </fieldset>

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
        <button type="submit" disabled={salvando || enviandoFoto !== null}>
          {salvando ? "Salvando…" : especie ? "Salvar alterações" : "Cadastrar espécie"}
        </button>
      </div>
    </form>
  );
}
