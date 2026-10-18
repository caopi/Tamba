// Versão "pixel art" de uma foto: pequena (96 px de largura) e com paleta
// reduzida, para a grade da Dex no tema retrô, onde é ampliada com
// `image-rendering: pixelated`. É uma imagem de verdade, não filtro de CSS:
// o pixel grande vem da resolução baixa, e a grade fica mais leve.
//
// Usada no build (database/pixel.js, fotos do repositório) e ao salvar a
// foto que um admin envia (species.service).

import sharp from "sharp";

export const LARGURA_PIXEL = 96;

/** Recebe a imagem (buffer) e devolve um PNG pequeno, de paleta, sem metadado. */
export function pixelVariant(buffer) {
  return sharp(buffer)
    .resize({ width: LARGURA_PIXEL })
    // Paleta de 48 cores e sem pontilhado: blocos de cor chapada, como em
    // jogo de 16 bits.
    .png({ palette: true, colors: 48, dither: 0 })
    .toBuffer();
}
