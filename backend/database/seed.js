// Popula o catálogo de espécies e alguns pesqueiros de exemplo.
// Rode com: npm run seed
//
// É idempotente: usa INSERT ... ON DUPLICATE KEY UPDATE com `name` como chave
// (UNIQUE em fish_species.name), então rodar de novo atualiza em vez de duplicar.
//
// ATENÇÃO ao revisar os dados abaixo: as linhas marcadas com "REVISAR" são as
// que não têm um nome científico único e indiscutível — híbridos de piscicultura
// (que não recebem nome binomial) e nomes populares que valem para um gênero
// inteiro ou mudam de região para região. Confira antes de usar como material
// da faculdade.

import { randomUUID } from "node:crypto";
import { pool, query } from "../src/lib/db.js";

// image_url fica NULL de propósito: as fotos entram depois.
const especies = [
  // --- Redondos (Serrasalmidae) ---
  {
    name: "Tambaqui",
    scientificName: "Colossoma macropomum",
    habitat: "Rios e lagos de água preta da bacia amazônica; comum em pesqueiros.",
    recommendedBaits: "massa, fruta, milho, ração",
  },
  // REVISAR: híbrido de piscicultura (fêmea de tambaqui x macho de pacu).
  // Híbrido não recebe nome binomial válido.
  {
    name: "Tambacu",
    scientificName: "Colossoma macropomum × Piaractus mesopotamicus",
    habitat: "Híbrido criado em piscicultura; encontrado quase só em pesqueiros.",
    recommendedBaits: "massa, milho, ração, minhoca",
  },
  // REVISAR: "pacu" é nome popular de vários Serrasalmidae. Aqui vai o
  // pacu-caranha, que é o comum em pesqueiro do Sudeste.
  {
    name: "Pacu",
    scientificName: "Piaractus mesopotamicus",
    habitat: "Rios da bacia do Prata e do Pantanal; muito criado em pesqueiros.",
    recommendedBaits: "massa, milho, fruta, minhoca",
  },
  // REVISAR: híbrido de piscicultura (pacu x pirapitinga).
  {
    name: "Patinga",
    scientificName: "Piaractus mesopotamicus × Piaractus brachypomus",
    habitat: "Híbrido de piscicultura, criado para pesqueiros e tanques.",
    recommendedBaits: "massa, milho, ração",
  },
  {
    name: "Piracanjuba",
    scientificName: "Brycon orbignyanus",
    habitat: "Rios de água corrente da bacia do Paraná; espécie ameaçada.",
    recommendedBaits: "fruta, massa, minhoca, milho",
  },
  {
    name: "Matrinxã",
    scientificName: "Brycon amazonicus",
    habitat: "Rios de água clara da bacia amazônica.",
    recommendedBaits: "fruta, massa, milho, minhoca",
  },
  {
    name: "Dourado",
    scientificName: "Salminus brasiliensis",
    habitat: "Corredeiras e rios de médio a grande porte; predador de superfície.",
    recommendedBaits: "isca artificial, lambari vivo, tuvira",
  },

  // --- Bagres e couros (Siluriformes) ---
  {
    name: "Pirarara",
    scientificName: "Phractocephalus hemioliopterus",
    habitat: "Fundo de rios grandes da Amazônia e do Araguaia-Tocantins.",
    recommendedBaits: "peixinho vivo, fígado, coração, tripa",
  },
  {
    name: "Pintado",
    scientificName: "Pseudoplatystoma corruscans",
    habitat: "Fundo de rios de água corrente das bacias do Prata e do São Francisco.",
    recommendedBaits: "lambari vivo, tripa, minhocuçu, fígado",
  },
  // REVISAR: "surubim" é nome regional guarda-chuva para o gênero
  // Pseudoplatystoma. Em MG/SP costuma designar o próprio pintado.
  {
    name: "Surubim",
    scientificName: "Pseudoplatystoma spp.",
    habitat: "Poços fundos e canais de rios; hábito noturno.",
    recommendedBaits: "lambari vivo, tripa, fígado",
  },
  // REVISAR: já foi classificada como Pseudoplatystoma fasciatum; hoje a da
  // bacia do Paraguai é P. reticulatum.
  {
    name: "Cachara",
    scientificName: "Pseudoplatystoma reticulatum",
    habitat: "Rios das bacias do Paraguai e do Amazonas; fundo e barrancos.",
    recommendedBaits: "lambari vivo, tripa, fígado",
  },
  // REVISAR: híbrido de piscicultura (pintado x cachara).
  {
    name: "Pincachara",
    scientificName: "Pseudoplatystoma corruscans × Pseudoplatystoma reticulatum",
    habitat: "Híbrido de piscicultura, muito usado para estocar pesqueiros.",
    recommendedBaits: "lambari vivo, tripa, fígado",
  },
  // REVISAR: híbrido (cachara x pirarara). Peixe recente em pesqueiro, com
  // pouca informação consolidada sobre iscas.
  {
    name: "Cachapira",
    scientificName: "Pseudoplatystoma reticulatum × Phractocephalus hemioliopterus",
    habitat: "Híbrido de piscicultura; resistente ao frio, criado para pesqueiros.",
    recommendedBaits: "peixinho vivo, fígado, tripa",
  },
  {
    name: "Piraíba",
    scientificName: "Brachyplatystoma filamentosum",
    habitat: "Calha de grandes rios amazônicos; maior bagre da América do Sul.",
    recommendedBaits: "peixe inteiro, tuvira, tripa",
  },
  {
    name: "Jundiá",
    scientificName: "Rhamdia quelen",
    habitat: "Remansos, açudes e riachos de fundo mole; hábito noturno.",
    recommendedBaits: "minhoca, tripa, fígado, peixinho",
  },
  {
    name: "Mandi (Mandi-amarelo)",
    scientificName: "Pimelodus maculatus",
    habitat: "Fundo de rios e represas; anda em cardume.",
    recommendedBaits: "minhoca, tripa, coração, massa",
  },
  // REVISAR: exótico (bagre-do-canal, do Mississippi), introduzido no Brasil
  // para piscicultura e muito solto em pesqueiro.
  {
    name: "Catfish",
    scientificName: "Ictalurus punctatus",
    habitat: "Exótico; criado em tanques e solto em pesqueiros.",
    recommendedBaits: "ração, fígado, coração de galinha, massa",
  },

  // --- Predadores de superfície e ciclídeos ---
  {
    name: "Pirarucu",
    scientificName: "Arapaima gigas",
    habitat: "Lagos e várzeas da Amazônia; respira ar na superfície.",
    recommendedBaits: "peixinho vivo, tripa",
  },
  // REVISAR: "tucunaré" cobre várias espécies do gênero Cichla. Em pesqueiro,
  // os comuns são C. kelberi e C. piquiti.
  {
    name: "Tucunaré",
    scientificName: "Cichla spp.",
    habitat: "Represas e lagos de água parada e quente; predador visual.",
    recommendedBaits: "isca artificial, lambari vivo",
  },
  {
    name: "Traíra",
    scientificName: "Hoplias malabaricus",
    habitat: "Brejos, lagoas e remansos rasos com vegetação.",
    recommendedBaits: "isca artificial, lambari vivo, minhoca",
  },
  {
    name: "Trairão",
    scientificName: "Hoplias lacerdae",
    habitat: "Rios e lagoas de água limpa; bem maior que a traíra comum.",
    recommendedBaits: "isca artificial, peixe vivo",
  },
  // REVISAR: exótico (largemouth bass), introduzido no Sul e Sudeste.
  {
    name: "Black Bass",
    scientificName: "Micropterus salmoides",
    habitat: "Exótico; represas e lagos de água mais fria do Sul e Sudeste.",
    recommendedBaits: "isca artificial, lambari vivo",
  },
  // REVISAR: "jacundá" vale para o gênero Crenicichla inteiro, não para uma
  // espécie só.
  {
    name: "Jacundá",
    scientificName: "Crenicichla spp.",
    habitat: "Margens com galhada e pedras em rios amazônicos e do Prata.",
    recommendedBaits: "isca artificial pequena, minhoca",
  },
  // REVISAR: "cará"/"acará" é nome genérico de vários ciclídeos; o mais comum
  // no Sudeste é o Geophagus brasiliensis.
  {
    name: "Cará (Acará)",
    scientificName: "Geophagus brasiliensis",
    habitat: "Lagoas, açudes e represas de fundo arenoso.",
    recommendedBaits: "minhoca, massa, ração",
  },
  {
    name: "Tilápia",
    scientificName: "Oreochromis niloticus",
    habitat: "Exótica; açudes, represas e pesqueiros de todo o país.",
    recommendedBaits: "massa, minhoca, milho, ração",
  },

  // --- Anostomídeos e detritívoros ---
  {
    name: "Piauçu",
    scientificName: "Megaleporinus macrocephalus",
    habitat: "Rios da bacia do Paraguai e Pantanal; o maior dos piaus.",
    recommendedBaits: "massa, milho, fruta, minhoca",
  },
  // REVISAR: "piau" cobre várias espécies de Leporinus; a mais citada é
  // L. friderici.
  {
    name: "Piau",
    scientificName: "Leporinus spp.",
    habitat: "Rios e represas de água corrente; anda em cardume.",
    recommendedBaits: "massa, milho, minhoca",
  },
  // REVISAR (iscas): é detritívoro e raramente morde isca de fundo — costuma
  // ser fisgado de raspão.
  {
    name: "Curimbatá",
    scientificName: "Prochilodus lineatus",
    habitat: "Fundo lodoso de rios e represas; faz piracema.",
    recommendedBaits: "massa",
  },
  // REVISAR: "lambari" vale para o gênero Astyanax inteiro (comum A. lacustris).
  {
    name: "Lambari",
    scientificName: "Astyanax spp.",
    habitat: "Córregos, margens de rios e represas; isca viva clássica.",
    recommendedBaits: "massa, milho, minhoca, mosca",
  },

  // --- Carpas (todas exóticas, de piscicultura) ---
  // REVISAR (iscas): filtradora de plâncton, morde isca com muito menos
  // frequência que as outras carpas.
  {
    name: "Carpa Cabeçuda",
    scientificName: "Hypophthalmichthys nobilis",
    habitat: "Exótica; meia-água de açudes e pesqueiros, filtrando plâncton.",
    recommendedBaits: "massa",
  },
  {
    name: "Carpa Húngara",
    scientificName: "Cyprinus carpio",
    habitat: "Exótica; fundo de açudes, represas e pesqueiros.",
    recommendedBaits: "massa, milho, minhoca",
  },
  {
    name: "Carpa Capim",
    scientificName: "Ctenopharyngodon idella",
    habitat: "Exótica; áreas com vegetação aquática, da qual se alimenta.",
    recommendedBaits: "capim, massa, milho",
  },
  // REVISAR: não é espécie separada — é uma variedade de escamas da
  // Cyprinus carpio, a mesma espécie da Carpa Húngara.
  {
    name: "Carpa Espelho",
    scientificName: "Cyprinus carpio (variedade espelho)",
    habitat: "Exótica; mesma água da carpa húngara, de que é uma variedade.",
    recommendedBaits: "massa, milho, minhoca",
  },
  // REVISAR: variedade ornamental (nishikigoi/koi) da Cyprinus carpio; alguns
  // lugares chamam de "carpa colorida" o Carassius auratus, que é outra espécie.
  {
    name: "Carpa Colorida",
    scientificName: "Cyprinus carpio (variedade ornamental)",
    habitat: "Exótica; lagos ornamentais e pesqueiros de pesque-e-solte.",
    recommendedBaits: "massa, milho, ração",
  },
];

