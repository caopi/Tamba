import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { speciesApi, spotsApi } from "../api/species";
import { catchesApi } from "../api/catches";
import { ApiError } from "../api/client";
import { useUnidades } from "../units";
import { PhotoPicker, type FotoItem } from "../components/PhotoPicker";
import type { CatchInput, FishSpecies, FishingSpot, OutOfRangeDetail } from "../types";
import "./LogCatchPage.css";

/**
 * Formulário de registro de uma captura.
 *
 * A espécie é escolhida por um <input list> ligado a um <datalist>: o navegador
 * já filtra enquanto o usuário digita, então a busca sai de graça, sem
 * biblioteca e sem componente novo. Como `fish_species.name` é UNIQUE, dá para
 * voltar do nome digitado para o id com segurança.
 *
 * Medida fora da faixa (RGN-08 / REQ-24): quem decide é a API. Se ela
 * responder 422 OUT_OF_RANGE, a tela guarda o que tentou enviar, abre a
 * confirmação e, se o usuário confirmar, reenvia o MESMO corpo com
 * `confirmOutOfRange: true` — a captura entra sinalizada para revisão.
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
    .replace(/[̀-ͯ]/g, "");
}

type Campo = "especie" | "weight" | "length" | "caughtAt" | "fotos";
type Erros = Partial<Record<Campo, string>>;

/** Tentativa recusada por medida fora da faixa, à espera da confirmação. */
interface ForaDaFaixa {
  corpo: CatchInput;
  especie: FishSpecies;
  detalhes: OutOfRangeDetail[];
}

