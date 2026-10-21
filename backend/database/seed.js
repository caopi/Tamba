// Popula o catálogo de espécies, a carga inicial de pesqueiros, promove o
// primeiro admin e (só em desenvolvimento, com SEED_DEV_USERS=true) cria
// contas de teste. Rode com: npm run seed
//
// É idempotente: usa INSERT ... ON DUPLICATE KEY UPDATE com `name` como chave
// (UNIQUE em fish_species.name), então rodar de novo não duplica nada.
//
// O seed NUNCA sobrescreve um valor já preenchido: cada coluna descritiva usa
// COALESCE(coluna, novo.coluna). Rodar de novo só completa o que está NULL
// (ex.: uma coluna nova vinda de migration) e deixa em paz o que o admin
// editou pelo app. Consequência: corrigir um dado AQUI não altera uma espécie
// que já está no banco. Correção que precisa chegar a todos os bancos do grupo
// vira uma migration de dados (ex.: 010_dourado_incomum.sql), que roda uma
// vez em cada banco; correção pontual num banco só se faz pela rota de admin.
//
// ---------------------------------------------------------------------------
// RARIDADE — critério: frequência com que a espécie é estocada (ou aparece)
// nos pesqueiros brasileiros.
//
//   comum      — presente em praticamente todo pesqueiro (tilápia, pacu,
//                carpas, traíra; também as nativas que aparecem sozinhas em
//                quase toda água, como lambari e cará).
//   incomum    — difundida, mas não está em todo lugar (tambaqui, tucunaré,
//                matrinxã, dourado).
//   raro       — espécies grandes ou "premium", estocadas em menos lugares
//                (pirarara, pintado, surubim).
//   muito_raro — peixes-troféu (pirarucu, piraíba).
//
// Nativas que não são estocadas (mandi, jundiá, jacundá, piau, curimbatá)
// foram classificadas pela frequência com que aparecem em pesqueiro e
// represa, já que o critério de estocagem não se aplica direto a elas.
//
// ---------------------------------------------------------------------------
// FAIXAS PLAUSÍVEIS (peso em kg, comprimento em cm) — escolha de calibragem:
//
// A faixa serve para pegar erro de digitação e fraude ("tilápia de 500 kg"),
// NÃO para policiar captura grande de verdade. Fora da faixa, o RGN-08 pede
// confirmação e sinaliza a captura para revisão; faixa apertada demais vira
// atrito para quem pegou um peixe excepcional e legítimo. Por isso:
//
//   - o máximo fica perto do LIMITE REALISTA da espécie (recordes e
//     relatos confiáveis), e não do tamanho típico de pesqueiro;
//   - o mínimo é um juvenil plausível de ser fisgado;
//   - na dúvida, a faixa foi alargada.
//
// Exemplo: tambaqui típico de pesqueiro tem 3–15 kg, mas há relato de 46 kg
// em rio (Bahia, 2026) — o máximo é 50 kg.
//
// ---------------------------------------------------------------------------
// ATENÇÃO ao revisar: as linhas marcadas com "REVISAR" são as que não têm um
// nome científico único e indiscutível — híbridos de piscicultura (que não
// recebem nome binomial) e nomes populares que valem para um gênero inteiro.
// As marcadas com "REVISAR (faixa)" ou "REVISAR (raridade)" são valores sem
// fonte sólida: estimativa alargada de propósito, a conferir.

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../src/lib/db.js";
import { speciesImages } from "./species-images.js";
const especies = [
  // --- Redondos (Serrasalmidae) ---
  {
    name: "Tambaqui",
    scientificName: "Colossoma macropomum",
    habitat: "Rios e lagos de água preta da bacia amazônica; comum em pesqueiros.",
    recommendedBaits: "massa, fruta, milho, ração",
    rarity: "incomum",
    minWeight: 0.2, maxWeight: 50, minLength: 15, maxLength: 130,
    curiosities:
      "Na cheia, come os frutos que caem na floresta alagada e espalha as sementes rio afora. Os dentes molariformes quebram até castanhas.",
  },
  // REVISAR: híbrido de piscicultura (fêmea de tambaqui x macho de pacu).
  // Híbrido não recebe nome binomial válido.
  // REVISAR (faixa): sem literatura sobre o máximo do híbrido. Há relato de
  // ~41 kg em pesqueiro de Goiás, com identificação contestada (poderia ser
  // tambaqui puro) — o máximo de 45 kg cobre esse caso.
  {
    name: "Tambacu",
    scientificName: "Colossoma macropomum × Piaractus mesopotamicus",
    habitat: "Híbrido criado em piscicultura; encontrado quase só em pesqueiros.",
    recommendedBaits: "massa, milho, ração, minhoca",
    rarity: "comum",
    minWeight: 0.2, maxWeight: 45, minLength: 15, maxLength: 120,
    curiosities:
      "Foi criado para juntar o crescimento rápido do tambaqui à resistência ao frio do pacu — por isso se espalhou pelos pesqueiros do Sul e Sudeste.",
  },
  // REVISAR: "pacu" é nome popular de vários Serrasalmidae. Aqui vai o
  // pacu-caranha, que é o comum em pesqueiro do Sudeste.
  {
    name: "Pacu",
    scientificName: "Piaractus mesopotamicus",
    habitat: "Rios da bacia do Prata e do Pantanal; muito criado em pesqueiros.",
    recommendedBaits: "massa, milho, fruta, minhoca",
    rarity: "comum",
    minWeight: 0.2, maxWeight: 25, minLength: 15, maxLength: 90,
    curiosities:
      "Tem dentes parecidos com os humanos, que usa para quebrar sementes e frutos. É parente próximo das piranhas.",
  },
  // REVISAR: híbrido de piscicultura (pacu x pirapitinga).
  // REVISAR (faixa): sem dado próprio; usada a mesma faixa do pacu.
  {
    name: "Patinga",
    scientificName: "Piaractus mesopotamicus × Piaractus brachypomus",
    habitat: "Híbrido de piscicultura, criado para pesqueiros e tanques.",
    recommendedBaits: "massa, milho, ração",
    rarity: "comum",
    minWeight: 0.2, maxWeight: 25, minLength: 15, maxLength: 90,
    curiosities: "O nome junta os dos pais: PAcu com pirapiTINGA.",
  },
  // Faixa: a literatura cita até ~80 cm e 10 kg (Revista Ceres, 2010).
  {
    name: "Piracanjuba",
    scientificName: "Brycon orbignyanus",
    habitat: "Rios de água corrente da bacia do Paraná; espécie ameaçada.",
    recommendedBaits: "fruta, massa, minhoca, milho",
    rarity: "raro",
    minWeight: 0.1, maxWeight: 12, minLength: 15, maxLength: 90,
    curiosities:
      "Sumiu de boa parte dos rios onde era comum por causa das barragens e da poluição. Programas de repovoamento soltam alevinos na bacia do Paraná.",
  },
  // REVISAR (faixa): máximo estimado; a maioria das fontes fala em 4–5 kg.
  {
    name: "Matrinxã",
    scientificName: "Brycon amazonicus",
    habitat: "Rios de água clara da bacia amazônica.",
    recommendedBaits: "fruta, massa, milho, minhoca",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 8, minLength: 15, maxLength: 80,
    curiosities:
      "Faz grandes migrações rio acima para se reproduzir. Fisgado, briga muito e costuma saltar.",
  },
  {
    name: "Dourado",
    scientificName: "Salminus brasiliensis",
    habitat: "Corredeiras e rios de médio a grande porte; predador de superfície.",
    recommendedBaits: "isca artificial, lambari vivo, tuvira",
    // Era "raro" até a migration 010, que corrige os bancos já populados.
    rarity: "incomum",
    minWeight: 0.2, maxWeight: 35, minLength: 20, maxLength: 130,
    curiosities:
      "Chamado de \"rei do rio\", dá saltos espetaculares quando fisgado. A pesca é restrita ou proibida em alguns estados — confira a legislação local.",
  },

  // --- Bagres e couros (Siluriformes) ---
  {
    name: "Pirarara",
    scientificName: "Phractocephalus hemioliopterus",
    habitat: "Fundo de rios grandes da Amazônia e do Araguaia-Tocantins.",
    recommendedBaits: "peixinho vivo, fígado, coração, tripa",
    rarity: "raro",
    minWeight: 0.5, maxWeight: 80, minLength: 25, maxLength: 160,
    curiosities:
      "A cauda vermelho-alaranjada lembra a arara, daí o nome. É um bagre que come quase tudo, até frutos.",
  },
  {
    name: "Pintado",
    scientificName: "Pseudoplatystoma corruscans",
    habitat: "Fundo de rios de água corrente das bacias do Prata e do São Francisco.",
    recommendedBaits: "lambari vivo, tripa, minhocuçu, fígado",
    rarity: "raro",
    minWeight: 0.3, maxWeight: 100, minLength: 25, maxLength: 190,
    curiosities:
      "Um dos peixes de couro mais valorizados na culinária: a carne não tem espinhas intramusculares.",
  },
  // REVISAR: "surubim" é nome regional guarda-chuva para o gênero
  // Pseudoplatystoma. Em MG/SP costuma designar o próprio pintado — por isso
  // a mesma faixa do pintado.
  {
    name: "Surubim",
    scientificName: "Pseudoplatystoma spp.",
    habitat: "Poços fundos e canais de rios; hábito noturno.",
    recommendedBaits: "lambari vivo, tripa, fígado",
    rarity: "raro",
    minWeight: 0.3, maxWeight: 100, minLength: 25, maxLength: 190,
    curiosities:
      "Caça à noite, guiado pelos barbilhões longos, que funcionam como sensores de cheiro e tato.",
  },
  // REVISAR: já foi classificada como Pseudoplatystoma fasciatum; hoje a da
  // bacia do Paraguai é P. reticulatum.
  // REVISAR (faixa): menor que o pintado na mesma idade; máximo estimado.
  {
    name: "Cachara",
    scientificName: "Pseudoplatystoma reticulatum",
    habitat: "Rios das bacias do Paraguai e do Amazonas; fundo e barrancos.",
    recommendedBaits: "lambari vivo, tripa, fígado",
    rarity: "raro",
    minWeight: 0.3, maxWeight: 35, minLength: 25, maxLength: 140,
    curiosities:
      "\"Reticulatum\" quer dizer \"em rede\": as listras escuras formam um desenho reticulado que diferencia a cachara do pintado.",
  },
  // REVISAR: híbrido de piscicultura (pintado x cachara).
  // REVISAR (faixa): sem dado publicado; faixa entre a dos dois pais, alargada.
  {
    name: "Pincachara",
    scientificName: "Pseudoplatystoma corruscans × Pseudoplatystoma reticulatum",
    habitat: "Híbrido de piscicultura, muito usado para estocar pesqueiros.",
    recommendedBaits: "lambari vivo, tripa, fígado",
    rarity: "incomum",
    minWeight: 0.3, maxWeight: 50, minLength: 25, maxLength: 160,
    curiosities:
      "Junta as manchas do pintado com as listras da cachara — o desenho varia bastante de um peixe para outro.",
  },
  // REVISAR: híbrido (cachara x pirarara). Peixe recente em pesqueiro, com
  // pouca informação consolidada sobre iscas.
  // REVISAR (faixa): nenhuma fonte encontrada; faixa bem larga de propósito.
  // REVISAR (raridade): estocado em poucos lugares até onde se sabe.
  {
    name: "Cachapira",
    scientificName: "Pseudoplatystoma reticulatum × Phractocephalus hemioliopterus",
    habitat: "Híbrido de piscicultura; resistente ao frio, criado para pesqueiros.",
    recommendedBaits: "peixinho vivo, fígado, tripa",
    rarity: "raro",
    minWeight: 0.5, maxWeight: 60, minLength: 25, maxLength: 160,
    curiosities:
      "Cruzamento recente de cachara com pirarara, feito para ter um peixe de couro grande que aguente o inverno do Sudeste.",
  },
  {
    name: "Piraíba",
    scientificName: "Brachyplatystoma filamentosum",
    habitat: "Calha de grandes rios amazônicos; maior bagre da América do Sul.",
    recommendedBaits: "peixe inteiro, tuvira, tripa",
    rarity: "muito_raro",
    minWeight: 0.5, maxWeight: 300, minLength: 30, maxLength: 360,
    curiosities:
      "O maior bagre da América do Sul passa de 2,5 m. Os jovens têm outro nome: são os \"filhotes\".",
  },
  // REVISAR (raridade): nativa, mais comum em pesqueiro do Sul.
  {
    name: "Jundiá",
    scientificName: "Rhamdia quelen",
    habitat: "Remansos, açudes e riachos de fundo mole; hábito noturno.",
    recommendedBaits: "minhoca, tripa, fígado, peixinho",
    rarity: "incomum",
    minWeight: 0.05, maxWeight: 6, minLength: 10, maxLength: 65,
    curiosities:
      "Aguenta bem água fria, por isso é uma das poucas nativas criadas em piscicultura no Sul do Brasil.",
  },
  // REVISAR (raridade): nativa de rio e represa, raramente estocada.
  {
    name: "Mandi (Mandi-amarelo)",
    scientificName: "Pimelodus maculatus",
    habitat: "Fundo de rios e represas; anda em cardume.",
    recommendedBaits: "minhoca, tripa, coração, massa",
    rarity: "incomum",
    minWeight: 0.03, maxWeight: 3, minLength: 10, maxLength: 50,
    curiosities:
      "Os esporões das nadadeiras peitorais e dorsal dão ferroadas bem doloridas — segure com cuidado.",
  },
  // REVISAR: exótico (bagre-do-canal, do Mississippi), introduzido no Brasil
  // para piscicultura e muito solto em pesqueiro.
  // Faixa: o recorde mundial da espécie fica perto de 26 kg.
  {
    name: "Catfish",
    scientificName: "Ictalurus punctatus",
    habitat: "Exótico; criado em tanques e solto em pesqueiros.",
    recommendedBaits: "ração, fígado, coração de galinha, massa",
    rarity: "incomum",
    minWeight: 0.2, maxWeight: 27, minLength: 15, maxLength: 130,
    curiosities:
      "Tem papilas gustativas espalhadas pelo corpo e pelos barbilhões: \"prova\" a comida antes de chegar a ela.",
  },
  // "Bagre-africano" é o nome que os pescadores da região usam. Raridade:
  // estocado em muitos pesqueiros, mas não em todos (e restrito em alguns
  // estados). Faixa: a espécie chega perto de 60 kg e 1,7 m.
  // REVISAR (faixa).
  {
    name: "Bagre-africano",
    scientificName: "Clarias gariepinus",
    habitat:
      "Exótico, da África; criado em tanques e solto em pesqueiros; também em represas onde escapou. Tolera água parada e com pouco oxigênio.",
    recommendedBaits: "fígado, coração de galinha, salsicha, massa, minhoca",
    rarity: "incomum",
    minWeight: 0.2, maxWeight: 60, minLength: 20, maxLength: 170,
    curiosities:
      "Respira ar por um órgão acima das brânquias e consegue se arrastar por terra entre poças. Chegou ao Brasil para piscicultura na década de 1980 e hoje é considerado invasor. No pesqueiro é quase sempre a forma albina, rosada; na natureza, a espécie é cinza-escura.",
  },

  // --- Predadores de superfície e ciclídeos ---
  {
    name: "Pirarucu",
    scientificName: "Arapaima gigas",
    habitat: "Lagos e várzeas da Amazônia; respira ar na superfície.",
    recommendedBaits: "peixinho vivo, tripa",
    rarity: "muito_raro",
    minWeight: 1, maxWeight: 250, minLength: 40, maxLength: 300,
    curiosities:
      "Respira ar: sobe à superfície de tempos em tempos para \"boiar\". As escamas são tão duras que viram lixa de unha e artesanato.",
  },
  // REVISAR: "tucunaré" cobre várias espécies do gênero Cichla. Em pesqueiro,
  // os comuns são C. kelberi e C. piquiti.
  // REVISAR (faixa): o máximo de 13 kg é do tucunaré-açu (C. temensis); para
  // os de pesqueiro sobra folga, de propósito.
  {
    name: "Tucunaré",
    scientificName: "Cichla spp.",
    habitat: "Represas e lagos de água parada e quente; predador visual.",
    recommendedBaits: "isca artificial, lambari vivo",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 13, minLength: 15, maxLength: 100,
    curiosities:
      "O casal guarda os ovos e os filhotes. Na época da reprodução, o macho ganha uma corcova na cabeça.",
  },
  {
    name: "Traíra",
    scientificName: "Hoplias malabaricus",
    habitat: "Brejos, lagoas e remansos rasos com vegetação.",
    recommendedBaits: "isca artificial, lambari vivo, minhoca",
    rarity: "comum",
    minWeight: 0.05, maxWeight: 6, minLength: 12, maxLength: 80,
    curiosities:
      "Resiste a água com pouquíssimo oxigênio e sobrevive até em poças que quase secam.",
  },
  // REVISAR (faixa): fontes de pesca citam 10 kg e 1 m, com recordes perto
  // de 15 kg; não achamos fonte científica. Máximo alargado para 20 kg.
  {
    name: "Trairão",
    scientificName: "Hoplias lacerdae",
    habitat: "Rios e lagoas de água limpa; bem maior que a traíra comum.",
    recommendedBaits: "isca artificial, peixe vivo",
    rarity: "raro",
    minWeight: 0.2, maxWeight: 20, minLength: 20, maxLength: 110,
    curiosities:
      "Tem dentes afiados e mordida fortíssima: use alicate para tirar o anzol.",
  },
  // REVISAR: exótico (largemouth bass), introduzido no Sul e Sudeste.
  // Faixa: o recorde mundial da espécie fica perto de 10 kg.
  {
    name: "Black Bass",
    scientificName: "Micropterus salmoides",
    habitat: "Exótico; represas e lagos de água mais fria do Sul e Sudeste.",
    recommendedBaits: "isca artificial, lambari vivo",
    rarity: "raro",
    minWeight: 0.1, maxWeight: 10, minLength: 15, maxLength: 80,
    curiosities:
      "Veio dos Estados Unidos para a pesca esportiva. Predador voraz, compete com as espécies nativas onde foi solto.",
  },
  // REVISAR: "jacundá" vale para o gênero Crenicichla inteiro, não para uma
  // espécie só.
  // REVISAR (raridade): pouco estocado; aparece em rio e represa.
  {
    name: "Jacundá",
    scientificName: "Crenicichla spp.",
    habitat: "Margens com galhada e pedras em rios amazônicos e do Prata.",
    recommendedBaits: "isca artificial pequena, minhoca",
    rarity: "incomum",
    minWeight: 0.02, maxWeight: 2, minLength: 8, maxLength: 45,
    curiosities:
      "Ciclídeo de corpo comprido, diferente dos carás: vive escondido entre pedras e galhos e ataca de emboscada.",
  },
  // REVISAR: "cará"/"acará" é nome genérico de vários ciclídeos; o mais comum
  // no Sudeste é o Geophagus brasiliensis.
  {
    name: "Cará (Acará)",
    scientificName: "Geophagus brasiliensis",
    habitat: "Lagoas, açudes e represas de fundo arenoso.",
    recommendedBaits: "minhoca, massa, ração",
    rarity: "comum",
    minWeight: 0.01, maxWeight: 1, minLength: 5, maxLength: 35,
    curiosities:
      "\"Geophagus\" quer dizer \"comedor de terra\": ele peneira a areia do fundo atrás de alimento.",
  },
  {
    name: "Tilápia",
    scientificName: "Oreochromis niloticus",
    habitat: "Exótica; açudes, represas e pesqueiros de todo o país.",
    recommendedBaits: "massa, minhoca, milho, ração",
    rarity: "comum",
    minWeight: 0.05, maxWeight: 6, minLength: 10, maxLength: 65,
    curiosities:
      "Veio da África e virou o peixe mais criado do Brasil. A fêmea incuba os ovos dentro da boca.",
  },

  // --- Anostomídeos e detritívoros ---
  // REVISAR (faixa): só achamos comprimento padrão (~41 cm) de uma espécie
  // vizinha (M. piavussu); máximo estimado e alargado.
  {
    name: "Piauçu",
    scientificName: "Megaleporinus macrocephalus",
    habitat: "Rios da bacia do Paraguai e Pantanal; o maior dos piaus.",
    recommendedBaits: "massa, milho, fruta, minhoca",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 6, minLength: 15, maxLength: 70,
    curiosities:
      "Muito arisco: belisca a isca várias vezes antes de engolir, o que exige paciência na fisgada.",
  },
  // REVISAR: "piau" cobre várias espécies de Leporinus; a mais citada é
  // L. friderici. Faixa alargada para caber as maiores do gênero.
  {
    name: "Piau",
    scientificName: "Leporinus spp.",
    habitat: "Rios e represas de água corrente; anda em cardume.",
    recommendedBaits: "massa, milho, minhoca",
    rarity: "incomum",
    minWeight: 0.03, maxWeight: 4, minLength: 10, maxLength: 55,
    curiosities:
      "A boca pequena, com dentes na frente, serve para raspar algas e pegar pedaços de alimento — por isso as iscas pequenas funcionam melhor.",
  },
  // REVISAR (iscas): é detritívoro e raramente morde isca de fundo — costuma
  // ser fisgado de raspão.
  // REVISAR (faixa): máximo estimado.
  {
    name: "Curimbatá",
    scientificName: "Prochilodus lineatus",
    habitat: "Fundo lodoso de rios e represas; faz piracema.",
    recommendedBaits: "massa",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 10, minLength: 15, maxLength: 80,
    curiosities:
      "Na piracema, os machos \"roncam\" — fazem um som grave que dá para ouvir fora d'água.",
  },
  // REVISAR: "lambari" vale para o gênero Astyanax inteiro (comum A. lacustris).
  {
    name: "Lambari",
    scientificName: "Astyanax spp.",
    habitat: "Córregos, margens de rios e represas; isca viva clássica.",
    recommendedBaits: "massa, milho, minhoca, mosca",
    rarity: "comum",
    minWeight: 0.003, maxWeight: 0.25, minLength: 3, maxLength: 25,
    curiosities:
      "É a base da alimentação de quase todos os predadores de rio — e, por isso, a isca viva mais usada do Brasil.",
  },

  // --- Carpas (todas exóticas, de piscicultura) ---
  // REVISAR (iscas): filtradora de plâncton, morde isca com muito menos
  // frequência que as outras carpas.
  {
    name: "Carpa Cabeçuda",
    scientificName: "Hypophthalmichthys nobilis",
    habitat: "Exótica; meia-água de açudes e pesqueiros, filtrando plâncton.",
    recommendedBaits: "massa",
    rarity: "comum",
    minWeight: 0.2, maxWeight: 45, minLength: 15, maxLength: 150,
    curiosities:
      "Não caça: filtra o plâncton da água com as brânquias. Por isso quase não morde isca comum.",
  },
  {
    name: "Carpa Húngara",
    scientificName: "Cyprinus carpio",
    habitat: "Exótica; fundo de açudes, represas e pesqueiros.",
    recommendedBaits: "massa, milho, minhoca",
    rarity: "comum",
    minWeight: 0.1, maxWeight: 40, minLength: 12, maxLength: 120,
    curiosities: "Pode passar dos 20 anos de vida. Revira o fundo atrás de comida e deixa a água turva.",
  },
  {
    name: "Carpa Capim",
    scientificName: "Ctenopharyngodon idella",
    habitat: "Exótica; áreas com vegetação aquática, da qual se alimenta.",
    recommendedBaits: "capim, massa, milho",
    rarity: "comum",
    minWeight: 0.2, maxWeight: 45, minLength: 15, maxLength: 150,
    curiosities:
      "Come muita planta aquática por dia, e por isso é usada para controlar a vegetação de lagos e represas.",
  },
  // REVISAR: não é espécie separada — é uma variedade de escamas da
  // Cyprinus carpio, a mesma espécie da Carpa Húngara (mesma faixa).
  {
    name: "Carpa Espelho",
    scientificName: "Cyprinus carpio (variedade espelho)",
    habitat: "Exótica; mesma água da carpa húngara, de que é uma variedade.",
    recommendedBaits: "massa, milho, minhoca",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 40, minLength: 12, maxLength: 120,
    curiosities:
      "Tem poucas escamas, grandes e brilhantes, espalhadas pelo corpo — parecem espelhos, daí o nome.",
  },
  // REVISAR: variedade ornamental (nishikigoi/koi) da Cyprinus carpio; alguns
  // lugares chamam de "carpa colorida" o Carassius auratus, que é outra espécie.
  {
    name: "Carpa Colorida",
    scientificName: "Cyprinus carpio (variedade ornamental)",
    habitat: "Exótica; lagos ornamentais e pesqueiros de pesque-e-solte.",
    recommendedBaits: "massa, milho, ração",
    rarity: "incomum",
    minWeight: 0.1, maxWeight: 20, minLength: 12, maxLength: 100,
    curiosities:
      "É a carpa koi, variedade ornamental desenvolvida no Japão a partir da carpa comum.",
  },
];

