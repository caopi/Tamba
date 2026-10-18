import type { FishSpecies } from "../types";
import "./SpeciesImage.css";

/**
 * Foto da espécie com o mesmo enquadramento em todo o app (grade da Dex,
 * ficha, créditos, formulário do admin).
 *
 * As fotos vêm de fontes diferentes — Commons, iNaturalist, upload do admin —
 * com ângulo, fundo e proporção diferentes. Em vez de esperar que combinem, o
 * CSS normaliza: moldura 3:2 fixa, `object-fit: cover`, mesmo fundo e a
 * mesma vinheta por cima. Sem foto, o 🐟 no lugar.
 *
 * `bloqueada`: espécie ainda não capturada. A "sombra" sai da própria foto,
 * por filtro, sem precisar de um segundo arquivo.
 *
 * No card da grade vão as duas versões da foto, a inteira e a pixel art
 * (`imageThumbUrl`), e o CSS mostra uma só: a inteira por padrão, a pixel no
 * tema retrô (styles/retro/retro.css). A escondida, com loading="lazy", nem
 * é baixada. A ficha e o resto do app usam sempre a foto inteira.
 */
export function SpeciesImage({
  especie,
  bloqueada = false,
  tamanho = "card",
}: {
  especie: Pick<FishSpecies, "name" | "imageUrl"> & Partial<Pick<FishSpecies, "imageThumbUrl">>;
  bloqueada?: boolean;
  tamanho?: "card" | "grande" | "mini";
}) {
  const classes = ["especie-foto", `especie-foto-${tamanho}`, bloqueada && "bloqueada"].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {especie.imageUrl ? (
        <>
          <img className="especie-foto-inteira" src={especie.imageUrl} alt={especie.name} loading="lazy" />
          {tamanho === "card" && especie.imageThumbUrl && (
            <img className="especie-foto-pixel" src={especie.imageThumbUrl} alt={especie.name} loading="lazy" />
          )}
        </>
      ) : (
        <span className="especie-foto-vazia" aria-hidden="true">
          🐟
        </span>
      )}
    </div>
  );
}