export function LogCatchPage() {
  const [especies, setEspecies] = useState<FishSpecies[]>([]);
  const [pesqueiros, setPesqueiros] = useState<FishingSpot[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeEspecie, setNomeEspecie] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  // "" = nenhum pesqueiro do catálogo: o usuário digita local e região.
  const [spotId, setSpotId] = useState("");
  const [spotName, setSpotName] = useState("");
  const [region, setRegion] = useState("");
  const [caughtAt, setCaughtAt] = useState(hoje);
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  // O erro das fotos ("aguarde o envio", "alguma falhou") fica velho assim
  // que a lista muda — senão continuaria vermelho depois do reenvio dar certo.
  const atualizarFotos: typeof setFotos = (mudanca) => {
    setFotos(mudanca);
    setErros((atuais) => (atuais.fotos ? { ...atuais, fotos: undefined } : atuais));
  };
  const [notes, setNotes] = useState("");
  // Coordenada exata, opcional (RGN-13: os outros só a veem se o autor ligar
  // "compartilhar localização exata"; senão veem só a região).
  const [coordenada, setCoordenada] = useState<{ latitude: number; longitude: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      setErroLocal("Este navegador não informa a localização");
      return;
    }
    setLocalizando(true);
    setErroLocal(null);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setCoordenada({
          latitude: Number(posicao.coords.latitude.toFixed(6)),
          longitude: Number(posicao.coords.longitude.toFixed(6)),
        });
        setLocalizando(false);
      },
      () => {
        setErroLocal("Não foi possível obter a localização (permissão negada?)");
        setLocalizando(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [foraDaFaixa, setForaDaFaixa] = useState<ForaDaFaixa | null>(null);
  const navigate = useNavigate();
  const unidades = useUnidades();

  useEffect(() => {
    Promise.all([speciesApi.list(), spotsApi.list()])
      .then(([especies, pesqueiros]) => {
        setEspecies(especies);
        setPesqueiros(pesqueiros);
      })
      .catch((e) =>
        setErroGeral(e instanceof Error ? e.message : "Não foi possível carregar o formulário"),
      )
      .finally(() => setCarregando(false));
  }, []);

  // Nome digitado -> espécie do catálogo. A collation do banco é
  // accent-insensitive, mas a comparação aqui é no navegador: normalizamos
  // caixa e acento na mão para "matrinxa" achar "Matrinxã".
  const especieEscolhida = useMemo(
    () => especies.find((e) => normalizar(e.name) === normalizar(nomeEspecie)) ?? null,
    [especies, nomeEspecie],
  );
  const pesqueiroEscolhido = pesqueiros.find((p) => p.id === spotId) ?? null;

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

    // RGN-07: pelo menos uma foto. As fotos sobem assim que são escolhidas;
    // na hora de salvar, todas precisam ter terminado de subir.
    if (fotos.length === 0) {
      encontrados.fotos = "Adicione pelo menos uma foto";
    } else if (fotos.some((f) => f.status === "comprimindo" || f.status === "enviando")) {
      encontrados.fotos = "Aguarde o envio das fotos terminar";
    } else if (fotos.some((f) => f.status === "erro")) {
      encontrados.fotos = "Alguma foto não foi enviada: tente de novo ou remova";
    }

    return encontrados;
  }

  /** Envia; se a API recusar por faixa, guarda a tentativa e abre a confirmação. */
  async function enviar(corpo: CatchInput, especie: FishSpecies) {
    setErroGeral(null);
    setEnviando(true);
    try {
      await catchesApi.create(corpo);
      navigate("/perfil");
    } catch (e) {
      if (e instanceof ApiError && e.code === "OUT_OF_RANGE" && !corpo.confirmOutOfRange) {
        setForaDaFaixa({ corpo, especie, detalhes: e.details as OutOfRangeDetail[] });
      } else {
        setErroGeral(e instanceof Error ? e.message : "Não foi possível salvar a captura");
      }
    } finally {
      setEnviando(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErroGeral(null);

    const encontrados = validar();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    enviar(
      {
        speciesId: especieEscolhida!.id,
        // Com pesqueiro do catálogo, a API preenche a região pelo `location`
        // dele; sem, vale o que o usuário digitou.
        spotId: spotId || null,
        spotName: spotId ? null : spotName.trim() || null,
        region: spotId ? null : region.trim() || null,
        // Digitado na unidade do usuário; a API recebe sempre kg e cm.
        weight: unidades.pesoParaKg(Number(weight)),
        length: unidades.comprimentoParaCm(Number(length)),
        // A ordem da lista é a ordem das fotos: a primeira é a capa.
        photoUrls: fotos.map((f) => f.url!),
        notes: notes.trim() || null,
        latitude: coordenada?.latitude ?? null,
        longitude: coordenada?.longitude ?? null,
        // O <input type="date"> só dá o dia. Fixando meio-dia local, a conversão
        // para UTC não empurra o registro para o dia anterior ou seguinte.
        caughtAt: new Date(`${caughtAt}T12:00:00`).toISOString(),
      },
      especieEscolhida!,
    );
  }

  const faixaPeso = especieEscolhida
    ? unidades.faixaPeso(especieEscolhida.minWeight, especieEscolhida.maxWeight)
    : null;
  const faixaTamanho = especieEscolhida
    ? unidades.faixaComprimento(especieEscolhida.minLength, especieEscolhida.maxLength)
    : null;

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
            placeholder={carregando ? "Carregando espécies…" : "Digite para buscar…"}
            disabled={carregando}
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
            <span className="campo-dica">
              ✓ {especieEscolhida.scientificName}
              {(faixaPeso || faixaTamanho) &&
                ` · faixa esperada: ${[faixaPeso, faixaTamanho].filter(Boolean).join(", ")}`}
            </span>
          )}
        </label>

        <div className="captura-dupla">
          <label>
            Peso ({unidades.rotuloPeso}) *
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
            Comprimento ({unidades.rotuloComprimento}) *
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
          Pesqueiro
          <select value={spotId} onChange={(e) => setSpotId(e.target.value)} disabled={carregando}>
            <option value="">Outro lugar (digitar abaixo)</option>
            {pesqueiros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.location}
              </option>
            ))}
          </select>
        </label>

        {pesqueiroEscolhido ? (
          <p className="campo-dica">Região: {pesqueiroEscolhido.location} (vem do pesqueiro)</p>
        ) : (
          <div className="captura-dupla">
            <label>
              Local da pescaria
              <input
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                placeholder="Pesqueiro Recanto Azul"
                maxLength={180}
              />
            </label>
            <label>
              Cidade / região
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Salto, SP"
                maxLength={120}
              />
            </label>
          </div>
        )}

        <div className="captura-coordenada">
          {coordenada ? (
            <p className="campo-dica">
              📍 {coordenada.latitude}, {coordenada.longitude}{" "}
              <button type="button" className="link" onClick={() => setCoordenada(null)}>
                remover
              </button>
              <br />
              Só você vê a coordenada exata; os outros veem só a região, a menos que
              você ative "compartilhar localização exata" no perfil.
            </p>
          ) : (
            <button type="button" className="secundario" onClick={usarMinhaLocalizacao} disabled={localizando}>
              {localizando ? "Localizando…" : "📍 Usar minha localização atual (opcional)"}
            </button>
          )}
          {erroLocal && <span className="campo-erro">{erroLocal}</span>}
        </div>

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

        {/* <fieldset> e não <label>: dentro de um label, clicar em qualquer
            botão das miniaturas "clicaria" também o primeiro input. */}
        <fieldset className="captura-fotos">
          <legend>Fotos * (a primeira é a capa)</legend>
          <PhotoPicker fotos={fotos} setFotos={atualizarFotos} invalido={Boolean(erros.fotos)} />
          {erros.fotos && <span className="campo-erro">{erros.fotos}</span>}
        </fieldset>

        <label>
          Observações
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clima, isca, equipamento…"
            maxLength={2000}
          />
        </label>

        {erroGeral && <p className="erro">{erroGeral}</p>}

        <button type="submit" disabled={enviando || carregando}>
          {enviando ? "Salvando…" : "Salvar captura"}
        </button>
      </form>

      {foraDaFaixa && (
        <ConfirmacaoForaDaFaixa
          tentativa={foraDaFaixa}
          enviando={enviando}
          aoCorrigir={() => setForaDaFaixa(null)}
          aoConfirmar={() => {
            const { corpo, especie } = foraDaFaixa;
            setForaDaFaixa(null);
            enviar({ ...corpo, confirmOutOfRange: true }, especie);
          }}
        />
      )}
    </section>
  );
}

