// Capturas: registro, edição, exclusão, feed e o que cada um pode ver
// (RGN-07, RGN-08, RGN-09, RGN-12, RGN-13).
//
// Peso entra e sai sempre em kg e comprimento em cm. A preferência
// `measurement_unit` do usuário é só de exibição: quem converte é o frontend.

import { z } from "zod";
import * as catchModel from "../models/catch.model.js";
import * as speciesModel from "../models/species.model.js";
import * as spotModel from "../models/spot.model.js";
import * as userModel from "../models/user.model.js";
import { withTransaction } from "../lib/db.js";
import { belongsTo } from "../lib/storage.js";
import { httpError } from "../middlewares/errorHandler.js";

// Folga para relógio de celular um pouco adiantado: sem ela, quem registra a
// captura "agora" com o relógio 1 minuto à frente do servidor seria barrado.
const FOLGA_FUTURO_MS = 5 * 60 * 1000;

const textoOpcional = (max, mensagem) =>
  z
    .string()
    .trim()
    .max(max, mensagem)
    .nullish()
    // Campo vazio vira null para não gravar string em branco no banco.
    .transform((valor) => valor || null);

// O formato da URL é conferido aqui; QUEM enviou a foto depende do usuário,
// então fica em `conferirDonoDasFotos`.
const fotoEnviada = z.string().trim().url("URL da foto inválida");

const createSchema = z.object({
  // RGN-07: toda captura tem espécie.
  speciesId: z.string().uuid("Espécie inválida"),
  spotId: z.string().uuid("Pesqueiro inválido").nullish(),
  spotName: textoOpcional(180, "Nome do local muito longo"),
  region: textoOpcional(120, "Região muito longa"),
  // RGN-08: peso e comprimento maiores que zero.
  weight: z.coerce.number().positive("O peso precisa ser maior que zero"),
  length: z.coerce.number().positive("O comprimento precisa ser maior que zero"),
  // RGN-07: a data da captura não pode estar no futuro.
  caughtAt: z.coerce
    .date()
    .refine((data) => data.getTime() <= Date.now() + FOLGA_FUTURO_MS, {
      message: "A data da captura não pode estar no futuro",
    }),
  notes: textoOpcional(2000, "Observações muito longas"),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  // RGN-07: pelo menos uma foto. REQ-15: só fotos enviadas pelo upload do
  // app (POST /api/uploads) — colar o link de uma imagem da internet não vale.
  // Na ordem de exibição: a primeira é a capa.
  photoUrls: z
    .array(fotoEnviada)
    .min(1, "A captura precisa de pelo menos uma foto")
    .max(10, "No máximo 10 fotos por captura"),
  // RGN-08: o usuário confirmou que o peso/tamanho fora da faixa está certo.
  confirmOutOfRange: z.boolean().default(false),
});

// Na edição tudo é opcional, mas as regras de cada campo continuam valendo.
const updateSchema = createSchema.partial();

