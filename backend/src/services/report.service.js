// Denúncias e moderação (RGN-14).

import { z } from "zod";
import * as reportModel from "../models/report.model.js";
import * as catchModel from "../models/catch.model.js";
import { isDuplicateKey, withTransaction } from "../lib/db.js";
import { assertAdmin } from "../lib/authz.js";
import { httpError } from "../middlewares/errorHandler.js";
import { findVisibleCatch, toCatchResponse } from "./catch.service.js";

/**
 * Quantos usuários distintos precisam denunciar para a captura sumir.
 * Vem do .env para a apresentação: com REPORT_HIDE_THRESHOLD=1 dá para
 * mostrar o ocultamento automático sem criar três contas.
 */
const LIMITE_PARA_OCULTAR = (() => {
  const valor = Number(process.env.REPORT_HIDE_THRESHOLD ?? 3);
  if (!Number.isInteger(valor) || valor < 1) {
    throw new Error("REPORT_HIDE_THRESHOLD precisa ser um inteiro maior ou igual a 1");
  }
  return valor;
})();

const reportSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Conte o motivo da denúncia")
    .max(500, "Motivo muito longo"),
});

const reviewSchema = z.object({
  // true = manter/deixar oculta; false = liberar de volta para o feed.
  hide: z.boolean({ required_error: "Informe se a captura fica oculta (hide)" }),
});

export async function reportCatch(reporterId, catchId, entrada) {
  const { reason } = reportSchema.parse(entrada);

  const captura = await findVisibleCatch(reporterId, catchId);
  if (captura.userId === reporterId) {
    throw httpError(422, "Você não pode denunciar sua própria captura");
  }

  await withTransaction(async (conn) => {
    // Serializa denúncias simultâneas da mesma captura (ver lockById).
    await catchModel.lockById(catchId, conn);

    try {
      await reportModel.create(reporterId, catchId, reason, conn);
    } catch (err) {
      if (isDuplicateKey(err)) throw httpError(409, "Você já denunciou essa captura");
      throw err;
    }

    // RGN-14: denunciada por N usuários distintos → oculta automaticamente até
    // um admin analisar. Só contam as PENDENTES: depois que o admin analisa e
    // libera, as denúncias antigas viram 'analisado' e é preciso juntar N
    // novas para ocultar de novo — senão a próxima denúncia isolada já
    // derrubaria a captura outra vez.
    if ((await reportModel.countPending(catchId, conn)) >= LIMITE_PARA_OCULTAR) {
      await catchModel.setHidden(catchId, true, conn);
    }
  });
}

/** Fila de moderação, agrupada por captura (mais antiga primeiro). */
export async function listPendingReports(actor) {
  assertAdmin(actor);

  const grupos = new Map();
  for (const denuncia of await reportModel.listPending()) {
    if (!grupos.has(denuncia.catchId)) {
      grupos.set(denuncia.catchId, { catchId: denuncia.catchId, reports: [] });
    }
    grupos.get(denuncia.catchId).reports.push(denuncia);
  }

  // Inclui a captura em si para o admin ver o que está julgando, com o mesmo
  // RGN-13 de qualquer outro usuário (o admin não precisa da coordenada).
  const resultado = [];
  for (const grupo of grupos.values()) {
    const captura = await catchModel.findById(actor.id, grupo.catchId);
    if (captura) resultado.push({ ...grupo, catch: toCatchResponse(captura, actor.id) });
  }
  return resultado;
}

/**
 * Painel de moderação de uma captura (UC011): todas as denúncias, quantas
 * estão pendentes e se a captura está oculta agora.
 */
export async function listCatchReports(actor, catchId) {
  assertAdmin(actor);
  const captura = await catchModel.findById(actor.id, catchId);
  if (!captura) throw httpError(404, "Captura não encontrada");
  const reports = await reportModel.listByCatch(catchId);
  return {
    catchId,
    isHidden: captura.isHidden,
    pendingCount: reports.filter((r) => r.status === "pendente").length,
    reports,
  };
}

/**
 * Decisão do admin sobre uma captura: ocultar (`hide: true`) ou liberar
 * (`hide: false`). Marca as denúncias pendentes como analisadas. Também
 * serve para ocultar uma captura que nem foi denunciada.
 */
export async function reviewCatch(actor, catchId, entrada) {
  assertAdmin(actor);
  const { hide } = reviewSchema.parse(entrada);

  if (!(await catchModel.findById(actor.id, catchId))) {
    throw httpError(404, "Captura não encontrada");
  }

  await withTransaction(async (conn) => {
    await reportModel.markReviewed(catchId, conn);
    await catchModel.setHidden(catchId, hide, conn);
  });
}
