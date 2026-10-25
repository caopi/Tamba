// Gera o CREDITOS.md da raiz a partir de species-images.js: a lista de
// créditos das fotos do catálogo, para citar no relatório. Rode com:
// npm run credits (depois de trocar ou acrescentar uma foto).
//
// Não precisa de banco. As fotos que um admin envia pelo app ficam só no
// banco; essas aparecem na tela /creditos, que lê da API.
//
// "Sem foto" segue a mesma regra da tela: espécie do catálogo sem entrada em
// speciesImages (no banco, sem image_url). Só o motivo de cada uma vem de
// speciesWithoutImage, e um motivo que não bate com as fotos é erro.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { especies } from "./species-catalog.js";
import { USO_AUTORIZADO, speciesImages, speciesWithoutImage } from "./species-images.js";

function licencaUrl(licenca) {
  const by = /^CC BY (\d\.\d)$/.exec(licenca);
  if (by) return `https://creativecommons.org/licenses/by/${by[1]}/deed.pt-br`;
  if (licenca === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0/deed.pt-br";
  return null;
}

// "|" quebraria a tabela do Markdown.
const celula = (texto) => String(texto).replaceAll("|", "\\|");

const linhas = Object.entries(speciesImages).map(([nome, f]) => {
  const url = licencaUrl(f.license);
  const licenca = url ? `[${f.license}](${url})` : f.license;
  const fonte = f.sourceUrl ? `[origem](${f.sourceUrl})` : "foto da equipe";
  const alteracoes = f.caption ? `${f.changes}. ${f.caption}` : f.changes;
  return `| ${celula(nome)} | *${celula(f.pictured)}* | ${celula(f.credit)} | ${licenca} | ${fonte} | ${celula(alteracoes)} |`;
});

const semFoto = especies.filter((e) => !speciesImages[e.name]).map((e) => e.name);
for (const nome of Object.keys(speciesWithoutImage)) {
  if (speciesImages[nome]) {
    throw new Error(`species-images.js: "${nome}" tem foto; tire-a de speciesWithoutImage`);
  }
  if (!semFoto.includes(nome)) {
    throw new Error(`species-images.js: "${nome}", em speciesWithoutImage, não é uma espécie do catálogo`);
  }
}
for (const nome of semFoto) {
  if (!speciesWithoutImage[nome]) {
    throw new Error(`species-images.js: "${nome}" não tem foto; diga o porquê em speciesWithoutImage`);
  }
}

const linhasSemFoto = especies
  .filter((e) => semFoto.includes(e.name))
  .map((e) => `- **${e.name}** (*${e.scientificName}*) — ${speciesWithoutImage[e.name]}`);

const md = `# Créditos das fotos

Fotos do catálogo de espécies do Tamba, versionadas em \`backend/assets/species/\`.

- **Fotos da equipe** ("Equipe Tamba"): **todos os direitos reservados**. Não
  estão sob licença livre; o resto do repositório não dá permissão de uso
  delas. Os originais não estão no repositório: só o recorte no peixe, sem
  pessoas no quadro e sem metadados (sem a localização GPS dos pesqueiros).
- **Fotos cedidas por pescadores** ("${USO_AUTORIZADO}"): o autor deu
  permissão por escrito para o Tamba usar a foto. Também **não** são licença
  livre: a permissão vale para o app, não para quem reaproveitar o
  repositório. Recortadas no peixe, como as da equipe, e sem metadados.
- **Fotos de terceiros**: usadas sob as licenças indicadas — domínio público,
  CC0 ou Creative Commons Atribuição (CC BY), que permite usar e adaptar desde
  que se credite o autor, se indique a licença e se diga o que foi alterado.

**Gerado por \`npm run credits\` (em \`backend/\`) a partir de
\`backend/database/species-images.js\`. Não edite à mão.**

Cada foto foi escolhida e conferida pelo **nome científico** (categoria do
Wikimedia Commons ou observação "research grade" do iNaturalist), nunca pelo
nome popular. A coluna "Na foto" diz qual espécie aparece; nas entradas de
gênero ("spp.") é uma espécie do gênero.

| Espécie | Na foto | Autor | Licença | Fonte | Alterações e observações |
| --- | --- | --- | --- | --- | --- |
${linhas.join("\n")}

## Sem foto

O app mostra o ícone 🐟 no lugar da foto.

${linhasSemFoto.join("\n")}

As fotos que um administrador enviar pelo app não entram neste arquivo: ficam
no banco, com autor e licença obrigatórios, e aparecem na tela \`/creditos\`.

## Tema retrô

- **Cena de fundo** (\`frontend/src/styles/retro/parallax/\`): "Parallax
  Backgrounds: Dock", de **Admurin** —
  [página do pacote](https://admurin.itch.io/parallax-backgrounds-dock) ·
  [perfil no itch.io](https://admurin.itch.io/). Os termos de uso da página
  estão copiados em \`parallax/LICENCA.md\` (por eles o crédito é opcional;
  damos mesmo assim). Alterações: nenhum pixel editado; o app só amplia as
  camadas por um fator inteiro e as desloca no parallax.
- **Ícones** (\`frontend/src/styles/retro/icones/\`; dois: denunciar e
  editar): "Pixel - Free", da **Streamline** —
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt-br) —
  [origem](https://www.streamlinehq.com/icons/pixel). Alterações: redesenhados
  por \`backend/database/pixel-icons.js\` (\`npm run pixel-icons\`) — o
  desenho, uma grade de 21 × 21 num viewBox de 32, passou para coordenadas
  inteiras, o meio pixel de deslocamento de alguns foi alinhado à grade e a
  cor saiu (o CSS pinta na cor do tema). Detalhes em \`icones/LICENCA.md\`.
- **Sprites do tema** (\`frontend/src/styles/retro/sprites/\`): o tambaqui
  (no lugar da foto que falta, como logo — também no favicon e nos ícones do
  app instalável — e nadando na cena), o cadeado das espécies não pescadas,
  os ícones da barra de baixo e do topo (tambaqui, diário, lista, sino), os
  do feed (curtir, curtido, comentar, compartilhar, moderar) e os do
  formulário e do perfil (câmera, galeria, localização, configurações):
  imagens **geradas por inteligência artificial** (IA generativa)
  pela **Equipe Tamba** — todos os direitos reservados. Alterações: fundo
  cinza removido, quadros separados (do tambaqui, 8 dos 25, os de cabeça
  consistente) e alinhados pela cabeça, reduzidas a pixel art por
  \`backend/database/sprites.js\` (\`npm run sprites\`); os originais ficam fora
  do git.
- **Fontes**: Press Start 2P (CodeMan38) e Silkscreen (Jason Kottke), ambas
  sob a [SIL Open Font License 1.1](https://openfontlicense.org), carregadas
  do Google Fonts.

As miniaturas da grade da Dex (\`backend/assets/species/thumb/\`, geradas por
\`npm run thumbs\`) são as mesmas fotos reduzidas e seguem a licença e o
crédito de cada uma.
`;

const destino = fileURLToPath(new URL("../../CREDITOS.md", import.meta.url));
await writeFile(destino, md);
console.log(`CREDITOS.md gerado: ${linhas.length} fotos, ${semFoto.length} espécies sem foto.`);
