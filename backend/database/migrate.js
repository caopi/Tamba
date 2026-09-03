// Roda os arquivos .sql de database/migrations em ordem alfabética,
// pulando os que já foram aplicados. Rode com: npm run migrate
//
// O controle fica na tabela `schema_migrations`, criada aqui mesmo.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const conexao = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  // Cada arquivo .sql tem vários comandos separados por ';'.
  multipleStatements: true,
  timezone: "Z",
});

await conexao.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) NOT NULL,
    applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (filename)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
`);

const [aplicadas] = await conexao.query("SELECT filename FROM schema_migrations");
const jaRodou = new Set(aplicadas.map((linha) => linha.filename));

const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith(".sql")).sort();
let novas = 0;

for (const arquivo of arquivos) {
  if (jaRodou.has(arquivo)) continue;

  const sql = await readFile(path.join(PASTA, arquivo), "utf8");
  await conexao.query(sql);
  await conexao.query("INSERT INTO schema_migrations (filename) VALUES (?)", [arquivo]);

  console.log(`aplicada: ${arquivo}`);
  novas++;
}

console.log(novas === 0 ? "Nada a fazer, o banco já está atualizado." : `${novas} migration(s) aplicada(s).`);
await conexao.end();
