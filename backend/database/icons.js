// Gera os ícones do app instalável (PWA) e o favicon em frontend/public/:
//
//   npm run icons  -> favicon.svg, icon-192.png, icon-512.png,
//                     icon-maskable-512.png e apple-touch-icon.png
//
// Fonte única: o tambaqui da barra (styles/retro/sprites/barra-dex.png, de
// npm run sprites) — o mesmo logo do topo e do login, então a aba do
// navegador e o app instalado mostram o mesmo peixe. Ganha o mesmo contorno
// de 1 pixel em madeira clara que tem sobre as barras escuras (senão o
// contorno escuro do desenho some no fundo escuro do ícone e nas abas
// escuras).
//
// - favicon.svg: um retângulo por pixel do desenho, então fica nítido em
//   qualquer tamanho que o navegador escolher;
// - PNGs: o desenho ampliado por fator inteiro (vizinho mais próximo), no
//   centro de um quadrado na madeira escura das barras (#3d2414, a mesma cor
//   do tema no manifesto). O maskable leva margem: o Android recorta o ícone
//   em círculo e só garante o círculo de 80% do meio — o canto mais distante
//   do peixe fica a ~192 px do centro, dentro dos 204,8 px.
//
// Os arquivos gerados ficam no git (o frontend não depende do sharp). Rode de
// novo depois de npm run sprites, se o tambaqui mudar.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_DIR = path.join(RAIZ, "frontend/public");
const SPRITE = path.join(RAIZ, "frontend/src/styles/retro/sprites/barra-dex.png");
const FUNDO = { r: 0x3d, g: 0x24, b: 0x14 }; // --madeira-800, a das barras
const CONTORNO = [0xcd, 0xa5, 0x7c]; // --madeira-300

/** O sprite com o contorno de 1 px (vizinhos de cima, baixo e lados), em RGBA. */
async function desenho() {
  const { data, info } = await sharp(SPRITE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width + 2, h = info.height + 2;
  const opaco = (x, y) => x >= 0 && y >= 0 && x < info.width && y < info.height && data[(y * info.width + x) * 4 + 3] > 0;
  const saida = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x - 1, sy = y - 1, o = (y * w + x) * 4;
      if (opaco(sx, sy)) {
        const i = (sy * info.width + sx) * 4;
        saida[o] = data[i]; saida[o + 1] = data[i + 1]; saida[o + 2] = data[i + 2]; saida[o + 3] = 255;
      } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => opaco(sx + dx, sy + dy))) {
        [saida[o], saida[o + 1], saida[o + 2]] = CONTORNO; saida[o + 3] = 255;
      }
    }
  return { saida, w, h };
}

/** SVG com um retângulo por trecho de pixels iguais numa linha, num quadrado. */
function svg({ saida, w, h }) {
  const lado = w; // quadrado: o peixe é mais largo que alto
  const y0 = Math.floor((lado - h) / 2);
  let rects = "";
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const o = (y * w + x) * 4;
      if (!saida[o + 3]) { x++; continue; }
      const cor = `#${[saida[o], saida[o + 1], saida[o + 2]].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
      let fim = x + 1;
      while (fim < w && saida[(y * w + fim) * 4 + 3] && `#${[0, 1, 2].map((c) => saida[(y * w + fim) * 4 + c].toString(16).padStart(2, "0")).join("")}` === cor) fim++;
      rects += `<rect x="${x}" y="${y + y0}" width="${fim - x}" height="1" fill="${cor}"/>`;
      x = fim;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">${rects}</svg>\n`;
}

async function png(nome, tamanho, fator, img) {
  const largura = img.w * fator, altura = img.h * fator;
  const peixe = await sharp(img.saida, { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(largura, altura, { kernel: "nearest" })
    .png()
    .toBuffer();
  const saida = await sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: { ...FUNDO, alpha: 1 } } })
    .composite([{ input: peixe, left: Math.floor((tamanho - largura) / 2), top: Math.floor((tamanho - altura) / 2) }])
    // Sem canal alfa: o fundo é opaco, e o iOS recusa transparência no apple-touch-icon.
    .removeAlpha()
    .png()
    .toBuffer();
  await writeFile(path.join(PUBLIC_DIR, nome), saida);
  return `${nome} (${fator}×)`;
}

const img = await desenho();
await writeFile(path.join(PUBLIC_DIR, "favicon.svg"), svg(img));
const feitos = [
  await png("icon-192.png", 192, 4, img),
  await png("icon-512.png", 512, 12, img),
  await png("icon-maskable-512.png", 512, 9, img),
  // O iOS arredonda os cantos sozinho e não aceita transparência.
  await png("apple-touch-icon.png", 180, 4, img),
];
console.log(`Ícones gerados em ${path.relative(process.cwd(), PUBLIC_DIR)}/: favicon.svg, ${feitos.join(", ")}`);
