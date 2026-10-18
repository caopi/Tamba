// Gera o CREDITOS.md da raiz a partir de species-images.js: a lista de
// créditos das fotos do catálogo, para citar no relatório. Rode com:
// npm run credits (depois de trocar ou acrescentar uma foto).
//
// Não precisa de banco. As fotos que um admin envia pelo app ficam só no
// banco; essas aparecem na tela /creditos, que lê da API.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { speciesImages } from "./species-images.js";

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

const md = `# Créditos das fotos

Fotos do catálogo de espécies do Tamba, versionadas em \`backend/assets/species/\`.

- **Fotos da equipe** ("Equipe Tamba"): **todos os direitos reservados**. Não
  estão sob licença livre; o resto do repositório não dá permissão de uso
  delas. Os originais não estão no repositório: só o recorte no peixe, sem
  pessoas no quadro e sem metadados (sem a localização GPS dos pesqueiros).
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

- **Patinga, Pincachara e Cachapira** — híbridos de piscicultura. Não há foto
  confiável de nenhum, e usar a foto de uma das espécies que os originam, como
  se fosse o híbrido, estaria errado. O app mostra o ícone 🐟. (O Tambacu, também
  híbrido, tem foto da própria equipe.)
- **Piauçu** (*Megaleporinus macrocephalus*) — nenhuma foto livre em que a
  espécie esteja identificada de forma confiável.
- **Trairão** (*Hoplias lacerdae*) — o nome cobre um grupo de espécies quase
  idênticas, e as populações do Sul e do Uruguai costumam ser atribuídas a
  outras espécies do grupo. Não há registro brasileiro sólido com licença
  livre: os dois disponíveis são uma foto turva do Rio Grande do Sul e uma
  pilha de peixes. Melhor sem foto do que com uma identificação duvidosa.

As fotos que um administrador enviar pelo app não entram neste arquivo: ficam
no banco, com autor e licença obrigatórios, e aparecem na tela \`/creditos\`.
`;

const destino = fileURLToPath(new URL("../../CREDITOS.md", import.meta.url));
await writeFile(destino, md);
console.log(`CREDITOS.md gerado: ${linhas.length} fotos.`);
