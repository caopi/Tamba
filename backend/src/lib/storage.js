// Armazenamento de arquivos enviados (fotos de captura, avatares e fotos de
// espécie) e endereço público de qualquer imagem do app (`publicUrl`).
//
// Por enquanto só existe o driver de disco local: os arquivos vão para
// backend/uploads/<id do usuário>/ (fora do git) e a própria API os serve em
// /uploads. Escolha deliberada de desenvolvimento — ninguém do grupo precisa
// de conta nem de credencial em serviço externo. Para outro destino (S3...),
// basta escrever outro driver com o mesmo `save` / `read` e trocar a
// constante `driver`: o resto do código só conhece as funções exportadas. Ver
// ARQUITETURA, "Decisões".
//
// O banco guarda a CHAVE do arquivo ("<id do usuário>/<nome>.jpg"), nunca a
// URL: `publicUrl` junta UPLOADS_PUBLIC_URL na hora de responder. Trocar de
// domínio, de provedor ou pôr uma CDN é trocar a variável, sem mexer no banco.
//
// Dono do arquivo: cada usuário tem a sua pasta, e o começo da chave diz quem
// enviou a foto. É isso que impede alguém de anexar à própria captura a foto
// de outra pessoa copiando a URL do feed (`ownedKey`). Sem tabela de uploads:
// ver "Problemas conhecidos" na ARQUITETURA.

import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pasta dos arquivos do driver local. Servida estaticamente em /uploads.
 *
 * Vem de UPLOADS_DIR; sem ela, backend/uploads/ (desenvolvimento). Em
 * produção é obrigatória e aponta para o volume do Railway: o disco do
 * container é apagado a cada deploy, e sem a variável as fotos iriam para lá
 * em silêncio e sumiriam no deploy seguinte. Ver DEPLOY.md, seção 1.1.
 */
export const UPLOADS_DIR = lerPastaUploads(process.env.UPLOADS_DIR);

function lerPastaUploads(valor) {
  if (valor) return path.resolve(valor);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "UPLOADS_DIR não definido: em produção as fotos precisam ir para o volume (disco persistente), senão somem a cada deploy",
    );
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
}

/**
 * Garante que a pasta dos uploads existe e aceita escrita. Chamado antes de a
 * API aceitar requests: volume não montado ou sem permissão aparece na
 * subida, não no primeiro upload de alguém.
 */
export async function prepararArmazenamento() {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await access(UPLOADS_DIR, constants.W_OK);
}

/**
 * Imagens versionadas no repositório (hoje, as fotos do catálogo de espécies).
 * Servidas estaticamente em /assets. Ao contrário de uploads/, entram no git:
 * quem clona o projeto já tem as fotos.
 */
export const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets",
);

// As duas bases de imagem são obrigatórias, como o JWT_SECRET: são a única
// coisa que transforma o que o banco guarda em endereço que abre. Sem elas
// (ou com um valor torto), toda foto daria 404 em silêncio e pareceria
// defeito do upload ou do catálogo, não da configuração.

// Endereço público da própria API, base dos caminhos relativos ("/assets/...").
const API_PUBLICA = lerUrlObrigatoria("PUBLIC_API_URL", "endereço público da API, sem /api");

// Endereço público das fotos enviadas (em desenvolvimento, a própria API).
const URL_UPLOADS = lerUrlObrigatoria("UPLOADS_PUBLIC_URL", "endereço público das fotos enviadas");

function lerUrlObrigatoria(nome, descricao) {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`${nome} não definido no .env (${descricao})`);
  }
  let url = null;
  try {
    url = new URL(valor);
  } catch {
    // cai no erro abaixo
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error(`${nome} inválido: "${valor}" (precisa ser um endereço http(s) completo)`);
  }
  return valor.replace(/\/+$/, "");
}

