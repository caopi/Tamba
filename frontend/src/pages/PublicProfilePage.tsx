import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { usersApi } from "../api/social";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { CatchCard } from "../components/CatchCard";
import { FollowButton } from "../components/FollowButton";
import { formatarData } from "../format";
import type { Catch, PublicProfile } from "../types";
import "./PublicProfilePage.css";

/**
 * Perfil de outro usuário (REQ-31): seguidores, estatísticas e as capturas
 * visíveis dele (sem as ocultas — RGN-12; sem coordenada se ele não
 * compartilha — RGN-13). O próprio perfil é /perfil.
 */
export function PublicProfilePage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  // Tudo que veio da API fica marcado com o id do perfil: trocar de perfil
  // (ex.: clicar num seguidor) mostra "carregando" até chegar o novo, sem
  // precisar zerar o estado à mão.
  const [dados, setDados] = useState<{ id: string; perfil: PublicProfile; capturas: Catch[] } | null>(null);
  const [falha, setFalha] = useState<{ id: string; mensagem: string } | null>(null);
  const perfil = dados?.id === id ? dados.perfil : null;
  const capturas = dados?.id === id ? dados.capturas : [];
  const erro = falha?.id === id ? falha.mensagem : null;
  const setPerfil = (mudar: (p: PublicProfile) => PublicProfile) =>
    setDados((d) => d && { ...d, perfil: mudar(d.perfil) });
  const setCapturas = (mudar: (lista: Catch[]) => Catch[]) =>
    setDados((d) => d && { ...d, capturas: mudar(d.capturas) });

  useEffect(() => {
    if (id === user?.id) return;
    Promise.all([usersApi.profile(id), usersApi.catches(id)])
      .then(([p, lista]) => setDados({ id, perfil: p, capturas: lista }))
      .catch((e) => setFalha({ id, mensagem: e instanceof Error ? e.message : "Usuário não encontrado" }));
  }, [id, user?.id]);

  if (id === user?.id) return <Navigate to="/perfil" replace />;
  if (erro) {
    return (
      <section className="perfil-publico">
        <p className="erro">{erro}</p>
        <Link to="/pessoas">Buscar pessoas</Link>
      </section>
    );
  }
  if (!perfil) return <p className="estado-carregando">Carregando perfil…</p>;

  return (
    <section className="perfil-publico">
      <header className="perfil-publico-cabecalho">
        <Avatar name={perfil.name} avatarUrl={perfil.avatarUrl} tamanho={64} />
        <div className="perfil-publico-nome">
          <h2>{perfil.name}</h2>
          <p>@{perfil.nickname}</p>
          {perfil.createdAt && (
            <p className="campo-dica">No Tamba desde {formatarData(perfil.createdAt)}</p>
          )}
        </div>
        <FollowButton
          userId={perfil.id}
          seguindo={perfil.isFollowedByMe}
          aoMudar={(estado) => {
            setPerfil((p) => ({ ...p, isFollowedByMe: estado.following, followers: estado.followers }));
            setCapturas((lista) =>
              lista.map((c) => ({ ...c, author: { ...c.author, isFollowedByMe: estado.following } })),
            );
          }}
        />
      </header>

      <ul className="perfil-publico-numeros">
        <li>
          <strong>{perfil.followers}</strong> {perfil.followers === 1 ? "seguidor" : "seguidores"}
        </li>
        <li>
          <strong>{perfil.following}</strong> seguindo
        </li>
        <li>
          <strong>{perfil.stats.totalCatches}</strong>{" "}
          {perfil.stats.totalCatches === 1 ? "captura" : "capturas"}
        </li>
        <li>
          <strong>{perfil.stats.speciesCaptured}</strong> espécies
        </li>
        {perfil.stats.heaviestWeight !== null && (
          <li>
            maior: <strong>{perfil.stats.heaviestWeight.toLocaleString("pt-BR")} kg</strong>
          </li>
        )}
      </ul>

      {capturas.length === 0 ? (
        <p className="campo-dica">@{perfil.nickname} ainda não registrou capturas.</p>
      ) : (
        <ul className="perfil-publico-capturas">
          {capturas.map((c) => (
            <li key={c.id}>
              <CatchCard
                captura={c}
                mostrarSeguir={false}
                aoMudar={(nova) => setCapturas((lista) => lista.map((x) => (x.id === nova.id ? nova : x)))}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
