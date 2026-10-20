// Estado da API para o /api/health.
//
// A resposta é sempre 200: o health check do Railway só decide se o deploy
// sobe, e um deploy com migration pendente sobe mesmo assim (ver
// lib/migrations.js). Quem lê o `status` é gente: "ok" ou "degraded", com o
// motivo junto. Conferir depois de todo deploy com migration (DEPLOY.md, 4.6).

import { pendingMigrations } from "../lib/migrations.js";

export async function getHealth() {
  let pendentes;
  try {
    pendentes = await pendingMigrations();
  } catch (err) {
    // Sem banco não dá para conferir; a API continua respondendo o resto que
    // puder, e o motivo fica à vista aqui.
    return { status: "degraded", error: `não foi possível conferir as migrations: ${err.code ?? err.message}` };
  }
  if (pendentes.length === 0) return { status: "ok" };
  return {
    status: "degraded",
    pendingMigrations: pendentes,
    error: "Há migrations não aplicadas: a API está rodando contra um schema antigo. Rode `npm run migrate` (DEPLOY.md, 4.6).",
  };
}
