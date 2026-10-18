import { useEffect, useMemo, useState } from "react";
import { catchesApi } from "../api/catches";
import { dexApi } from "../api/species";
import { useAuth } from "../context/AuthContext";
import { formatarData } from "../format";
import { useUnidades } from "../units";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import type { Catch, Dex, Stats } from "../types";
import "./ProfilePage.css";

/**
 * Perfil do usuário: dados da conta, números gerais e o histórico completo de
 * capturas, ordenável por data ou peso.
 *
 * Os números vêm da API (GET /dex/stats e GET /dex), que já aplicam as regras:
 * captura oculta pela moderação não conta (RGN-10) e espécie arquivada fica
 * fora do X/Y (REQ-09). O histórico mostra TODAS as capturas, inclusive as
 * ocultas, com o selo "em análise" — é assim que o usuário entende por que a
 * contagem caiu.
 */

type Coluna = "caughtAt" | "weight";
type Direcao = "asc" | "desc";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const unidades = useUnidades();
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dex, setDex] = useState<Dex | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Padrão: mais recente primeiro, igual à ordem que a API já devolve.
  const [coluna, setColuna] = useState<Coluna>("caughtAt");
  const [direcao, setDirecao] = useState<Direcao>("desc");

  function carregar() {
    return Promise.all([catchesApi.list(), dexApi.stats(), dexApi.get()]).then(
      ([capturas, stats, dex]) => {
        setCapturas(capturas);
        setStats(stats);
        setDex(dex);
      },
    );
  }

  useEffect(() => {
    carregar()
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar o perfil"))
      .finally(() => setCarregando(false));
  }, []);

  // O que a API não agrega: a espécie da maior captura e o peso acumulado.
  // Mesma regra dos números da API: só capturas visíveis.
  const extras = useMemo(() => {
    const visiveis = capturas.filter((c) => !c.isHidden);
    const maior = visiveis.reduce<Catch | null>(
      (recorde, c) => (!recorde || c.weight > recorde.weight ? c : recorde),
      null,
    );
    return {
      maior,
      pesoTotal: visiveis.reduce((soma, c) => soma + c.weight, 0),
      emAnalise: capturas.length - visiveis.length,
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
      // RGN-09: a API recalcula estatísticas e Dex na leitura; basta recarregar.
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir");
    }
  }

  return (
    <section>
      <header className="perfil-cabecalho">
        {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} tamanho={64} />}
        <div>
          <h2>{user?.name}</h2>
          <p>
            @{user?.nickname} · {user?.email}
          </p>
          {user && <p className="perfil-desde">Pescando desde {formatarData(user.createdAt)}</p>}
          <nav className="perfil-links">
            <Link to="/configuracoes">⚙ Configurações</Link>
            <Link to="/creditos">Créditos das fotos</Link>
            <button type="button" className="link" onClick={logout}>
              Sair
            </button>
          </nav>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="estado-carregando">Carregando histórico…</p>}

      {!carregando && stats && dex && (
        <>
          <ul className="perfil-numeros">
            <li>
              <strong>{stats.totalCatches}</strong>
              <span>{stats.totalCatches === 1 ? "captura" : "capturas"}</span>
            </li>
            <li>
              <strong>
                {dex.captured}
                <small>/{dex.total}</small>
              </strong>
              <span>espécies na Dex</span>
            </li>
            <li>
              <strong>
                {stats.heaviestWeight !== null ? unidades.peso(stats.heaviestWeight) : "—"}
              </strong>
              <span>
                {extras.maior ? `maior captura · ${extras.maior.species.name}` : "maior captura"}
              </span>
            </li>
            <li>
              <strong>{unidades.peso(extras.pesoTotal)}</strong>
              <span>peso acumulado</span>
            </li>
          </ul>

          {extras.emAnalise > 0 && (
            <p className="perfil-aviso-analise">
              {extras.emAnalise === 1
                ? "1 captura está em análise pela moderação e "
                : `${extras.emAnalise} capturas estão em análise pela moderação e `}
              não entra nas estatísticas nem na Dex até um administrador revisar.
            </p>
          )}

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
                    <tr key={captura.id} className={captura.isHidden ? "perfil-linha-oculta" : undefined}>
                      <td>
                        <div className="perfil-especie">
                          {/* photos[0] é a capa. */}
                          {captura.photos[0] && (
                            <img src={captura.photos[0].url} alt={captura.species.name} />
                          )}
                          {captura.photos.length > 1 && (
                            <span className="perfil-mais-fotos">+{captura.photos.length - 1}</span>
                          )}
                          <span>{captura.species.name}</span>
                          {captura.isHidden && (
                            <span
                              className="perfil-selo perfil-selo-analise"
                              title="Ocultada pela moderação até um administrador revisar. Não conta na Dex."
                            >
                              em análise
                            </span>
                          )}
                          {captura.isFlaggedForReview && (
                            <span
                              className="perfil-selo perfil-selo-faixa"
                              title="Peso ou comprimento fora da faixa plausível da espécie, confirmado por você."
                            >
                              fora da faixa
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatarData(captura.caughtAt)}</td>
                      <td>{unidades.peso(captura.weight)}</td>
                      <td>{unidades.comprimento(captura.length)}</td>
                      {/* spot é o pesqueiro do catálogo; spotName é o texto livre. */}
                      <td>
                        {captura.spot?.name ?? captura.spotName ?? (
                          <span className="perfil-vazio-celula">—</span>
                        )}
                        {captura.region && (
                          <div className="perfil-regiao">{captura.region}</div>
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