// Começa com esquema ("https:", "http:"...): link externo, de antes do upload.
const ABSOLUTA = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Transforma a referência guardada no banco em URL que o navegador abre.
 * Todo lugar que devolve imagem para a API passa por aqui, e só aqui.
 *
 * O banco guarda um de três formatos, conforme a origem da imagem:
 * - "/assets/species/tambaqui.webp" (começa com /): foto versionada no repo,
 *   relativa à API;
 * - "<id do usuário>/<nome>.jpg" (sem / no começo): chave de um arquivo
 *   enviado, relativa a UPLOADS_PUBLIC_URL;
 * - "https://...": link externo de antes do upload, que passa intacto.
 */
export function publicUrl(ref) {
  if (!ref) return null;
  if (ref.startsWith("/") || ABSOLUTA.test(ref)) return new URL(ref, `${API_PUBLICA}/`).href;
  return `${URL_UPLOADS}/${ref}`;
}

// O id do usuário vira nome de pasta: só aceita o formato de UUID, para que
// nada vindo de fora consiga montar um caminho ("../", "/", etc.).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOME_ARQUIVO = /^[0-9a-f]{32}\.(jpg|png|webp)$/;

/**
 * Recebe a URL que veio do cliente e, se for de um arquivo deste
 * armazenamento enviado por `ownerId`, devolve a chave que vai para o banco.
 * Senão (link externo, foto de outra pessoa, nome fora do formato), null.
 */
export function ownedKey(url, ownerId) {
  const prefixo = `${URL_UPLOADS}/${ownerId}/`;
  if (typeof url !== "string" || !UUID.test(ownerId) || !url.startsWith(prefixo)) return null;
  // Só o formato de nome que o próprio save gera.
  const nome = url.slice(prefixo.length);
  return NOME_ARQUIVO.test(nome) ? `${ownerId}/${nome}` : null;
}

/**
 * O caminho de volta do `publicUrl`, para uma URL que a própria API devolveu
 * a partir do banco (as fotos que uma captura já tem, na edição). Não confere
 * dono: quem chama já sabe que a URL veio do banco.
 */
export function storedRef(url) {
  return url.startsWith(`${URL_UPLOADS}/`) ? url.slice(URL_UPLOADS.length + 1) : url;
}

const localDriver = {
  /**
   * Grava em uploads/<ownerId>/ com nome gerado aqui — nunca o nome que veio
   * do cliente, que poderia ter "../" ou caracteres que o sistema de arquivos
   * interpreta. Devolve a chave "<ownerId>/<nome>".
   */
  async save({ buffer, extension, ownerId }) {
    if (!UUID.test(ownerId)) throw new Error("ownerId inválido para o storage");
    const pasta = path.join(UPLOADS_DIR, ownerId);
    await mkdir(pasta, { recursive: true });
    const nome = `${randomBytes(16).toString("hex")}.${extension}`;
    // flag "wx": falha se o arquivo já existir, em vez de sobrescrever.
    await writeFile(path.join(pasta, nome), buffer, { flag: "wx" });
    return `${ownerId}/${nome}`;
  },

  /**
   * Conteúdo de um arquivo pela chave. Só aceita o formato que o `save` gera
   * (pasta de UUID + nome aleatório), então não serve para ler caminho
   * arbitrário do disco.
   */
  async read(chave) {
    const [dono, nome, ...resto] = String(chave).split("/");
    if (resto.length > 0 || !UUID.test(dono) || !NOME_ARQUIVO.test(nome ?? "")) {
      throw new Error("Chave fora do armazenamento");
    }
    return readFile(path.join(UPLOADS_DIR, dono, nome));
  },
};

const driver = localDriver;

/** Grava `{ buffer, extension, ownerId }` e devolve a chave do arquivo. */
export function save(arquivo) {
  return driver.save(arquivo);
}

/** Conteúdo (buffer) de um arquivo enviado, pela chave dele. */
export function read(chave) {
  return driver.read(chave);
}