const NOMES_CAMPO = { weight: "peso", length: "comprimento" } as const;

/** Diálogo do RGN-08: a medida está fora da faixa plausível da espécie. */
function ConfirmacaoForaDaFaixa({
  tentativa,
  enviando,
  aoCorrigir,
  aoConfirmar,
}: {
  tentativa: ForaDaFaixa;
  enviando: boolean;
  aoCorrigir: () => void;
  aoConfirmar: () => void;
}) {
  const { corpo, especie, detalhes } = tentativa;
  // O corpo e a faixa vêm em kg/cm (da API); a tela mostra na unidade do usuário.
  const unidades = useUnidades();
  const valor = (d: OutOfRangeDetail) =>
    d.campo === "weight" ? unidades.peso(corpo.weight) : unidades.comprimento(corpo.length);
  const faixa = (d: OutOfRangeDetail) =>
    d.campo === "weight" ? unidades.faixaPeso(d.min, d.max) : unidades.faixaComprimento(d.min, d.max);

  return (
    <div className="captura-dialogo-fundo">
      <div className="captura-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="titulo-faixa">
        <h3 id="titulo-faixa">Confere essa medida?</h3>
        <ul>
          {detalhes.map((d) => (
            <li key={d.campo}>
              O {NOMES_CAMPO[d.campo]} informado,{" "}
              <strong>{valor(d)}</strong>, está fora da faixa plausível para{" "}
              <strong>{especie.name}</strong> ({faixa(d)}).
            </li>
          ))}
        </ul>
        <p className="campo-dica">
          Se o valor estiver certo, a captura é registrada normalmente e fica
          sinalizada para revisão. Se foi erro de digitação, corrija antes de salvar.
        </p>
        <div className="captura-dialogo-botoes">
          <button type="button" className="secundario" onClick={aoCorrigir} disabled={enviando}>
            Corrigir
          </button>
          <button type="button" onClick={aoConfirmar} disabled={enviando}>
            Está certo, registrar
          </button>
        </div>
      </div>
    </div>
  );
}
