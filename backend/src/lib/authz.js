import { httpError } from "../middlewares/errorHandler.js";

/**
 * `actor` é quem está fazendo a requisição: `{ id, role }`, montado pelo
 * middleware de autenticação a partir do banco (não do token, para que mudar
 * o papel de alguém valha na hora).
 *
 * As rotas de admin também passam por um middleware, mas o service confere de
 * novo: a regra fica valendo mesmo que alguém esqueça o middleware numa rota.
 */
export function assertAdmin(actor) {
  if (actor?.role !== "admin") {
    throw httpError(403, "Apenas administradores podem fazer isso");
  }
}
