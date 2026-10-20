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

      <h2 className="creditos-secao">Tema retrô</h2>
      <ul className="creditos-tema">
        <li>
          <strong>Cena de fundo</strong>: “Parallax Backgrounds: Dock”, de{" "}
          <a href="https://admurin.itch.io/" target="_blank" rel="noreferrer">
            Admurin
          </a>{" "}
          ·{" "}
          <a href="https://admurin.itch.io/parallax-backgrounds-dock" target="_blank" rel="noreferrer">
            página do pacote
          </a>
          . Sem edição: o app só amplia as camadas e as desloca no parallax.
        </li>
        <li>
          <strong>Ícones</strong> (denunciar e editar): “Pixel - Free”, da Streamline ·{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.pt-br" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>{" "}
          ·{" "}
          <a href="https://www.streamlinehq.com/icons/pixel" target="_blank" rel="noreferrer">
            origem
          </a>
          . Alterados: redesenhados numa grade de 21 pixels inteiros, com o meio pixel de deslocamento alinhado, e
          sem cor própria (pintados na cor do tema).
        </li>
        <li>
          <strong>Sprites do tema</strong> (o tambaqui — logo, favicon, ícone do app, sem foto e nadando na cena —, o
          cadeado e os ícones da barra, do topo, do feed, das fotos, da localização e das configurações): imagens{" "}
          <strong>geradas por inteligência artificial</strong> (IA generativa) pela Equipe Tamba · Todos os direitos
          reservados. Fundo removido, quadros separados e alinhados e reduzidos a pixel art pelo próprio projeto.
        </li>
        <li>
          <strong>Fontes</strong>: Press Start 2P (CodeMan38) e Silkscreen (Jason Kottke) ·{" "}
          <a href="https://openfontlicense.org" target="_blank" rel="noreferrer">
            SIL Open Font License 1.1
          </a>
          , via Google Fonts.
        </li>
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
