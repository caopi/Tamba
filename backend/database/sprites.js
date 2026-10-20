// Recorta os sprites do tema retrô a partir das imagens originais (pasta
// peixes/ da raiz, só local, como os originais das fotos da equipe):
//
//   npm run sprites  -> frontend/src/styles/retro/sprites/*.png
//
// Todas as imagens são geradas por IA (declaradas em /creditos): "pixel art"
// desenhada em alta resolução, sobre um cinza quase liso, sem uma grade de
// pixel exata (não dá para só "voltar à resolução nativa") e, nas .jfif, com
// o ruído do JPEG (±12 no fundo). O que o script faz:
//   1. separa desenho de fundo pela distância de cor até o cinza da borda
//      (mediana; o limiar fica bem acima do ruído do JPEG);
//   2. acha cada desenho: faixas de linhas com desenho, e dentro de cada uma
//      as colunas — funciona para fileira e para grade;
//   3. reduz por um fator inteiro: cada pixel de saída é opaco ou
//      transparente (opaco se mais da metade dos pixels de origem era
//      desenho) e a cor é a média SÓ dos pixels de desenho. O cinza nunca
//      entra na conta da cor da borda — é isso que causaria o halo — e não
//      sobra pixel semitransparente;
//   4. animação: cada quadro vai para uma célula do mesmo tamanho, com a
//      CABEÇA PRESA no lugar — o deslocamento de cada quadro é o que melhor
//      sobrepõe a cabeça dele à do primeiro (busca de ±N pixels). Desenho de
//      IA redesenha a cabeça a cada quadro; sem isso o corpo treme.
//
// No fim, imprime as medidas que o CSS usa e duas conferências: pixels de
// borda com cor perto do cinza (halo) e, nas animações, quanto a cabeça ainda
// muda de um quadro para o outro.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGEM = path.join(RAIZ, "peixes");
const DESTINO = path.join(RAIZ, "frontend/src/styles/retro/sprites");
const LIMIAR = 36; // distância de cor (soma dos canais) a partir da qual é desenho

async function ler(arquivo) {
  const { data, info } = await sharp(path.join(ORIGEM, arquivo)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // Fundo: mediana da borda de cima e de baixo (robusta ao ruído do JPEG).
  const amostras = [];
  for (let x = 0; x < W; x += 2) for (const y of [1, H - 2]) amostras.push((y * W + x) * 3);
  const fundo = [0, 1, 2].map((c) => {
    const v = amostras.map((o) => data[o + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const mascara = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 3;
    mascara[i] = Math.abs(data[o] - fundo[0]) + Math.abs(data[o + 1] - fundo[1]) + Math.abs(data[o + 2] - fundo[2]) > LIMIAR ? 1 : 0;
  }
  return { data, W, H, fundo, desenho: (x, y) => x >= 0 && y >= 0 && x < W && y < H && mascara[y * W + x] === 1 };
}

/**
 * Segmentos [ini, fim] de um vetor booleano, ignorando os menores que `min`.
 * Vãos menores que `juntar` não separam: o sino tem traços de "balanço" soltos
 * do lado, e a lista tem bolinhas separadas das barras — continuam um desenho só.
 */
function segmentos(tem, min, juntar = 1) {
  const brutos = [];
  let ini = -1;
  for (let i = 0; i <= tem.length; i++) {
    if (i < tem.length && tem[i]) { if (ini < 0) ini = i; }
    else if (ini >= 0) { brutos.push([ini, i - 1]); ini = -1; }
  }
  const unidos = [];
  for (const seg of brutos) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && seg[0] - ultimo[1] - 1 < juntar) ultimo[1] = seg[1];
    else unidos.push([...seg]);
  }
  return unidos.filter(([a, b]) => b - a + 1 >= min);
}

/** Caixas dos desenhos, em ordem de leitura (faixas de linhas, depois colunas). */
function caixas(img, juntar = 70, juntarLinhas = 40) {
  const { W, H, desenho } = img;
  const linhas = Array.from({ length: H }, (_, y) => { for (let x = 0; x < W; x++) if (desenho(x, y)) return true; return false; });
  const lista = [];
  for (const [y0, y1] of segmentos(linhas, 20, juntarLinhas)) {
    const colunas = Array.from({ length: W }, (_, x) => { for (let y = y0; y <= y1; y++) if (desenho(x, y)) return true; return false; });
    for (const [x0, x1] of segmentos(colunas, 20, juntar)) {
      let topo = y1, base = y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (desenho(x, y)) { topo = Math.min(topo, y); base = Math.max(base, y); }
      lista.push({ x0, x1, y0: topo, y1: base });
    }
  }
  return lista;
}

/**
 * Reduz a região [x0, x0 + larg) × [y0, y0 + alt) da origem por `fator`.
 * Só conta como desenho o que está dentro de `limite` (a caixa do próprio
 * desenho): a célula pode ser maior que ele e não pode pegar o vizinho.
 */
function reduzir(img, x0, y0, larg, alt, fator, limite) {
  const { data, desenho } = img;
  const w = larg / fator, h = alt / fator;
  const saida = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let n = 0, r = 0, g = 0, b = 0;
      for (let yy = 0; yy < fator; yy++)
        for (let xx = 0; xx < fator; xx++) {
          const x = x0 + i * fator + xx, y = y0 + j * fator + yy;
          if (x < limite.x0 || x > limite.x1 || y < limite.y0 || y > limite.y1 || !desenho(x, y)) continue;
          const o = (y * img.W + x) * 3;
          r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
        }
      const o = (j * w + i) * 4;
      if (n * 2 > fator * fator) {
        saida[o] = Math.round(r / n); saida[o + 1] = Math.round(g / n); saida[o + 2] = Math.round(b / n); saida[o + 3] = 255;
      }
    }
  return { saida, w, h };
}

/** Pixels de borda (opacos encostados em transparente) com cor perto do cinza do fundo. */
function halo({ saida, w, h }, fundo) {
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : saida[(y * w + x) * 4 + 3]);
  let borda = 0, perto = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!a(x, y) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !a(x + dx, y + dy))) continue;
      borda++;
      const o = (y * w + x) * 4;
      if (Math.abs(saida[o] - fundo[0]) + Math.abs(saida[o + 1] - fundo[1]) + Math.abs(saida[o + 2] - fundo[2]) < 40) perto++;
    }
  return { borda, perto };
}

