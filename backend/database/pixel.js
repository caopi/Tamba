// Gera a versão pixel art (assets/species/pixel/<espécie>.png) de cada foto do
// catálogo em assets/species/. Rode com: npm run pixel (depois de trocar ou
// acrescentar uma foto). Os arquivos gerados entram no git, como as fotos.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ASSETS_DIR } from "../src/lib/storage.js";
import { pixelVariant } from "../src/lib/pixel.js";

const origem = path.join(ASSETS_DIR, "species");
const destino = path.join(origem, "pixel");

const fotos = (await readdir(origem)).filter((f) => f.endsWith(".webp"));
let bytes = 0;
for (const foto of fotos) {
  const png = await pixelVariant(await readFile(path.join(origem, foto)));
  await writeFile(path.join(destino, foto.replace(/\.webp$/, ".png")), png);
  bytes += png.length;
}
console.log(`${fotos.length} versões pixel em assets/species/pixel/ (${Math.round(bytes / 1024)} KB no total).`);
