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
// editou pelo app. Consequência: corrigir um dado do catálogo não altera uma espécie
// que já está no banco. Correção que precisa chegar a todos os bancos do grupo
// vira uma migration de dados (ex.: 010_dourado_incomum.sql), que roda uma
// vez em cada banco; correção pontual num banco só se faz pela rota de admin.
//
// A lista de espécies, com o critério de raridade e das faixas plausíveis, está
// em species-catalog.js.

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../src/lib/db.js";
import { especies } from "./species-catalog.js";
import { speciesImages } from "./species-images.js";

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
