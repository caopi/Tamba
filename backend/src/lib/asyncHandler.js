/**
 * Envolve um controller async para que erros lancados caiam no errorHandler.
 * Sem isso, uma Promise rejeitada no Express 4 derruba a request silenciosamente.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
