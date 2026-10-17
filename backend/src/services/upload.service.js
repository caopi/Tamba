// Upload de fotos de captura (REQ-15).
//
// O tipo do arquivo é decidido pelo CONTEÚDO (os primeiros bytes, a
// "assinatura" do formato), nunca pelo MIME que o navegador declara nem pela
// extensão do nome: os dois são só texto que o cliente manda e pode forjar.
//
// Problema conhecido: foto enviada para uma captura que nunca é salva fica no
// disco ("órfã"). Não há tabela de uploads para saber o que foi usado; ver
// ARQUITETURA, "Problemas conhecidos".

import * as storage from "../lib/storage.js";
import { httpError } from "../middlewares/errorHandler.js";

/** Tamanho máximo por foto. O frontend comprime antes, então sobra folga. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** Assinatura de cada formato aceito -> extensão gravada. */
function detectarFormato(buffer) {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) return "png";

  // WebP: "RIFF" + 4 bytes de tamanho + "WEBP"
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

/** Recebe o arquivo do multer (em memória) e devolve `{ id, url }`. */
export async function savePhoto(arquivo) {
  if (!arquivo) {
    throw httpError(400, "Envie a foto no campo 'photo'");
  }

  const extension = detectarFormato(arquivo.buffer);
  if (!extension) {
    throw httpError(415, "Formato não aceito. Envie uma foto JPEG, PNG ou WebP.", {
      code: "UNSUPPORTED_IMAGE",
    });
  }

  const id = await storage.save({ buffer: arquivo.buffer, extension });
  return { id, url: storage.getUrl(id) };
}