// PESQUEIROS — só a CARGA INICIAL, não o catálogo inteiro. Os pesqueiros
// passam a ser cadastrados pelo app; o banco de produção é a fonte da verdade,
// e esta lista não está (nem vai ficar) completa.
//
// Origem e conferência de cada linha: database/pesqueiros/LEIA-ME.md. Entra
// aqui só o que foi conferido; o CSV de lá guarda todos, inclusive os
// descartados. `location` é "Cidade, UF": vira a região da captura
// (catches.region). Endereço e link do Maps ficam só no CSV.
//
// Upsert pela chave única (name, location) da migration 019: rodar de novo não
// duplica, e um pesqueiro que já existe não é tocado (nem reativado, se tiver
// sido desativado). Consequência: mudar o nome ou a cidade de um pesqueiro
// AQUI cria outro, não renomeia — correção de pesqueiro existente é pelo app.
const pesqueiros = [
  { name: "Pesqueiro Santa Rita Gigantes", location: "Bragança Paulista, SP" },
  { name: "Três Coqueiros Pesqueiro e Lanchonete", location: "Itatiba, SP" },
  { name: "Pesqueiro Nenê Oliani", location: "Socorro, SP" },
  { name: "Restaurante e Pesqueiro Pitauá", location: "Socorro, SP" },
  { name: "Pousada e Pesqueiro Boa Vida", location: "Extrema, MG" },
];

