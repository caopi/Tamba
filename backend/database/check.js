// Confere se o MySQL de DATABASE_URL serve para o Tamba, antes do primeiro
// `npm run migrate` num banco novo (DEPLOY.md, seção 4.1). Só lê: não cria
// nem altera nada. Rode com: npm run check-db
//
// Nunca imprime o DATABASE_URL nem a senha: só o host, o banco e o usuário.

import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida no .env");
}

const alvo = new URL(process.env.DATABASE_URL);
const conexao = await mysql.createConnection({ uri: process.env.DATABASE_URL });
const um = async (sql) => (await conexao.query(sql))[0][0];

let problemas = 0;
const linha = (ok, texto) => {
  if (ok === false) problemas++;
  console.log(`${ok === false ? "FALHA" : ok === true ? "ok   " : "info "}  ${texto}`);
};

linha(null, `conectado em ${alvo.hostname}:${alvo.port || 3306}, banco "${alvo.pathname.slice(1)}"`);

// MySQL 8.0.19+: o seed usa INSERT ... AS novo ON DUPLICATE KEY UPDATE, e as
// tabelas usam utf8mb4_0900_ai_ci. MariaDB não tem nenhum dos dois.
const { versao } = await um("SELECT VERSION() AS versao");
const [maior, menor, patch] = versao.split(/[.-]/).map(Number);
const novoBastante = maior > 8 || (maior === 8 && (menor > 0 || patch >= 19));
linha(!/mariadb/i.test(versao) && novoBastante, `versão ${versao} (precisa de MySQL 8.0.19 ou mais novo, não MariaDB)`);

const { usuario, plugin } = await um(
  "SELECT CURRENT_USER() AS usuario, (SELECT plugin FROM mysql.user WHERE CONCAT(user, '@', host) = CURRENT_USER()) AS plugin",
).catch(async () => ({ ...(await um("SELECT CURRENT_USER() AS usuario")), plugin: "(sem acesso a mysql.user)" }));
linha(null, `usuário ${usuario}, autenticação ${plugin}`);

const { cifra } = await um("SELECT VARIABLE_VALUE AS cifra FROM performance_schema.session_status WHERE VARIABLE_NAME = 'Ssl_cipher'").catch(() => ({ cifra: null }));
linha(null, cifra ? `conexão com TLS (${cifra})` : "conexão sem TLS (ou sem acesso ao performance_schema)");

const { collation } = await um("SELECT @@collation_server AS collation");
linha(null, `collation padrão do servidor: ${collation} (as tabelas declaram a delas, utf8mb4_0900_ai_ci)`);

// Migration 007 (triggers): com binary log ligado, CREATE TRIGGER exige SUPER
// ou log_bin_trust_function_creators = 1. Ver DEPLOY.md, 4.5.
const { logBin, confia } = await um("SELECT @@log_bin AS logBin, @@log_bin_trust_function_creators AS confia");
const permissoes = (await conexao.query("SHOW GRANTS"))[0].map((g) => Object.values(g)[0]);
const temSuper = permissoes.some((g) => /^GRANT (ALL PRIVILEGES|.*\bSUPER\b.*) ON \*\.\* /.test(g));
const triggerPassa = !logBin || confia || temSuper;
linha(
  null,
  `binary log ${logBin ? "ligado" : "desligado"}, log_bin_trust_function_creators = ${confia}, SUPER ${temSuper ? "sim" : "não"}`,
);
linha(
  null,
  triggerPassa
    ? "migration 007 (triggers) deve passar direto"
    : "migration 007 (triggers) vai falhar com o erro 1419: siga DEPLOY.md, seção 4.5",
);

const { tabelas } = await um("SELECT COUNT(*) AS tabelas FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
linha(null, tabelas === 0 ? "banco vazio (pronto para o primeiro migrate)" : `o banco já tem ${tabelas} tabela(s)`);

await conexao.end();
console.log(problemas === 0 ? "\nPode rodar o migrate." : `\n${problemas} requisito(s) não atendido(s): não rode o migrate.`);
process.exitCode = problemas === 0 ? 0 : 1;