const feedSchema = z.object({
  // REQ-26: o feed é "capturas de quem o usuário segue" — por isso é o padrão
  // (e é o que faz o estado vazio do REQ-36 aparecer para quem não segue
  // ninguém). `all` é o modo "Descobrir" do REQ-28, sempre pedido explicitamente.
  // `reported`: só admin — capturas com denúncia pendente, ocultas ou não,
  // para a moderação achar o que precisa analisar (UC011).
  scope: z.enum(["following", "all", "reported"]).default("following"),
  // REQ-35: por engajamento (padrão; curtidas + comentários) ou cronológico.
  // A escolha é preferência do usuário (users.feed_order, nas Configurações),
  // que o frontend manda aqui.
  order: z.enum(["recent", "engagement"]).default("engagement"),
  // Cursor opaco devolvido em `nextCursor`: uma data no cronológico, um
  // offset no engajamento. O frontend só repassa o que recebeu.
  cursor: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * REQ-15: toda foto da captura tem de ter sido enviada pelo próprio autor
 * (POST /api/uploads grava na pasta dele). Barra link externo e também a URL
 * da foto de OUTRA pessoa copiada do feed.
 *
 * `jaAnexadas`: na edição, as fotos que a captura já tem continuam valendo,
 * para dar para reordenar ou remover fotos antigas (de antes do upload ou da
 * pasta por usuário) sem precisar reenviar.
 */
function conferirDonoDasFotos(urls, userId, jaAnexadas = []) {
  const alheia = urls.find((url) => !belongsTo(url, userId) && !jaAnexadas.includes(url));
  if (alheia) {
    throw httpError(422, "Use fotos enviadas por você pelo app (não links externos nem fotos de outra pessoa)", {
      code: "PHOTO_NOT_OWNED",
    });
  }
}

function conferirCoordenadas(latitude, longitude) {
  if ((latitude == null) !== (longitude == null)) {
    throw httpError(422, "Informe latitude e longitude juntas, ou nenhuma das duas");
  }
}

/** Espécie para uma captura NOVA: precisa existir e estar ativa (RGN-17). */
async function especieParaCaptura(speciesId) {
  const especie = await speciesModel.findById(speciesId);
  if (!especie) throw httpError(422, "Espécie não existe no catálogo");
  if (!especie.isActive) throw httpError(422, "Essa espécie foi desativada do catálogo");
  return especie;
}

/**
 * Com pesqueiro do catálogo, a região vem do `location` dele; sem pesqueiro,
 * vale o que o usuário digitou. Devolve undefined quando não há o que mudar.
 */
async function regiaoDoPesqueiro(spotId) {
  if (!spotId) return undefined;
  const pesqueiro = await spotModel.findById(spotId);
  if (!pesqueiro) throw httpError(422, "Pesqueiro não existe");
  return pesqueiro.location.slice(0, 120);
}

/**
 * RGN-08: medida fora da faixa plausível da espécie só entra com confirmação
 * explícita e, nesse caso, a captura fica sinalizada para revisão. Espécie
 * sem faixa cadastrada (NULL) nunca sinaliza. Devolve o valor de
 * `is_flagged_for_review`.
 */
function avaliarFaixa(especie, { weight, length }, confirmado) {
  const fora = [];
  if (
    (especie.minWeight !== null && weight < especie.minWeight) ||
    (especie.maxWeight !== null && weight > especie.maxWeight)
  ) {
    fora.push({ campo: "weight", min: especie.minWeight, max: especie.maxWeight });
  }
  if (
    (especie.minLength !== null && length < especie.minLength) ||
    (especie.maxLength !== null && length > especie.maxLength)
  ) {
    fora.push({ campo: "length", min: especie.minLength, max: especie.maxLength });
  }

  if (fora.length > 0 && !confirmado) {
    throw httpError(
      422,
      `Peso ou comprimento fora do comum para ${especie.name}. Confirme para registrar mesmo assim.`,
      { code: "OUT_OF_RANGE", details: fora },
    );
  }
  return fora.length > 0;
}

/**
 * RGN-13: a coordenada exata só vai para outros usuários se o autor ligou
 * `share_exact_location`; senão a resposta omite latitude/longitude e fica só
 * a região (cidade/estado). O próprio autor sempre vê tudo.
 *
 * Interpretação adotada: o RGN-13 protege a geolocalização precisa, que é o
 * que o RNF-11 aponta como dado sensível. O `spotName` continua visível
 * porque é um rótulo que o autor escreveu de propósito para a publicação
 * ("Pesqueiro do Zé"), e não uma localização capturada pelo app.
 *
 * Também tira os campos internos que o model devolve para a decisão.
 */
export function toCatchResponse(captura, viewerId) {
  const { authorIsActive, authorSharesLocation, ...publica } = captura;
  if (captura.userId === viewerId || authorSharesLocation) return publica;

  const { latitude, longitude, ...semCoordenadas } = publica;
  return semCoordenadas;
}

/**
 * Captura que `viewerId` pode ver, ainda com os campos internos (para quem
 * precisa conferir o autor, como curtida e denúncia), ou 404.
 *
 * RGN-12: captura oculta ou de autor inativo só aparece para o próprio autor.
 */
export async function findVisibleCatch(viewerId, catchId, { isAdmin = false } = {}) {
  const captura = await catchModel.findById(viewerId, catchId);
  // O admin enxerga também a oculta e a de conta desativada: é o único jeito
  // de moderar (UC011) — reexibir uma captura ou ler as denúncias dela.
  const visivel =
    captura &&
    (isAdmin || captura.userId === viewerId || (!captura.isHidden && captura.authorIsActive));
  if (!visivel) throw httpError(404, "Captura não encontrada");
  return captura;
}

export async function getCatch(viewerId, catchId, { isAdmin = false } = {}) {
  return toCatchResponse(await findVisibleCatch(viewerId, catchId, { isAdmin }), viewerId);
}

/**
 * Histórico do próprio usuário, INCLUINDO as ocultas pela moderação: elas
 * vêm com `isHidden: true` para a tela mostrar o selo "em análise" e o
 * usuário entender por que a contagem da Dex caiu.
 */
export async function listMyCatches(userId) {
  const capturas = await catchModel.findAllByUser(userId, { includeHidden: true });
  return capturas.map((c) => toCatchResponse(c, userId));
}

/** Capturas de outro usuário, no perfil dele: sem ocultas (RGN-12). */
export async function listUserCatches(viewerId, userId, { isAdmin = false } = {}) {
  if (viewerId === userId) return listMyCatches(userId);
  // Admin vê o perfil de conta desativada e as capturas ocultas (com
  // isHidden), para poder moderar; os demais, só conta ativa e visíveis.
  const existe = isAdmin
    ? await userModel.findPublicByIdForAdmin(userId)
    : await userModel.findActivePublicById(userId);
  if (!existe) throw httpError(404, "Usuário não encontrado");
  const capturas = await catchModel.findAllByUser(userId, { viewerId, includeHidden: isAdmin });
  return capturas.map((c) => toCatchResponse(c, viewerId));
}

/**
 * RGN-12: o feed só mostra capturas não ocultas de usuários ativos (o filtro
 * está em catchModel.findFeed). Por padrão só de quem o usuário segue;
 * `scope=all` abre para todo mundo (Descobrir).
 */
export async function getFeed(viewerId, entrada, { isAdmin = false } = {}) {
  const { scope, order, cursor, limit } = feedSchema.parse(entrada);
  if (scope === "reported" && !isAdmin) {
    throw httpError(403, "Apenas administradores podem fazer isso");
  }

  let before;
  let offset = 0;
  if (cursor && order === "engagement") {
    offset = Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) throw httpError(400, "Cursor inválido");
  } else if (cursor) {
    before = new Date(cursor);
    if (Number.isNaN(before.getTime())) throw httpError(400, "Cursor inválido");
  }

  const capturas = await catchModel.findFeed(viewerId, {
    onlyFollowing: scope === "following",
    onlyReported: scope === "reported",
    order,
    before,
    offset,
    limit,
  });

  // Página cheia = pode haver mais; senão acabou (null).
  let nextCursor = null;
  if (capturas.length === limit) {
    nextCursor =
      order === "engagement"
        ? String(offset + limit)
        : new Date(capturas.at(-1).createdAt).toISOString();
  }

  return { items: capturas.map((c) => toCatchResponse(c, viewerId)), nextCursor };
}

export async function createCatch(userId, entrada) {
  // RGN-07: o "pelo menos uma foto" está no próprio schema (photoUrls.min).
  const dados = createSchema.parse(entrada);
  conferirDonoDasFotos(dados.photoUrls, userId);
  conferirCoordenadas(dados.latitude, dados.longitude);

  const especie = await especieParaCaptura(dados.speciesId);
  const regiao = await regiaoDoPesqueiro(dados.spotId);
  const sinalizada = avaliarFaixa(especie, dados, dados.confirmOutOfRange);

  // Captura e fotos entram juntas, ou nenhuma entra.
  const captura = await withTransaction((conn) =>
    catchModel.create(
      userId,
      {
        ...dados,
        region: regiao ?? dados.region,
        isFlaggedForReview: sinalizada,
      },
      conn,
    ),
  );
  return toCatchResponse(captura, userId);
}

export async function updateCatch(userId, catchId, entrada) {
  const dados = updateSchema.parse(entrada);

  // RGN-09: só o autor edita. Conferir antes também evita depender do
  // affectedRows, que no MySQL vem 0 quando o valor gravado não muda.
  const atual = await catchModel.findByIdForUser(catchId, userId);
  if (!atual) throw httpError(404, "Captura não encontrada");

  // Fotos são opcionais na edição (não mandou = não mexe), mas se mandou, a
  // lista nova segue o mesmo schema: pelo menos uma (RGN-07).
  const fotos = dados.photoUrls;
  if (fotos) {
    conferirDonoDasFotos(fotos, userId, atual.photos.map((p) => p.url));
  }

  conferirCoordenadas(
    "latitude" in dados ? dados.latitude : atual.latitude,
    "longitude" in dados ? dados.longitude : atual.longitude,
  );

  // Trocar de espécie segue a regra de captura nova (precisa estar ativa);
  // editar outro campo de uma captura de espécie já desativada continua valendo.
  const trocouEspecie = dados.speciesId && dados.speciesId !== atual.speciesId;
  const especie = trocouEspecie
    ? await especieParaCaptura(dados.speciesId)
    : await speciesModel.findById(atual.speciesId);

  // RGN-08 é reavaliado com os valores finais sempre que espécie, peso ou
  // comprimento mudam: corrigir um peso digitado errado tira a sinalização.
  const alteracoes = { ...dados };
  if (trocouEspecie || "weight" in dados || "length" in dados) {
    alteracoes.isFlaggedForReview = avaliarFaixa(
      especie,
      { weight: dados.weight ?? atual.weight, length: dados.length ?? atual.length },
      dados.confirmOutOfRange,
    );
  }

  if ("spotId" in dados) {
    const regiao = await regiaoDoPesqueiro(dados.spotId);
    if (regiao !== undefined) alteracoes.region = regiao;
  }

  const captura = await withTransaction(async (conn) => {
    await catchModel.updateForUser(catchId, userId, alteracoes, conn);
    if (fotos) await catchModel.replacePhotos(catchId, fotos, conn);
    return catchModel.findById(userId, catchId, conn);
  });
  return toCatchResponse(captura, userId);
}

/**
 * RGN-09: só o autor apaga (o `user_id` vai no WHERE do DELETE).
 *
 * "Recalcular estatísticas e Dex" não exige código aqui: os dois são
 * calculados na leitura (catchModel.statsForUser, speciesModel.findDexForUser),
 * então a próxima consulta já sai sem a captura apagada. Curtidas,
 * comentários, denúncias, notificações e fotos saem junto por CASCADE.
 */
export async function deleteCatch(userId, catchId) {
  const apagadas = await catchModel.deleteForUser(catchId, userId);
  if (apagadas === 0) throw httpError(404, "Captura não encontrada");
}
