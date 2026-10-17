import { useEffect, useState } from "react";
import { usersApi } from "../api/social";
import { PersonCard } from "../components/PersonCard";
import type { UserCard } from "../types";
import "../components/PersonCard.css";
import "./PeopleSearchPage.css";

/**
 * Buscar pessoas por nome ou apelido (REQ-41/42) e segui-las (UC008). Sem
 * nada digitado, mostra as sugestões de quem seguir.
 */
export function PeopleSearchPage() {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<UserCard[] | null>(null);
  const [sugestoes, setSugestoes] = useState<UserCard[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    usersApi.suggestions().then(setSugestoes).catch(() => {});
  }, []);

  // Busca enquanto digita, com uma pausa de 300 ms para não disparar uma
  // request por tecla. A API pede pelo menos 2 letras.
  useEffect(() => {
    const q = termo.trim();
    if (q.length < 2) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      usersApi
        .search(q)
        .then((lista) => !cancelado && (setResultados(lista), setErro(null)))
        .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Erro na busca"));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [termo]);

  // Com menos de 2 letras não há busca: mostra as sugestões (o resultado
  // antigo fica guardado, mas não aparece).
  const buscando = termo.trim().length >= 2;

  const atualizar = (lista: UserCard[], nova: UserCard) =>
    lista.map((p) => (p.id === nova.id ? nova : p));

  return (
    <section className="busca-pessoas">
      <h2>Pessoas</h2>
      <input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar por nome ou @apelido"
        autoFocus
      />
      {erro && <p className="erro">{erro}</p>}

      {buscando && resultados !== null ? (
        resultados.length === 0 ? (
          <p className="campo-dica">Ninguém encontrado para “{termo.trim()}”.</p>
        ) : (
          <ul className="pessoas">
            {resultados.map((p) => (
              <PersonCard key={p.id} pessoa={p} aoMudar={(nova) => setResultados((l) => atualizar(l!, nova))} />
            ))}
          </ul>
        )
      ) : (
        sugestoes.length > 0 && (
          <>
            <h3 className="busca-subtitulo">Sugestões para seguir</h3>
            <ul className="pessoas">
              {sugestoes.map((p) => (
                <PersonCard key={p.id} pessoa={p} aoMudar={(nova) => setSugestoes((l) => atualizar(l, nova))} />
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
