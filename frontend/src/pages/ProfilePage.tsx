import { useEffect, useState } from "react";
import { catchesApi } from "../api/catches";
import { useAuth } from "../context/AuthContext";
import type { Catch } from "../types";
import "./ProfilePage.css";

const formatarData = (iso: string) => new Date(iso).toLocaleString("pt-BR");

// Perfil do usuario + historico de capturas + opçao excluir
export function ProfilePage() {
  const { user } = useAuth();
  const [capturas, setCapturas] = useState<Catch[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    catchesApi
      .list()
      .then(setCapturas)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  async function excluir(id: string) {
    if (!confirm("Excluir esta captura?")) return;

    try {
      await catchesApi.remove(id);
      setCapturas((atuais) => atuais.filter((c) => c.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir");
    }
  }

  const pesoTotal = capturas.reduce((soma, c) => soma + c.weight, 0);

  return (
    <section>
      <header className="perfil-cabecalho">
        <h2>{user?.name}</h2>
        <p>{user?.email}</p>
        <p>
          {capturas.length} capturas · {pesoTotal.toFixed(2)} kg no total
        </p>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p>Carregando histórico…</p>}
      {!carregando && capturas.length === 0 && <p>Nenhuma captura registrada ainda.</p>}

      <ul className="perfil-lista">
        {capturas.map((captura) => (
          <li key={captura.id} className="perfil-item">
            {captura.photoUrl && <img src={captura.photoUrl} alt={captura.species.name} />}

            <div className="perfil-item-dados">
              <strong>{captura.species.name}</strong>
              <span>
                {captura.weight} kg · {captura.length} cm
              </span>
              <span>{captura.spot ? captura.spot.name : "Local não informado"}</span>
              <span className="perfil-data">{formatarData(captura.caughtAt)}</span>
            </div>

            <button type="button" onClick={() => excluir(captura.id)}>
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
