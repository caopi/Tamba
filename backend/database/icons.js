// Gera os ícones do app instalável (PWA) em frontend/public/:
//
//   npm run icons  -> favicon.svg, icon-192.png, icon-512.png,
//                     icon-maskable-512.png e apple-touch-icon.png
//
// O desenho é um peixe em pixel art, no amarelo e no azul do tema retrô,
// descrito como uma grade de caracteres logo abaixo: mudar o ícone é editar
// a grade e rodar o comando de novo. Os arquivos gerados ficam no git (o
// frontend não depende do sharp).

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/public");

// Mesmas cores do retro.css: fundo --retro-700 (o das barras), peixe
// --retro-amarelo, com a barriga um tom abaixo (sombreado de 16 bits).
const COR = {
  fundo: "#1d2b73",
  A: "#ffd23f", // corpo
  B: "#e0a91f", // barriga
  O: "#060a1f", // olho e contorno
};

// 16 × 10, virado para a direita. "." é transparente.
const PEIXE = [
  "......OOOOO.....",
  "....OOAAAAAOO...",
  "O..OAAAAAAAAAO..",
  "OAOAAAAAAAAOAAO.",
  "OAAAAAAAAAAAAAAO",
  "OBBBBBBBBBBBBBBO",
  "OBOBBBBBBBBBBBO.",
  "O..OBBBBBBBBBO..",
  "....OOBBBBBOO...",
  "......OOOOO.....",
];

/**
 * SVG do ícone numa grade de `celulas` × `celulas`, com o peixe no centro.
 * Grade maior = peixe menor (o maskable precisa de margem: o Android corta o
 * ícone em círculo, gota ou quadrado, e só garante os 80% do meio).
 */
function svg(celulas) {
  const x0 = (celulas - PEIXE[0].length) / 2;
  const y0 = (celulas - PEIXE.length) / 2;
  const pixels = PEIXE.flatMap((linha, y) =>
    [...linha].map((c, x) =>
      c === "." ? "" : `<rect x="${x0 + x}" y="${y0 + y}" width="1" height="1" fill="${COR[c]}"/>`,
    ),
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${celulas} ${celulas}" shape-rendering="crispEdges">` +
    `<rect width="${celulas}" height="${celulas}" fill="${COR.fundo}"/>${pixels}</svg>`
  );
}

async function png(nome, celulas, tamanho) {
  const saida = await sharp(Buffer.from(svg(celulas)), { density: 72 * (tamanho / celulas) })
    .resize(tamanho, tamanho, { kernel: "nearest" })
    .png()
    .toBuffer();
  await writeFile(path.join(PUBLIC_DIR, nome), saida);
}

await writeFile(path.join(PUBLIC_DIR, "favicon.svg"), svg(18));
await png("icon-192.png", 20, 192);
await png("icon-512.png", 20, 512);
await png("icon-maskable-512.png", 28, 512);
// O iOS arredonda os cantos sozinho e não aceita transparência.
await png("apple-touch-icon.png", 20, 180);
console.log(`Ícones gerados em ${path.relative(process.cwd(), PUBLIC_DIR)}/`);