// Tudo com COALESCE: só preenche o que está NULL (ver o topo do arquivo).
//
// Foto: `image_url` guarda o caminho relativo à API ("/assets/species/...",
// arquivo versionado no repo); o storage.publicUrl completa o endereço. O
// crédito anda junto com a foto: só é preenchido se a espécie ainda não tem
// foto. Por isso a miniatura, o crédito e a legenda vêm ANTES do image_url — o MySQL
// aplica as atribuições em ordem, e ali o image_url ainda é o valor antigo.
// Assim a foto que um admin trocou pelo app nunca ganha o crédito da foto do
// seed.
const UPSERT_ESPECIE = `
  INSERT INTO fish_species
    (id, name, scientific_name, habitat, image_url, image_thumb_url, image_credit,
     image_license, image_source_url, image_caption, recommended_baits, rarity,
     min_weight, max_weight, min_length, max_length, curiosities)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS novo
  ON DUPLICATE KEY UPDATE
    image_thumb_url   = IF(fish_species.image_url IS NULL, novo.image_thumb_url,  fish_species.image_thumb_url),
    image_credit      = IF(fish_species.image_url IS NULL, novo.image_credit,     fish_species.image_credit),
    image_license     = IF(fish_species.image_url IS NULL, novo.image_license,    fish_species.image_license),
    image_source_url  = IF(fish_species.image_url IS NULL, novo.image_source_url, fish_species.image_source_url),
    image_caption     = IF(fish_species.image_url IS NULL, novo.image_caption,    fish_species.image_caption),
    image_url         = COALESCE(fish_species.image_url,         novo.image_url),
    scientific_name   = COALESCE(fish_species.scientific_name,   novo.scientific_name),
    habitat           = COALESCE(fish_species.habitat,           novo.habitat),
    recommended_baits = COALESCE(fish_species.recommended_baits, novo.recommended_baits),
    rarity            = COALESCE(fish_species.rarity,            novo.rarity),
    min_weight        = COALESCE(fish_species.min_weight,        novo.min_weight),
    max_weight        = COALESCE(fish_species.max_weight,        novo.max_weight),
    min_length        = COALESCE(fish_species.min_length,        novo.min_length),
    max_length        = COALESCE(fish_species.max_length,        novo.max_length),
    curiosities       = COALESCE(fish_species.curiosities,       novo.curiosities)
`;

