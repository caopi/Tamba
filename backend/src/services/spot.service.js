// Pesqueiros (fishing_spots), UC012 "Manter pesqueiro" — acréscimo, fora do
// documento de requisitos. Cadastro pelo admin, como o catálogo de espécies
// (UC010, RGN-16/17), mas é dado de produção — o seed só faz a carga
// inicial (ver ARQUITETURA.md).
//
// - Só admin cria, edita, desativa e apaga (assertAdmin aqui e o
//   requireAdmin nas rotas).
// - Chave única (name, location), da migration 019: o mesmo nome em outra
//   cidade é outro pesqueiro; o par repetido é recusado com 409.
// - Pesqueiro com captura só é desativado, nunca apagado (mesma razão do
//   RGN-17): sai da lista do formulário, e as capturas antigas continuam
//   mostrando o lugar.

import { z } from "zod";
import * as spotModel from "../models/spot.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { assertAdmin } from "../lib/authz.js";
import { httpError } from "../middlewares/errorHandler.js";

// As 27 UFs: `location` vira a região da captura e aparece no feed, então
// tem formato fixo, "Cidade, UF".
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** Espaços repetidos viram um, para o mesmo lugar não virar outro par. */
const limpar = (texto) => texto.trim().replace(/\s+/g, " ");

// Até 120: é o tamanho de catches.region, para onde o location é copiado.
// "atibaia ,sp" vira "atibaia, SP": a vírgula ganha o espaço certo e a UF
// fica maiúscula. A caixa da cidade fica como foi digitada.
const location = z
  .string()
  .transform((texto) => limpar(texto).replace(/ ?, ?/g, ", "))
  .pipe(
    z
      .string()
      .max(120, "Cidade muito longa")
      .regex(/^[^,]+, [A-Za-z]{2}$/, "Use o formato Cidade, UF (ex.: Atibaia, SP)"),
  )
  .transform((texto) => {
    const [cidade, uf] = texto.split(", ");
    return `${cidade}, ${uf.toUpperCase()}`;
  })
  .refine((texto) => UFS.includes(texto.slice(-2)), "UF inválida");

const createSchema = z.object({
  name: z
    .string()
    .transform(limpar)
    .pipe(z.string().min(2, "Nome muito curto").max(180, "Nome muito longo")),
  location,
});

const updateSchema = createSchema.partial();

const activeSchema = z.object({
  isActive: z.boolean({ required_error: "Informe isActive (true ou false)" }),
});

const listSchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
});

const PAR_REPETIDO = "Já existe um pesqueiro com esse nome nessa cidade";

function traduzirParRepetido(err) {
  // A collation ignora caixa e acento: "Pesqueiro do Renato" colide com
  // "Pesqueiro Do Renato" na mesma cidade.
  if (isDuplicateKey(err, "uq_fishing_spots_name_location")) {
    return httpError(409, PAR_REPETIDO, { code: "SPOT_TAKEN" });
  }
  return err;
}

/** Lista. Desativados só aparecem para admin, e só se ele pedir. */
export async function listSpots(actor, entrada) {
  const { includeInactive } = listSchema.parse(entrada);
  return spotModel.findAll({ includeInactive: includeInactive && actor?.role === "admin" });
}

export async function createSpot(actor, entrada) {
  assertAdmin(actor);
  const dados = createSchema.parse(entrada);

  if (await spotModel.pairTaken(dados.name, dados.location)) {
    throw httpError(409, PAR_REPETIDO, { code: "SPOT_TAKEN" });
  }
  try {
    return await spotModel.create(dados);
  } catch (err) {
    throw traduzirParRepetido(err);
  }
}

/**
 * Editar nome ou cidade não mexe nas capturas: a região delas foi copiada ao
 * salvar (catches.region), e o card mostra o pesqueiro com os dados de agora.
 */
export async function updateSpot(actor, spotId, entrada) {
  assertAdmin(actor);
  const dados = updateSchema.parse(entrada);

  const atual = await spotModel.findById(spotId);
  if (!atual) throw httpError(404, "Pesqueiro não encontrado");

  const final = { name: dados.name ?? atual.name, location: dados.location ?? atual.location };
  if (await spotModel.pairTaken(final.name, final.location, spotId)) {
    throw httpError(409, PAR_REPETIDO, { code: "SPOT_TAKEN" });
  }
  try {
    await spotModel.update(spotId, dados);
  } catch (err) {
    throw traduzirParRepetido(err);
  }
  return spotModel.findById(spotId);
}

/**
 * Desativar é o caminho normal para tirar um pesqueiro da lista (fechou,
 * cadastro errado com capturas). Some do formulário de captura nova; as
 * capturas que já apontam para ele ficam como estão.
 */
export async function setSpotActive(actor, spotId, entrada) {
  assertAdmin(actor);
  const { isActive } = activeSchema.parse(entrada);
  if (!(await spotModel.exists(spotId))) {
    throw httpError(404, "Pesqueiro não encontrado");
  }
  await spotModel.update(spotId, { isActive });
  return spotModel.findById(spotId);
}

/**
 * Pesqueiro com captura nunca é apagado, só desativado. Sem captura (ex.:
 * cadastrado por engano), o admin pode apagar. Diferente das espécies, a FK
 * fk_catches_spot é SET NULL e não barraria o DELETE: a regra fica no próprio
 * DELETE (spotModel.removeIfUnused).
 */
export async function deleteSpot(actor, spotId) {
  assertAdmin(actor);
  if (!(await spotModel.exists(spotId))) {
    throw httpError(404, "Pesqueiro não encontrado");
  }
  if ((await spotModel.removeIfUnused(spotId)) === 0) {
    throw httpError(409, "Esse pesqueiro já tem capturas registradas: desative em vez de apagar");
  }
}
