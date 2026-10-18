// Versões reduzidas da foto da espécie, para a grade da Dex. A grade nunca
// carrega a foto inteira (até ~190 KB cada): usa uma destas, e a ficha da
// espécie é que abre a inteira.
//
// - thumbVariant: a usada hoje. ~400 px de largura, cor cheia, WebP — nítida
//   no card (que tem ~200 px, então 400 px cobre tela de alta densidade) e
//   leve.
// - pixelVariant: a do experimento "pixel art" (96 px, paleta de 48 cores,
//   para exibir com image-rendering: pixelated). Fora de uso, mas fica aqui,
//   barata, caso a ideia volte: `npm run pixel` gera de novo.
//
// Usadas no build (database/thumbs.js, fotos do repositório) e ao salvar a
// foto que um admin envia (species.service). Nenhuma leva metadado.

import sharp from "sharp";

export const LARGURA_MINIATURA = 400;
export const LARGURA_PIXEL = 96;

/** Miniatura nítida, em cor cheia: WebP de ~400 px de largura. */
export function thumbVariant(buffer) {
  return sharp(buffer)
    .resize({ width: LARGURA_MINIATURA, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();
}

/** Versão pixel art: PNG de 96 px com paleta de 48 cores, sem pontilhado. */
export function pixelVariant(buffer) {
  return sharp(buffer)
    .resize({ width: LARGURA_PIXEL })
    .png({ palette: true, colors: 48, dither: 0 })
    .toBuffer();
}
