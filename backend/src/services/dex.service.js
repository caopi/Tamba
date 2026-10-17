// Dex, estatísticas e espécies favoritas (RGN-10).
//
// RGN-10: uma espécie só conta como "capturada" para o usuário depois da
// primeira captura válida dela. "Válida" = não oculta pela moderação. Captura
// sinalizada para revisão (peso/tamanho fora da faixa, confirmado pelo
// usuário) CONTA: a sinalização é um alerta, não uma punição.
//
// Dex e estatísticas são calculadas na leitura, nunca armazenadas. Escolha
// deliberada: é mais simples, não existe cache para invalidar, e o
// recálculo exigido pelo RGN-09 ao apagar uma captura sai de graça — a
// próxima consulta já não a enxerga. No volume do projeto o custo é irrelevante.

import * as speciesModel from "../models/species.model.js";
import * as catchModel from "../models/catch.model.js";
import * as socialModel from "../models/social.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { httpError } from "../middlewares/errorHandler.js";

/**
 * Progresso X/Y da Dex (REQ-09): as duas pontas contam só espécies ATIVAS.
 * Uma espécie desativada que o usuário já pescou continua na lista, marcada
 * como `archived`, mas sai do numerador e do denominador — senão desativar
 * uma espécie mudaria em silêncio o percentual de todo mundo, ou deixaria
 * alguém com mais de 100%.
 */
export async function getDex(userId) {
  const especies = await speciesModel.findDexForUser(userId);
  const ativas = especies.filter((e) => e.isActive);
  return {
    total: ativas.length,
    captured: ativas.filter((e) => e.captured).length,
    species: especies.map((e) => ({ ...e, archived: !e.isActive })),
  };
}

export async function getStats(userId) {
  return catchModel.statsForUser(userId);
}

export async function listFavorites(userId) {
  return socialModel.listFavorites(userId);
}

// Favoritar é botão de liga/desliga como curtir: idempotente, devolve o
// estado final (mesma lógica de social.service).

export async function addFavorite(userId, speciesId) {
  const especie = await speciesModel.findById(speciesId);
  if (!especie || !especie.isActive) throw httpError(404, "Espécie não encontrada");

  try {
    await socialModel.createFavorite(userId, speciesId);
  } catch (err) {
    // A PK recusou: já era favorita.
    if (!isDuplicateKey(err)) throw err;
  }
  return { favorite: true };
}

export async function removeFavorite(userId, speciesId) {
  await socialModel.deleteFavorite(userId, speciesId);
  return { favorite: false };
}
