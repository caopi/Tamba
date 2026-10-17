import { useEffect, useMemo, useState } from "react";
import { catchesApi } from "../api/catches";
import { speciesApi } from "../api/species";
import { useAuth } from "../context/AuthContext";
import type { Catch } from "../types";
import "./ProfilePage.css";

/**
 * Perfil do usuário: dados da conta, números gerais e o histórico completo de
 * capturas, ordenável por data ou peso. As estatísticas saem do próprio
 * `GET /catches` — a lista já vem inteira, não vale um endpoint agregado.
 */

type Coluna = "caughtAt" | "weight";
type Direcao = "asc" | "desc";

const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export function ProfilePage() {
  const { user } = useAuth();
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [totalEspecies, setTotalEspecies] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Padrão: mais recente primeiro, igual à ordem que a API já devolve.
  const [coluna, setColuna] = useState<Coluna>("caughtAt");
  const [direcao, setDirecao] = useState<Direcao>("desc");

  useEffect(() => {
    // O catálogo entra só para o "X de 34 espécies" fazer sentido.
    Promise.all([catchesApi.list(), speciesApi.list()])
      .then(([capturas, especies]) => {
        setCapturas(capturas);
        setTotalEspecies(especies.length);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar o perfil"))
      .finally(() => setCarregando(false));
  }, []);

  const estatisticas = useMemo(() => {
    const especiesDistintas = new Set(capturas.map((c) => c.speciesId));
    const maior = capturas.reduce<Catch | null>(
      (recorde, c) => (!recorde || c.weight > recorde.weight ? c : recorde),
      null,
    );

    return {
      total: capturas.length,
      especies: especiesDistintas.size,
      pesoTotal: capturas.reduce((soma, c) => soma + c.weight, 0),
      maior,
    };
  }, [capturas]);

  const ordenadas = useMemo(() => {
    const sinal = direcao === "asc" ? 1 : -1;

    return [...capturas].sort((a, b) => {
      if (coluna === "weight") return (a.weight - b.weight) * sinal;
      return (
        (new Date(a.caughtAt).getTime() - new Date(b.caughtAt).getTime()) * sinal
      );
    });
  }, [capturas, coluna, direcao]);

  /** Clicar na mesma coluna inverte a ordem; em outra, começa decrescente. */
  function ordenarPor(nova: Coluna) {
    if (nova === coluna) {
      setDirecao((atual) => (atual === "asc" ? "desc" : "asc"));
    } else {
      setColuna(nova);
      setDirecao("desc");
    }
  }

  const seta = (dessa: Coluna) => (coluna !== dessa ? "" : direcao === "asc" ? " ▲" : " ▼");

  async function excluir(id: string) {
    if (!confirm("Excluir esta captura?")) return;

    try {
      await catchesApi.remove(id);
      setCapturas((atuais) => atuais.filter((c) => c.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir");
    }
  }

  return (
    <section>
      <header className="perfil-cabecalho">
        <div className="perfil-avatar" aria-hidden="true">
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          {user && <p className="perfil-desde">Pescando desde {formatarData(user.createdAt)}</p>}
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="estado-carregando">Carregando histórico…</p>}

      {!carregando && (
        <>
          <ul className="perfil-numeros">
            <li>
              <strong>{estatisticas.total}</strong>
              <span>{estatisticas.total === 1 ? "captura" : "capturas"}</span>
            </li>
            <li>
              <strong>
                {estatisticas.especies}
                <small>/{totalEspecies}</small>
              </strong>
              <span>espécies na Dex</span>
            </li>
            <li>
              <strong>
                {estatisticas.maior ? `${estatisticas.maior.weight.toFixed(2)} kg` : "—"}
              </strong>
              <span>
                {estatisticas.maior
                  ? `maior captura · ${estatisticas.maior.species.name}`
                  : "maior captura"}
              </span>
            </li>
            <li>
              <strong>{estatisticas.pesoTotal.toFixed(2)} kg</strong>
              <span>peso acumulado</span>
            </li>
          </ul>

          <h3 className="perfil-subtitulo">Histórico</h3>

          {capturas.length === 0 ? (
            <p className="perfil-vazio">
              Nenhuma captura registrada ainda. Registre a primeira e ela aparece aqui e
              na Dex.
            </p>
          ) : (
            <div className="perfil-tabela-rolagem">
              <table className="perfil-tabela">
                <thead>
                  <tr>
                    <th scope="col">Espécie</th>
                    <th scope="col">
                      {/* Ordenação: só data e peso, que é o que pediram. */}
                      <button type="button" onClick={() => ordenarPor("caughtAt")}>
                        Data{seta("caughtAt")}
                      </button>
                    </th>
                    <th scope="col">
                      <button type="button" onClick={() => ordenarPor("weight")}>
                        Peso{seta("weight")}
                      </button>
                    </th>
                    <th scope="col">Comprimento</th>
                    <th scope="col">Local</th>
                    <th scope="col">
                      <span className="perfil-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ordenadas.map((captura) => (
                    <tr key={captura.id}>
                      <td>
                        <div className="perfil-especie">
                          {captura.photoUrl && (
                            <img src={captura.photoUrl} alt={captura.species.name} />
                          )}
                          <span>{captura.species.name}</span>
                        </div>
                      </td>
                      <td>{formatarData(captura.caughtAt)}</td>
                      <td>{captura.weight.toFixed(2)} kg</td>
                      <td>{captura.length.toFixed(0)} cm</td>
                      {/* spot é o pesqueiro do catálogo; spotName é o texto livre. */}
                      <td>
                        {captura.spot?.name ?? captura.spotName ?? (
                          <span className="perfil-vazio-celula">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="perfil-excluir"
                          onClick={() => excluir(captura.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
