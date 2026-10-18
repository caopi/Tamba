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
 * No card da grade vai a miniatura (`imageThumbUrl`, ~400 px): nítida e leve.
 * A foto inteira só é baixada na ficha da espécie (e nas outras telas que
 * usam o tamanho "grande" ou "mini"). Sem miniatura, o card usa a inteira.
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
        <img
          src={(tamanho === "card" && especie.imageThumbUrl) || especie.imageUrl}
          alt={especie.name}
          loading="lazy"
        />
      ) : (
        <span className="especie-foto-vazia" aria-hidden="true">
          🐟
        </span>
      )}
    </div>
  );
}
