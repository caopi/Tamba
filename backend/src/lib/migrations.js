// Migrations que existem no código mas ainda não foram aplicadas no banco.
//
// Em produção quem aplica é o pre-deploy command do Railway (DEPLOY.md, 4.6).
// Se ele não rodar (campo apagado, configuração errada), a API nova sobe
// contra o schema velho. Isto não impede a subida — com o volume, o deploy
// antigo já parou, e recusar subir derrubaria o site inteiro —, só deixa o
// problema impossível de não ver: no log de cada subida e no /api/health.

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../database/migrations");

/** Nomes dos .sql de database/migrations ainda fora de `schema_migrations`, em ordem. */
export async function pendingMigrations() {
  const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith(".sql")).sort();
  let aplicadas;
  try {
    aplicadas = new Set((await query("SELECT filename FROM schema_migrations")).map((l) => l.filename));
  } catch (err) {
    // Banco que nunca rodou o migrate: a tabela nem existe, tudo está pendente.
    if (err.code !== "ER_NO_SUCH_TABLE") throw err;
    aplicadas = new Set();
  }
  return arquivos.filter((f) => !aplicadas.has(f));
}
