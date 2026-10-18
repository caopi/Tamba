// Armazenamento de arquivos enviados (fotos de captura e de espécie) e
// endereço público de qualquer imagem do app (`publicUrl`).
//
// Por enquanto só existe o driver de disco local: os arquivos vão para
// backend/uploads/<id do usuário>/ (fora do git) e a própria API os serve em
// /uploads. Escolha deliberada de desenvolvimento — ninguém do grupo precisa
// de conta nem de credencial em serviço externo. Para produção (Cloudinary,
// S3...), basta escrever outro driver com o mesmo `save` / `getUrl` /
// `belongsTo` e trocar a constante `driver`: o resto do código só conhece as
// funções exportadas. Ver ARQUITETURA, "Decisões".
//
// Dono do arquivo: cada usuário tem a sua pasta, e o prefixo da URL diz quem
// enviou a foto. É isso que impede alguém de anexar à própria captura a foto
// de outra pessoa copiando a URL do feed (`belongsTo`). Sem tabela de uploads:
// ver "Problemas conhecidos" na ARQUITETURA.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Pasta dos arquivos do driver local. Servida estaticamente em /uploads. */
export const UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../uploads",
);

/**
 * Imagens versionadas no repositório (hoje, as fotos do catálogo de espécies).
 * Servidas estaticamente em /assets. Ao contrário de uploads/, entram no git:
 * quem clona o projeto já tem as fotos.
 */
export const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets",
);

// Endereço público da própria API, base dos caminhos relativos ("/assets/...").
const API_PUBLICA = (process.env.PUBLIC_API_URL ?? "http://localhost:3333").replace(/\/+$/, "");

/**
 * Transforma a referência guardada no banco em URL que o navegador abre.
 *
 * O banco guarda um de dois formatos, conforme a origem da imagem: caminho
 * relativo à API ("/assets/species/tambaqui.webp", foto versionada no repo)
 * ou URL absoluta (arquivo enviado, `getUrl`). `new URL` resolve os dois sem
 * caso especial: relativo ganha a base, absoluto passa intacto. Todo lugar que
 * devolve imagem para a API passa por aqui, e só aqui.
 */
export function publicUrl(ref) {
  if (!ref) return null;
  return new URL(ref, `${API_PUBLICA}/`).href;
}

// Endereço público dos arquivos. Em desenvolvimento, a própria API.
const URL_PUBLICA = (process.env.UPLOADS_PUBLIC_URL ?? "http://localhost:3333/uploads").replace(
  /\/+$/,
  "",
);

// O id do usuário vira nome de pasta: só aceita o formato de UUID, para que
// nada vindo de fora consiga montar um caminho ("../", "/", etc.).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOME_ARQUIVO = /^[0-9a-f]{32}\.(jpg|png|webp)$/;

const localDriver = {
  /**
   * Grava em uploads/<ownerId>/ com nome gerado aqui — nunca o nome que veio
   * do cliente, que poderia ter "../" ou caracteres que o sistema de arquivos
   * interpreta. Devolve o id "<ownerId>/<nome>".
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

  getUrl(id) {
    return `${URL_PUBLICA}/${id}`;
  },

  /**
   * Lê um arquivo deste armazenamento pela URL pública. Só aceita o que
   * `belongsTo` aceitaria para o dono da pasta (o mesmo formato de nome), então
   * não serve para ler caminho arbitrário do disco.
   */
  async readUrl(url, ownerId) {
    if (!this.belongsTo(url, ownerId)) throw new Error("URL fora do armazenamento");
    return readFile(path.join(UPLOADS_DIR, ownerId, url.slice(`${URL_PUBLICA}/${ownerId}/`.length)));
  },

  /** A URL é de um arquivo deste armazenamento enviado por `ownerId`? */
  belongsTo(url, ownerId) {
    const prefixo = `${URL_PUBLICA}/${ownerId}/`;
    if (typeof url !== "string" || !UUID.test(ownerId) || !url.startsWith(prefixo)) {
      return false;
    }
    // Só o formato de nome que o próprio save gera.
    return NOME_ARQUIVO.test(url.slice(prefixo.length));
  },
};

const driver = localDriver;

/** Grava `{ buffer, extension, ownerId }` e devolve o id do arquivo. */
export function save(arquivo) {
  return driver.save(arquivo);
}

export function getUrl(id) {
  return driver.getUrl(id);
}

export function belongsTo(url, ownerId) {
  return driver.belongsTo(url, ownerId);
}

/** Conteúdo (buffer) de um arquivo enviado por `ownerId`, pela URL dele. */
export function readUrl(url, ownerId) {
  return driver.readUrl(url, ownerId);
}
