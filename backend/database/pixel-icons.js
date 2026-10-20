// Ícones pixel do tema retrô: "Pixel - Free", da Streamline (CC BY 4.0).
//
//   npm run pixel-icons  -> frontend/src/styles/retro/icones/px/<nome>.svg
//
// Os SVGs da Streamline têm viewBox de 32, mas o desenho é uma grade de
// 21 × 21 pixels (cada pixel mede 32/21 ≈ 1,524 unidade), e uma parte deles
// ainda vem deslocada meio pixel num dos eixos (desenho de largura ímpar
// centralizado). Em qualquer tamanho que não seja múltiplo de 21 px, ou com
// esse meio pixel, as bordas borram. Este script redesenha cada ícone usado
// na grade de 21 com coordenadas inteiras: lê o pixel no centro de cada
// célula (escolhendo, por eixo, o deslocamento — 0 ou meio pixel — em que as
// leituras caem dentro das células e não nas bordas) e grava um único path,
// sem cor própria: o CSS pinta pela máscara (ver retro.css, "Ícones").
//
// Os originais ficam em frontend/src/styles/retro/icones/ (baixados do site
// da Streamline). Só os usados entram no git: o script regrava o .gitignore
// daquela pasta com esta lista. Para usar mais um ícone, acrescente-o em
// ICONES e rode o comando de novo.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RETRO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/src/styles/retro");
const ORIGEM = path.join(RETRO, "icones");
const DESTINO = path.join(ORIGEM, "px");

// nome no app -> arquivo da Streamline (sem o sufixo "--Streamline-Pixel.svg")
const ICONES = {
  // Os únicos ainda usados: todo o resto virou sprite colorido (npm run
  // sprites). Estes dois não têm par nas folhas de sprites.
  denunciar: "Interface-Essential-Alert-Circle-2",
  lapis: "Interface-Essential-Pencil-Edit-2",
};

const GRADE = 21;
const ESCALA = 16; // px por célula na leitura
const arquivo = (nome) => `${nome}--Streamline-Pixel.svg`;

async function redesenhar(nome) {
  const lado = GRADE * ESCALA;
  const { data } = await sharp(path.join(ORIGEM, arquivo(nome)), { density: 72 * (lado / 32) })
    .resize(lado, lado)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alfa = (x, y) => data[(Math.min(lado - 1, Math.floor(y)) * lado + Math.min(lado - 1, Math.floor(x))) * 4 + 3];

  // Deslocamento por eixo: o que deixa menos leituras "no meio do caminho".
  const duvidas = (ox, oy) => {
    let n = 0;
    for (let j = 0; j < GRADE; j++)
      for (let i = 0; i < GRADE; i++) {
        const a = alfa((i + 0.5 + ox) * ESCALA, (j + 0.5 + oy) * ESCALA);
        if (a > 40 && a < 215) n++;
      }
    return n;
  };
  let melhor = { ox: 0, oy: 0, n: Infinity };
  for (const ox of [0, 0.5]) for (const oy of [0, 0.5]) {
    const n = duvidas(ox, oy);
    if (n < melhor.n) melhor = { ox, oy, n };
  }

  // Uma linha de células cheias vira um retângulo: "M x y h w v 1 h -w z".
  let d = "";
  for (let j = 0; j < GRADE; j++) {
    let inicio = -1;
    for (let i = 0; i <= GRADE; i++) {
      const cheio = i < GRADE && alfa((i + 0.5 + melhor.ox) * ESCALA, (j + 0.5 + melhor.oy) * ESCALA) >= 128;
      if (cheio && inicio < 0) inicio = i;
      if (!cheio && inicio >= 0) {
        d += `M${inicio} ${j}h${i - inicio}v1h-${i - inicio}z`;
        inicio = -1;
      }
    }
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRADE} ${GRADE}" shape-rendering="crispEdges"><path d="${d}"/></svg>\n`, duvidas: melhor.n };
}

await mkdir(DESTINO, { recursive: true });
for (const [nome, original] of Object.entries(ICONES)) {
  const { svg, duvidas } = await redesenhar(original);
  await writeFile(path.join(DESTINO, `${nome}.svg`), svg);
  if (duvidas) console.warn(`  ${nome}: ${duvidas} célula(s) ambígua(s) — confira o desenho`);
}

// Só os originais usados vão para o git.
await writeFile(
  path.join(ORIGEM, ".gitignore"),
  "# Gerado por npm run pixel-icons (backend): só os originais usados entram no git.\n/*.svg\n" +
    Object.values(ICONES).map((o) => `!/${arquivo(o)}\n`).join(""),
);
console.log(`${Object.keys(ICONES).length} ícones em ${path.relative(process.cwd(), DESTINO)}/`);