// PLACEHOLDER: pesqueiros de exemplo, só para o formulário de captura ter opções.
const pesqueiros = [
  { name: "Pesqueiro Modelo", location: "São Paulo, SP" },
  { name: "Rio Tietê - Trecho", location: "Salto, SP" },
  { name: "Represa de Exemplo", location: "Avaré, SP" },
];

// `image_url` fica fora do UPDATE de propósito: se você preencher as fotos na
// mão pelo Workbench, rodar o seed de novo não apaga o que você fez.
const UPSERT_ESPECIE = `
  INSERT INTO fish_species
    (id, name, scientific_name, habitat, image_url, recommended_baits)
  VALUES (?, ?, ?, ?, NULL, ?) AS novo
  ON DUPLICATE KEY UPDATE
    scientific_name   = novo.scientific_name,
    habitat           = novo.habitat,
    recommended_baits = novo.recommended_baits
`;

for (const especie of especies) {
  await query(UPSERT_ESPECIE, [
    randomUUID(),
    especie.name,
    especie.scientificName,
    especie.habitat,
    especie.recommendedBaits,
  ]);
}

// fishing_spots não tem coluna única, então só inserimos se a tabela estiver vazia.
const [{ total }] = await query("SELECT COUNT(*) AS total FROM fishing_spots");
if (total === 0) {
  for (const pesqueiro of pesqueiros) {
    await query(
      "INSERT INTO fishing_spots (id, name, location, google_place_id) VALUES (?, ?, ?, NULL)",
      [randomUUID(), pesqueiro.name, pesqueiro.location],
    );
  }
}

console.log(`Seed concluído: ${especies.length} espécies e ${pesqueiros.length} pesqueiros.`);
await pool.end();
