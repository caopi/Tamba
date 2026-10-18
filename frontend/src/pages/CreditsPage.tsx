import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { speciesApi } from "../api/species";
import { PhotoCredit } from "../components/PhotoCredit";
import { SpeciesImage } from "../components/SpeciesImage";
import type { FishSpecies } from "../types";
import "./CreditsPage.css";

/**
 * Créditos de todas as fotos do catálogo, num lugar só (CC BY exige
 * atribuição). Pública, sem login: é o endereço citado no relatório. Lê do
 * banco, então inclui as fotos que um admin enviou pelo app; as do repositório
 * também estão no CREDITOS.md da raiz.
 */
export function CreditsPage() {
  const [especies, setEspecies] = useState<FishSpecies[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    speciesApi
      .list()
      .then(setEspecies)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os créditos"));
  }, []);

  const comFoto = especies?.filter((e) => e.imageUrl) ?? [];
  const semFoto = especies?.filter((e) => !e.imageUrl) ?? [];

  return (
    <main className="creditos">
      <Link to="/" className="creditos-voltar">
        ← Voltar ao Tamba
      </Link>
      <h1>Créditos das fotos</h1>
      <p className="creditos-intro">
        As fotos marcadas "Equipe Tamba" são da própria equipe, com todos os direitos reservados. As demais são de
        terceiros, usadas sob as licenças indicadas (domínio público, CC0 ou Creative Commons Atribuição). Cada foto
        foi conferida pelo nome científico da espécie; recortes e outras alterações estão no arquivo{" "}
        <code>CREDITOS.md</code> do repositório.
      </p>

      {erro && <p className="erro">{erro}</p>}
      {!especies && !erro && <p className="estado-carregando">Carregando…</p>}

      <ul className="creditos-lista">
        {comFoto.map((e) => (
          <li key={e.id}>
            <SpeciesImage especie={e} tamanho="mini" />
            <div>
              <strong>{e.name}</strong> <em>{e.scientificName}</em>
              <PhotoCredit especie={e} />
            </div>
          </li>
        ))}
      </ul>

      {semFoto.length > 0 && (
        <p className="creditos-sem-foto">
          Sem foto: {semFoto.map((e) => e.name).join(", ")}. Nenhuma foto livre com identificação confiável: os
          híbridos de piscicultura não têm, mostrar uma das espécies que os originam no lugar estaria errado, e o
          trairão é um grupo de espécies quase idênticas, sem registro brasileiro sólido.
        </p>
      )}
    </main>
  );
}
