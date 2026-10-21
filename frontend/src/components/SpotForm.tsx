import { useState, type FormEvent } from "react";
import { adminApi } from "../api/admin";
import type { FishingSpot } from "../types";

/**
 * Cadastro/edição de pesqueiro, para admin, num diálogo. Sem `pesqueiro`, cria
 * um novo (com `sugestao` preenchendo o nome e a cidade digitados no
 * formulário de captura).
 *
 * Cidade e UF em campos separados: a API guarda "Cidade, UF", que vira a
 * região da captura, e com a UF numa lista não há formato para errar. Nome
 * repetido na mesma cidade volta 409 com a mensagem da API ("Já existe um
 * pesqueiro com esse nome nessa cidade"); em outra cidade, pode.
 * Não há "apagar": tirar da lista é desativar, fora daqui.
 */
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** "Atibaia, SP" -> ["Atibaia", "SP"]; sem UF reconhecível, a UF fica em branco. */
function separar(location: string): [string, string] {
  const i = location.lastIndexOf(",");
  const uf = i >= 0 ? location.slice(i + 1).trim().toUpperCase() : "";
  return UFS.includes(uf) ? [location.slice(0, i).trim(), uf] : [location.trim(), ""];
}

export function SpotForm({
  pesqueiro,
  sugestao,
  aoSalvar,
  aoCancelar,
}: {
  pesqueiro?: FishingSpot;
  sugestao?: { name: string; location: string };
  aoSalvar: (salvo: FishingSpot) => void;
  aoCancelar: () => void;
}) {
  const inicial = pesqueiro ?? sugestao;
  const [cidadeInicial, ufInicial] = separar(inicial?.location ?? "");
  const [nome, setNome] = useState(inicial?.name ?? "");
  const [cidade, setCidade] = useState(cidadeInicial);
  const [uf, setUf] = useState(ufInicial || "SP");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (nome.trim().length < 2) return setErro("Informe o nome do pesqueiro");
    if (!cidade.trim()) return setErro("Informe a cidade");
    if (cidade.includes(",")) return setErro("A cidade vai sem vírgula: a UF fica no campo ao lado");

    setErro(null);
    setSalvando(true);
    const dados = { name: nome.trim(), location: `${cidade.trim()}, ${uf}` };
    try {
      aoSalvar(pesqueiro ? await adminApi.updateSpot(pesqueiro.id, dados) : await adminApi.createSpot(dados));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o pesqueiro");
      setSalvando(false);
    }
  }

  const titulo = pesqueiro ? "Editar pesqueiro" : "Novo pesqueiro";
  return (
    <div className="dialogo-fundo" onClick={aoCancelar} onKeyDown={(e) => e.key === "Escape" && aoCancelar()}>
      <div
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pesqueiro"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="titulo-pesqueiro">{titulo}</h3>
        <form className="pesqueiro-form" onSubmit={salvar} noValidate>
          <label>
            Nome *
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={180} autoFocus />
          </label>
          <div className="pesqueiro-cidade">
            <label>
              Cidade *
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={110} />
            </label>
            <label>
              UF *
              <select value={uf} onChange={(e) => setUf(e.target.value)}>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          {pesqueiro && (
            <p className="campo-dica">
              As capturas já registradas neste pesqueiro passam a mostrar o nome e a cidade novos.
            </p>
          )}
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <div className="dialogo-botoes">
            <button type="button" className="secundario" onClick={aoCancelar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
