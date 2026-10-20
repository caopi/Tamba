// Gera as versões reduzidas das fotos do catálogo (assets/species/*.webp):
//
//   npm run thumbs   -> assets/species/thumb/<espécie>.webp (~400 px, a que a
//                       grade da Dex usa; versionada no git, como as fotos)
//   npm run pixel    -> assets/species/pixel/<espécie>.png (96 px, do
//                       experimento pixel art; fora de uso e fora do git)
//
// Rode `npm run thumbs` depois de trocar ou acrescentar uma foto.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pixelVariant, thumbVariant } from "../src/lib/pixel.js";

// A mesma pasta do ASSETS_DIR do lib/storage.js, mas sem importá-lo: o
// storage exige as variáveis da API (PUBLIC_API_URL...), e este script roda
// sem .env.
const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");

const pixel = process.argv.includes("--pixel");
const origem = path.join(ASSETS_DIR, "species");
const destino = path.join(origem, pixel ? "pixel" : "thumb");
await mkdir(destino, { recursive: true });

const fotos = (await readdir(origem)).filter((f) => f.endsWith(".webp"));
let bytes = 0;
for (const foto of fotos) {
  const buffer = await readFile(path.join(origem, foto));
  const saida = pixel ? await pixelVariant(buffer) : await thumbVariant(buffer);
  await writeFile(path.join(destino, pixel ? foto.replace(/\.webp$/, ".png") : foto), saida);
  bytes += saida.length;
}
console.log(`${fotos.length} versões em ${path.relative(ASSETS_DIR, destino)}/ (${Math.round(bytes / 1024)} KB no total).`);
