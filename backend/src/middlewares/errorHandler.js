import { ZodError } from "zod";

/** Rota não encontrada. */
export function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

/**
 * Tratador de erros central. Os controllers podem lancar a vontade:
 * erros de validação viram 400, o resto vira 500.
 */
// eslint-disable-next-line no-unused-vars -- o Express só reconhece o handler com 4 argumentos
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }

  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
}

/**
 * Atalho para lancar erros HTTP com status: `throw httpError(404, "não achei")`.
 *
 * `extra` vai junto no JSON da resposta. Serve para quando o frontend precisa
 * reagir a um erro específico, não só mostrar a mensagem — ex.:
 * `{ code: "OUT_OF_RANGE" }` faz a tela abrir a confirmação de peso fora da faixa.
 */
export function httpError(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  err.extra = extra;
  return err;
}
