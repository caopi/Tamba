import { z } from "zod";
import * as catchModel from "../models/catch.model.js";
import * as speciesModel from "../models/species.model.js";
import * as spotModel from "../models/spot.model.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { httpError } from "../middlewares/errorHandler.js";

const createSchema = z.object({
  speciesId: z.string().uuid("Espécie inválida"),
  spotId: z.string().uuid("Pesqueiro inválido").nullish(),
  weight: z.coerce.number().positive("O peso precisa ser maior que zero"),
  length: z.coerce.number().positive("O comprimento precisa ser maior que zero"),
  photoUrl: z.string().url("URL da foto inválida").nullish(),
  caughtAt: z.coerce.date(),
});

// Na edição todos os campos são opcionais, mas as regras continuam valendo.
const updateSchema = createSchema.partial();

/** As FKs do banco já barram id inválido, mas assim devolvemos 422 com mensagem. */
async function validarRelacoes({ speciesId, spotId }) {
  if (speciesId && !(await speciesModel.exists(speciesId))) {
    throw httpError(422, "Espécie não existe no catálogo");
  }
  if (spotId && !(await spotModel.exists(spotId))) {
    throw httpError(422, "Pesqueiro não existe");
  }
}

// GET /api/catches  -> capturas do usuário logado, da mais recente para a mais antiga
export const listMyCatches = asyncHandler(async (req, res) => {
  res.json(await catchModel.findAllByUser(req.userId));
});

// GET /api/catches/:id
export const getCatch = asyncHandler(async (req, res) => {
  const captura = await catchModel.findByIdForUser(req.params.id, req.userId);
  if (!captura) throw httpError(404, "Captura não encontrada");
  res.json(captura);
});

// POST /api/catches
export const createCatch = asyncHandler(async (req, res) => {
  const dados = createSchema.parse(req.body);
  await validarRelacoes(dados);

  res.status(201).json(await catchModel.create(req.userId, dados));
});

// PUT /api/catches/:id
export const updateCatch = asyncHandler(async (req, res) => {
  const dados = updateSchema.parse(req.body);

  // Conferir antes de atualizar resolve duas coisas de uma vez: garante que a
  // captura é do usuário logado e evita depender de affectedRows, que no MySQL
  // vem 0 quando o valor enviado é igual ao que já estava gravado.
  if (!(await catchModel.findByIdForUser(req.params.id, req.userId))) {
    throw httpError(404, "Captura não encontrada");
  }
  await validarRelacoes(dados);

  await catchModel.updateForUser(req.params.id, req.userId, dados);
  res.json(await catchModel.findByIdForUser(req.params.id, req.userId));
});

// DELETE /api/catches/:id
export const deleteCatch = asyncHandler(async (req, res) => {
  const apagadas = await catchModel.deleteForUser(req.params.id, req.userId);
  if (apagadas === 0) throw httpError(404, "Captura não encontrada");
  res.status(204).send();
});