const arred = (v, fator) => Math.ceil(v / fator) * fator;

/** Imagens soltas numa fileira -> um PNG para cada, com os nomes dados (null pula). */
async function icones(arquivo, fator, nomes, juntar) {
  const img = await ler(arquivo);
  const lista = caixas(img, juntar);
  if (lista.length !== nomes.length) throw new Error(`${arquivo}: achei ${lista.length} desenhos, esperava ${nomes.length}`);
  const saidas = [];
  for (const [k, q] of lista.entries()) {
    if (!nomes[k]) continue; // desenho da folha que o app não usa
    const margem = fator;
    const larg = arred(q.x1 - q.x0 + 1 + 2 * margem, fator), alt = arred(q.y1 - q.y0 + 1 + 2 * margem, fator);
    const r = reduzir(img, q.x0 - margem, q.y0 - margem, larg, alt, fator, q);
    await writeFile(path.join(DESTINO, `${nomes[k]}.png`), await sharp(r.saida, { raw: { width: r.w, height: r.h, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer());
    const hl = halo(r, img.fundo);
    saidas.push(`${nomes[k]} ${r.w}×${r.h} (halo: ${hl.perto}/${hl.borda} px de borda)`);
  }
  return saidas;
}

/**
 * Folha de animação -> tira de quadros iguais, com a cabeça presa no lugar.
 * `cabeca`: fração da largura, a partir do focinho (o peixe olha para a
 * direita), que conta como cabeça. `quadros`: quais usar (índices), ou todos.
 */
async function animacao(arquivo, fator, nome, { cabeca = 0.35, busca = 14, quadros: escolha } = {}) {
  const img = await ler(arquivo);
  // Na grade de quadros os vãos são estreitos: só junta o que quase encosta.
  let lista = caixas(img, 6, 6);
  const total = lista.length;
  if (escolha) lista = escolha.map((i) => lista[i]);
  const ref = lista[0];
  const largRef = ref.x1 - ref.x0 + 1;
  const hx0 = Math.round(ref.x1 - largRef * cabeca);
  // Diferença da cabeça do quadro q (deslocado dx, dy) para a do quadro de referência.
  const custo = (q, dx, dy) => {
    let d = 0, n = 0;
    for (let y = ref.y0; y <= ref.y1; y += 2)
      for (let x = hx0; x <= ref.x1; x += 2) {
        const xq = x - ref.x1 + q.x1 + dx, yq = y - ref.y0 + q.y0 + dy;
        const a = img.desenho(x, y), b = img.desenho(xq, yq) && xq >= q.x0 && xq <= q.x1;
        if (!a && !b) continue;
        n++;
        if (a !== b) { d += 3; continue; }
        const o1 = (y * img.W + x) * 3, o2 = (yq * img.W + xq) * 3;
        d += Math.min(3, (Math.abs(img.data[o1] - img.data[o2]) + Math.abs(img.data[o1 + 1] - img.data[o2 + 1]) + Math.abs(img.data[o1 + 2] - img.data[o2 + 2])) / 40);
      }
    return d / n;
  };
  const deslocs = lista.map((q, k) => {
    if (k === 0) return { dx: 0, dy: 0 };
    let melhor = { c: Infinity, dx: 0, dy: 0 };
    for (let dy = -busca; dy <= busca; dy += 2)
      for (let dx = -busca; dx <= busca; dx += 2) {
        const c = custo(q, dx, dy);
        if (c < melhor.c) melhor = { c, dx, dy };
      }
    // refino de 1 px em volta do melhor
    for (let dy = melhor.dy - 1; dy <= melhor.dy + 1; dy++)
      for (let dx = melhor.dx - 1; dx <= melhor.dx + 1; dx++) {
        const c = custo(q, dx, dy);
        if (c < melhor.c) melhor = { c, dx, dy };
      }
    return melhor;
  });
  // Célula: cabe todo quadro na posição presa.
  const margem = fator;
  const esq = Math.min(...lista.map((q, k) => q.x0 - (q.x1 + deslocs[k].dx - ref.x1)));
  const cima = Math.min(...lista.map((q, k) => q.y0 - (q.y0 + deslocs[k].dy - ref.y0)));
  const baixo = Math.max(...lista.map((q, k) => q.y1 - (q.y0 + deslocs[k].dy - ref.y0)));
  const larg = arred(ref.x1 - esq + 1 + 2 * margem, fator), alt = arred(baixo - cima + 1 + 2 * margem, fator);
  const reduzidos = lista.map((q, k) => {
    // canto da célula na origem deste quadro: a cabeça (presa) cai sempre no mesmo lugar
    const ox = q.x1 + deslocs[k].dx + 1 + margem - larg;
    const oy = q.y0 + deslocs[k].dy + (cima - ref.y0) - margem;
    return reduzir(img, ox, oy, larg, alt, fator, q);
  });
  const { w, h } = reduzidos[0];
  const tira = await sharp({ create: { width: w * lista.length, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(reduzidos.map((q, k) => ({ input: q.saida, raw: { width: w, height: h, channels: 4 }, left: k * w, top: 0 })))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(DESTINO, `${nome}.png`), tira);
  // Conferência: quanto a cabeça (e a cauda) mudam de um quadro para o seguinte, já presos.
  const meio = Math.floor(w * (1 - cabeca));
  const muda = (A, B, xa, xb) => {
    let d = 0, n = 0;
    for (let y = 0; y < h; y++)
      for (let x = xa; x < xb; x++) {
        const o = (y * w + x) * 4;
        if (!A.saida[o + 3] && !B.saida[o + 3]) continue;
        n++;
        if (A.saida[o + 3] !== B.saida[o + 3] || Math.abs(A.saida[o] - B.saida[o]) + Math.abs(A.saida[o + 1] - B.saida[o + 1]) + Math.abs(A.saida[o + 2] - B.saida[o + 2]) > 60) d++;
      }
    return Math.round((100 * d) / n);
  };
  const cabecas = reduzidos.map((q, k) => muda(q, reduzidos[(k + 1) % reduzidos.length], meio, w));
  const caudas = reduzidos.map((q, k) => muda(q, reduzidos[(k + 1) % reduzidos.length], 0, Math.floor(w / 3)));
  const hl = reduzidos.reduce((s, r) => { const x = halo(r, img.fundo); return { borda: s.borda + x.borda, perto: s.perto + x.perto }; }, { borda: 0, perto: 0 });
  return { total, quadros: lista.length, w, h, bytes: tira.length, deslocs, cabecas, caudas, halo: hl };
}

await mkdir(DESTINO, { recursive: true });
const so = process.argv[2]; // opcional: "tambaqui", "icones", "cadeado"

if (!so || so === "cadeado") {
  const out = await icones("Cadeado Dourado em Pixel Art.png", 24, ["cadeado"]);
  console.log("cadeado:", out.join("; "));
}
if (!so || so === "icones") {
  // Barra de baixo: Dex, Registrar Captura, Feed, Notificações. O tambaqui
  // também vai para o topo e para o login.
  console.log("barra:", (await icones("icones principais.jfif", 20, ["barra-dex", "barra-registrar", "barra-feed", "barra-notificacoes"])).join("; "));
  console.log("feed:", (await icones("Icones Feed.jfif", 22, ["feed-curtir", "feed-curtido", "feed-comentar", "feed-compartilhar", "feed-moderar"], 16)).join("; "));
  // Botões de foto do formulário (Tirar foto, Galeria), localização (Usar
  // minha localização e a coordenada) e Configurações. Na folha da
  // engrenagem há também um lápis, que o app não usa (o Editar continua o da
  // Streamline).
  console.log("fotos:", (await icones("fotos.jfif", 33, ["foto-camera", "foto-galeria"])).join("; "));
  console.log("local:", (await icones("local.jfif", 37, ["local"])).join("; "));
  console.log("config:", (await icones("watermarked_img_3183725576981055292.jpg", 18, [null, "config"])).join("; "));
}
if (!so || so === "tambaqui") {
  const quadros = process.env.QUADROS ? process.env.QUADROS.split(",").map(Number) : undefined;
  const t = await animacao("Gemini_Generated_Image_1afeuq1afeuq1afe.jfif", Number(process.env.FATOR_PEIXE ?? 8), "tambaqui", { quadros });
  console.log(`tambaqui.png: ${t.quadros} de ${t.total} quadros, ${t.w}×${t.h} cada, ${Math.round(t.bytes / 1024)} KB; halo ${t.halo.perto}/${t.halo.borda} px de borda`);
  console.log("  deslocamento para prender a cabeça (px da origem):", t.deslocs.map((d) => `${d.dx},${d.dy}`).join(" "));
  console.log("  cabeça muda para o quadro seguinte (%):", t.cabecas.join(" "));
  console.log("  cauda muda para o quadro seguinte (%):", t.caudas.join(" "));
}