for (const especie of especies) {
  const foto = speciesImages[especie.name];
  await query(UPSERT_ESPECIE, [
    randomUUID(),
    especie.name,
    especie.scientificName,
    especie.habitat,
    foto ? `/assets/species/${foto.file}` : null,
    // Miniatura da grade, gerada por `npm run thumbs`: mesmo nome, em thumb/.
    foto ? `/assets/species/thumb/${foto.file}` : null,
    foto?.credit ?? null,
    foto?.license ?? null,
    foto?.sourceUrl ?? null,
    foto?.caption ?? null,
    especie.recommendedBaits,
    especie.rarity,
    especie.minWeight,
    especie.maxWeight,
    especie.minLength,
    especie.maxLength,
    especie.curiosities,
  ]);
}

for (const pesqueiro of pesqueiros) {
  await query(
    `INSERT INTO fishing_spots (id, name, location) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [randomUUID(), pesqueiro.name, pesqueiro.location],
  );
}

// Foto cadastrada para uma espécie que não existe no seed: erro de digitação
// no nome, que deixaria a espécie sem foto sem ninguém perceber.
for (const nome of Object.keys(speciesImages)) {
  if (!especies.some((e) => e.name === nome)) {
    throw new Error(`species-images.js: "${nome}" não é uma espécie do seed`);
  }
}

console.log(`Seed concluído: ${especies.length} espécies e ${pesqueiros.length} pesqueiros.`);

// ---------------------------------------------------------------------------
// Contas de DESENVOLVIMENTO: credenciais descartáveis, só para testar local.
//
// Dupla trava: só roda com SEED_DEV_USERS=true no .env (opt-in explícito) e
// nunca com NODE_ENV=production. O NODE_ENV sozinho não bastaria — nada no
// projeto define essa variável, então as contas sairiam em qualquer máquina.
//
// A cada execução o seed garante senha, conta ativa e papel: as credenciais
// do README sempre funcionam, mesmo que alguém tenha mexido nelas.
// Independente do ADMIN_EMAIL, que continua sendo como se promove conta real.
const SENHA_DEV = "admin123"; // 8 caracteres: atende o RGN-03
const contasDev = [
  { email: "admin@tamba.local", nickname: "admin", name: "Admin (dev)", role: "admin" },
  { email: "ana@tamba.local", nickname: "ana", name: "Ana (dev)", role: "user" },
  { email: "bruno@tamba.local", nickname: "bruno", name: "Bruno (dev)", role: "user" },
  { email: "carla@tamba.local", nickname: "carla", name: "Carla (dev)", role: "user" },
];

if (process.env.SEED_DEV_USERS === "true") {
  if (process.env.NODE_ENV === "production") {
    console.warn("\nAVISO: SEED_DEV_USERS ignorado — NODE_ENV=production. Contas de dev não criadas.");
  } else {
    const hash = await bcrypt.hash(SENHA_DEV, 10);
    const criadas = [];

    for (const conta of contasDev) {
      try {
        await query(
          `INSERT INTO users (id, email, password_hash, name, nickname, is_active, role)
           VALUES (?, ?, ?, ?, ?, TRUE, ?) AS novo
           ON DUPLICATE KEY UPDATE
             password_hash = novo.password_hash,
             is_active     = TRUE,
             role          = novo.role,
             email_verification_token      = NULL,
             email_verification_expires_at = NULL`,
          [randomUUID(), conta.email, hash, conta.name, conta.nickname, conta.role],
        );
        criadas.push(conta);
      } catch (err) {
        // O UNIQUE que bateu foi o do apelido: uma conta de verdade já usa
        // esse nickname. Não mexemos nela.
        if (err.code === "ER_DUP_ENTRY") {
          console.warn(`AVISO: apelido "${conta.nickname}" já é de outra conta; ${conta.email} não foi criada.`);
        } else {
          throw err;
        }
      }
    }

    const linha = "!".repeat(64);
    console.warn(
      `\n${linha}\n  CONTAS DE DESENVOLVIMENTO (SEED_DEV_USERS=true) — NÃO são contas reais.\n` +
        `  Senha de todas: ${SENHA_DEV}\n` +
        criadas.map((c) => `    ${c.email.padEnd(20)} @${c.nickname.padEnd(7)} ${c.role}`).join("\n") +
        `\n  Nunca use em produção. Para desligar: SEED_DEV_USERS=false no .env.\n${linha}`,
    );
  }
}

// Primeiro admin: promove a conta de ADMIN_EMAIL, se ela já existir. O seed
// NÃO cria a conta — cadastre-se pelo app primeiro (e confirme o e-mail),
// depois defina ADMIN_EMAIL no .env e rode o seed. Não há rota para virar admin.
const adminEmail = process.env.ADMIN_EMAIL?.trim();
if (adminEmail) {
  const conta = await queryOne("SELECT id, role FROM users WHERE email = ?", [adminEmail]);
  if (!conta) {
    console.warn(
      `\nAVISO: ADMIN_EMAIL=${adminEmail}, mas nenhuma conta usa esse e-mail.\n` +
        "Cadastre-se pelo app com esse e-mail e rode `npm run seed` de novo.",
    );
  } else if (conta.role === "admin") {
    console.log(`${adminEmail} já é admin.`);
  } else {
    await query("UPDATE users SET role = 'admin' WHERE id = ?", [conta.id]);
    console.log(`${adminEmail} promovido a admin.`);
  }
}

await pool.end();
