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
 *
 * `conn` é a conexão de uma transação aberta com `withTransaction`; sem ela, a
 * query vai direto no pool.
 */
export async function query(sql, params = [], conn = pool) {
  const [resultado] = await conn.execute(sql, params);
  return resultado;
}

/** Primeira linha do resultado, ou null. Para buscas por id/email. */
export async function queryOne(sql, params = [], conn = pool) {
  const linhas = await query(sql, params, conn);
  return linhas[0] ?? null;
}

/**
 * Roda `fn(conn)` dentro de uma transação: commit se terminar, rollback se
 * lançar. Toda query que deve entrar na transação precisa receber o `conn`.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * O INSERT bateu num UNIQUE/PRIMARY KEY? Com `chave`, confere também qual
 * índice foi (o nome aparece na mensagem do MySQL: "for key 'users.uk_...'").
 */
export function isDuplicateKey(err, chave) {
  return err?.code === "ER_DUP_ENTRY" && (!chave || err.message.includes(chave));
}
