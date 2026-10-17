// Catálogo de espécies (RGN-11, RGN-16, RGN-17).
//
// RGN-11: a raridade é definida pelo admin, nunca pelo usuário. Ela só é
// gravada por createSpecies/updateSpecies, que exigem admin. Nos schemas das
// rotas de usuário (captura, perfil, comentário...) `rarity` não existe, e o
// z.object descarta campo desconhecido: mandar `rarity` no corpo dessas rotas
// é ignorado, não aceito.

import { z } from "zod";
import * as speciesModel from "../models/species.model.js";
import { isDuplicateKey } from "../lib/db.js";
import { assertAdmin } from "../lib/authz.js";
import { httpError } from "../middlewares/errorHandler.js";

const RARIDADES = ["comum", "incomum", "raro", "muito_raro"];

// Limites iguais aos DECIMAL das colunas (7,3 para kg e 5,1 para cm).
const peso = z.coerce.number().positive("O peso precisa ser maior que zero").max(9999.999);
const comprimento = z.coerce
  .number()
  .positive("O comprimento precisa ser maior que zero")
  .max(9999.9);

const createSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  scientificName: z.string().trim().min(2, "Nome científico muito curto").max(180),
  habitat: z.string().trim().min(2, "Descreva o habitat"),
  imageUrl: z.string().trim().url("URL da imagem inválida").nullish(),
  recommendedBaits: z.string().trim().max(255).nullish(),
  // Obrigatória: raridade faz parte da definição da espécie. Este é o único
  // schema da API que aceita `rarity` (RGN-11).
  rarity: z.enum(RARIDADES, { message: "Raridade inválida" }),
  // Faixas opcionais: espécie sem faixa conhecida nunca sinaliza captura (RGN-08).
  minWeight: peso.nullish(),
  maxWeight: peso.nullish(),
  minLength: comprimento.nullish(),
  maxLength: comprimento.nullish(),
  curiosities: z.string().trim().nullish(),
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

/** Mínimo ≤ máximo, olhando os valores finais (os do banco + os enviados). */
function conferirFaixas({ minWeight, maxWeight, minLength, maxLength }) {
  if (minWeight != null && maxWeight != null && minWeight > maxWeight) {
    throw httpError(422, "O peso mínimo não pode ser maior que o máximo");
  }
  if (minLength != null && maxLength != null && minLength > maxLength) {
    throw httpError(422, "O comprimento mínimo não pode ser maior que o máximo");
  }
}

function traduzirNomeDuplicado(err) {
  if (isDuplicateKey(err, "uk_fish_species_name")) {
    // A collation ignora acento e maiúscula: "Traira" colide com "Traíra".
    return httpError(409, "Já existe uma espécie com esse nome");
  }
  return err;
}

/** Catálogo. Desativadas só aparecem para admin, e só se ele pedir. */
export async function listSpecies(actor, entrada) {
  const { includeInactive } = listSchema.parse(entrada);
  return speciesModel.findAll({ includeInactive: includeInactive && actor?.role === "admin" });
}

/**
 * Ficha da espécie. Desativada continua acessível pelo id: quem já pescou
 * ainda abre a ficha pela própria Dex.
 */
export async function getSpecies(speciesId) {
  const especie = await speciesModel.findById(speciesId);
  if (!especie) throw httpError(404, "Espécie não encontrada");
  return especie;
}

/** RGN-16: só admin cadastra espécie. RGN-11: inclusive a raridade dela. */
export async function createSpecies(actor, entrada) {
  assertAdmin(actor);
  const dados = createSchema.parse(entrada);
  conferirFaixas(dados);

  if (await speciesModel.nameTaken(dados.name)) {
    throw httpError(409, "Já existe uma espécie com esse nome");
  }
  try {
    return await speciesModel.create(dados);
  } catch (err) {
    throw traduzirNomeDuplicado(err);
  }
}

/** RGN-16: só admin edita espécie. RGN-11: inclusive a raridade dela. */
export async function updateSpecies(actor, speciesId, entrada) {
  assertAdmin(actor);
  const dados = updateSchema.parse(entrada);

  const atual = await speciesModel.findById(speciesId);
  if (!atual) throw httpError(404, "Espécie não encontrada");
  conferirFaixas({ ...atual, ...dados });

  if (dados.name && (await speciesModel.nameTaken(dados.name, speciesId))) {
    throw httpError(409, "Já existe uma espécie com esse nome");
  }
  try {
    await speciesModel.update(speciesId, dados);
  } catch (err) {
    throw traduzirNomeDuplicado(err);
  }
  return speciesModel.findById(speciesId);
}

/**
 * RGN-17: desativar é o caminho normal para tirar uma espécie do catálogo.
 * Ela some da listagem e de capturas novas, mas as capturas antigas e a Dex
 * de quem já pescou continuam intactas.
 */
export async function setSpeciesActive(actor, speciesId, entrada) {
  assertAdmin(actor);
  const { isActive } = activeSchema.parse(entrada);
  if (!(await speciesModel.exists(speciesId))) {
    throw httpError(404, "Espécie não encontrada");
  }
  await speciesModel.update(speciesId, { isActive });
  return speciesModel.findById(speciesId);
}

/**
 * RGN-17: espécie com capturas nunca é apagada, só desativada. Sem
 * capturas (ex.: cadastrada por engano), o admin pode apagar. A FK
 * fk_catches_species (RESTRICT) garante a regra no banco também.
 */
export async function deleteSpecies(actor, speciesId) {
  assertAdmin(actor);
  if (!(await speciesModel.exists(speciesId))) {
    throw httpError(404, "Espécie não encontrada");
  }

  const mensagem = "Essa espécie já tem capturas registradas: desative em vez de apagar";
  if (await speciesModel.hasCatches(speciesId)) throw httpError(409, mensagem);

  try {
    await speciesModel.remove(speciesId);
  } catch (err) {
    // Uma captura entrou entre a conferência e o DELETE: o RESTRICT barrou.
    if (err.code === "ER_ROW_IS_REFERENCED_2") throw httpError(409, mensagem);
    throw err;
  }
}
