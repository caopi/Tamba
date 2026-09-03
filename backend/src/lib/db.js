import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida no .env");
}

/**
 * Pool de conexões compartilhado por toda a aplicação.
 * Abrir uma conexão por request derrubaria o MySQL rapidinho.
 */
export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // DATETIME não guarda fuso horário. Fixando 'Z', o mysql2 grava e lê tudo
  // como UTC, então a data que sai da API é a mesma que entrou.
  timezone: "Z",
});

// A opção `timezone` acima só afeta a conversão de Date no lado do JS: a sessão
// do MySQL continua no fuso do servidor (aqui, UTC-3). Sem isto, o
// DEFAULT CURRENT_TIMESTAMP das colunas `created_at` gravaria horário local e a
// API devolveria essa hora rotulada como UTC — três horas errada.
pool.on("connection", (conexao) => {
  conexao.query("SET time_zone = '+00:00'");
});

/**
 * Atalho para SELECT/INSERT/UPDATE/DELETE com parâmetros.
 *
 * Usa `execute` (prepared statement): os valores vão separados do SQL, então
 * nunca monte query concatenando string — passe `?` e os valores em `params`.
 */
export async function query(sql, params = []) {
  const [resultado] = await pool.execute(sql, params);
  return resultado;
}

/** Primeira linha do resultado, ou null. Para buscas por id/email. */
export async function queryOne(sql, params = []) {
  const linhas = await query(sql, params);
  return linhas[0] ?? null;
}
